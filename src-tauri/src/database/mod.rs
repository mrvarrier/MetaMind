use sqlx::{SqlitePool, Row};
use anyhow::Result;
use std::path::Path;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone)]
pub struct Database {
    pub pool: SqlitePool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileRecord {
    pub id: String,
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub size: i64,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub last_accessed: Option<DateTime<Utc>>,
    pub mime_type: Option<String>,
    pub hash: Option<String>,
    pub content: Option<String>,
    pub tags: Option<String>,
    pub metadata: Option<String>,
    pub ai_analysis: Option<String>,
    pub embedding: Option<Vec<f32>>,
    pub indexed_at: Option<DateTime<Utc>>,
    pub processing_status: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub file_count: i64,
    pub rules: Option<String>,
    pub insights: Option<String>,
}

impl Database {
    pub async fn new<P: AsRef<Path>>(database_path: P) -> Result<Self> {
        let database_path = database_path.as_ref();
        
        // Create the database directory if it doesn't exist
        if let Some(parent) = database_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Create the database file if it doesn't exist
        if !database_path.exists() {
            tokio::fs::File::create(database_path).await?;
        }

        let database_url = format!("sqlite:{}?mode=rwc", database_path.display());
        let pool = SqlitePool::connect(&database_url).await?;
        
        // Set pragmas for better reliability
        sqlx::query("PRAGMA journal_mode = WAL").execute(&pool).await?;
        sqlx::query("PRAGMA synchronous = NORMAL").execute(&pool).await?;
        sqlx::query("PRAGMA cache_size = 1000").execute(&pool).await?;
        sqlx::query("PRAGMA temp_store = memory").execute(&pool).await?;
        
        let db = Database { pool };
        
        // Run migrations
        db.run_migrations().await?;
        
        Ok(db)
    }

    async fn run_migrations(&self) -> Result<()> {
        // Disable foreign keys to avoid corruption issues during development
        sqlx::query("PRAGMA foreign_keys = OFF").execute(&self.pool).await?;
        
        // Create main tables
        self.create_files_table().await?;
        self.create_collections_table().await?;
        self.create_file_collections_table().await?;
        self.create_fts_table().await?;
        
        // Run schema migrations
        self.migrate_schema().await?;
        
        Ok(())
    }

    async fn create_files_table(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                extension TEXT,
                size INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                last_accessed TEXT,
                mime_type TEXT,
                hash TEXT,
                content TEXT,
                tags TEXT,
                metadata TEXT,
                ai_analysis TEXT,
                embedding BLOB,
                indexed_at TEXT,
                processing_status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT
            )
            "#
        ).execute(&self.pool).await?;

        // Create indexes
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_files_path ON files(path)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_files_status ON files(processing_status)")
            .execute(&self.pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_at)")
            .execute(&self.pool).await?;

        Ok(())
    }

    async fn create_collections_table(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                file_count INTEGER DEFAULT 0,
                rules TEXT,
                insights TEXT
            )
            "#
        ).execute(&self.pool).await?;

        Ok(())
    }

    async fn create_file_collections_table(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS file_collections (
                file_id TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (file_id, collection_id),
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
            )
            "#
        ).execute(&self.pool).await?;

        Ok(())
    }

    async fn create_fts_table(&self) -> Result<()> {
        // Skip FTS5 for now to avoid corruption - create a simple search table instead
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS files_fts (
                id TEXT NOT NULL,
                name TEXT,
                content TEXT,
                tags TEXT,
                ai_analysis TEXT,
                PRIMARY KEY (id)
            )
            "#
        ).execute(&self.pool).await?;

        // Create triggers to keep search table synchronized
        sqlx::query(
            r#"
            CREATE TRIGGER IF NOT EXISTS files_fts_insert AFTER INSERT ON files BEGIN
                INSERT OR REPLACE INTO files_fts(id, name, content, tags, ai_analysis) 
                VALUES (new.id, new.name, COALESCE(new.content, ''), COALESCE(new.tags, ''), COALESCE(new.ai_analysis, ''));
            END
            "#
        ).execute(&self.pool).await?;

        sqlx::query(
            r#"
            CREATE TRIGGER IF NOT EXISTS files_fts_delete AFTER DELETE ON files BEGIN
                DELETE FROM files_fts WHERE id = old.id;
            END
            "#
        ).execute(&self.pool).await?;

        sqlx::query(
            r#"
            CREATE TRIGGER IF NOT EXISTS files_fts_update AFTER UPDATE ON files BEGIN
                INSERT OR REPLACE INTO files_fts(id, name, content, tags, ai_analysis) 
                VALUES (new.id, new.name, COALESCE(new.content, ''), COALESCE(new.tags, ''), COALESCE(new.ai_analysis, ''));
            END
            "#
        ).execute(&self.pool).await?;

        Ok(())
    }

    async fn migrate_schema(&self) -> Result<()> {
        // Check if content column exists in files table
        let columns: Vec<(String,)> = sqlx::query_as("PRAGMA table_info(files)")
            .fetch_all(&self.pool)
            .await?
            .into_iter()
            .map(|row: (i32, String, String, i32, Option<String>, i32)| (row.1,))
            .collect();
        
        let has_content_column = columns.iter().any(|(name,)| name == "content");
        
        if !has_content_column {
            tracing::info!("Adding content column to files table");
            sqlx::query("ALTER TABLE files ADD COLUMN content TEXT")
                .execute(&self.pool)
                .await?;
            
            // Recreate FTS triggers to use the new content column
            sqlx::query("DROP TRIGGER IF EXISTS files_fts_insert").execute(&self.pool).await?;
            sqlx::query("DROP TRIGGER IF EXISTS files_fts_update").execute(&self.pool).await?;
            
            // Recreate FTS triggers
            sqlx::query(
                r#"
                CREATE TRIGGER IF NOT EXISTS files_fts_insert AFTER INSERT ON files BEGIN
                    INSERT INTO files_fts(id, name, content, tags, ai_analysis) 
                    VALUES (new.id, new.name, COALESCE(new.content, ''), COALESCE(new.tags, ''), COALESCE(new.ai_analysis, ''));
                END
                "#
            ).execute(&self.pool).await?;

            sqlx::query(
                r#"
                CREATE TRIGGER IF NOT EXISTS files_fts_update AFTER UPDATE ON files BEGIN
                    DELETE FROM files_fts WHERE id = old.id;
                    INSERT INTO files_fts(id, name, content, tags, ai_analysis) 
                    VALUES (new.id, new.name, COALESCE(new.content, ''), COALESCE(new.tags, ''), COALESCE(new.ai_analysis, ''));
                END
                "#
            ).execute(&self.pool).await?;
            
            tracing::info!("Schema migration completed successfully");
        }
        
        Ok(())
    }

    // File operations
    pub async fn file_exists(&self, path: &str) -> Result<bool> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM files WHERE path = ?")
            .bind(path)
            .fetch_one(&self.pool)
            .await?;
        Ok(count.0 > 0)
    }

    pub async fn insert_file(&self, file: &FileRecord) -> Result<()> {
        let embedding_blob = file.embedding.as_ref().map(|e| {
            e.iter().flat_map(|f| f.to_le_bytes()).collect::<Vec<u8>>()
        });

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO files 
            (id, path, name, extension, size, created_at, modified_at, last_accessed, 
             mime_type, hash, content, tags, metadata, ai_analysis, embedding, indexed_at, 
             processing_status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&file.id)
        .bind(&file.path)
        .bind(&file.name)
        .bind(&file.extension)
        .bind(file.size)
        .bind(file.created_at.to_rfc3339())
        .bind(file.modified_at.to_rfc3339())
        .bind(file.last_accessed.map(|dt| dt.to_rfc3339()))
        .bind(&file.mime_type)
        .bind(&file.hash)
        .bind(&file.content)
        .bind(&file.tags)
        .bind(&file.metadata)
        .bind(&file.ai_analysis)
        .bind(embedding_blob)
        .bind(file.indexed_at.map(|dt| dt.to_rfc3339()))
        .bind(&file.processing_status)
        .bind(&file.error_message)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_file_by_path(&self, path: &str) -> Result<Option<FileRecord>> {
        let row = sqlx::query("SELECT * FROM files WHERE path = ?")
            .bind(path)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            Ok(Some(self.row_to_file_record(row)?))
        } else {
            Ok(None)
        }
    }

    pub async fn get_files_by_status(&self, status: &str) -> Result<Vec<FileRecord>> {
        let rows = sqlx::query("SELECT * FROM files WHERE processing_status = ? ORDER BY modified_at DESC")
            .bind(status)
            .fetch_all(&self.pool)
            .await?;

        let mut files = Vec::new();
        for row in rows {
            files.push(self.row_to_file_record(row)?);
        }

        Ok(files)
    }

    pub async fn get_error_files_in_location(&self, location_path: &str) -> Result<Vec<FileRecord>> {
        let query = if std::path::Path::new(location_path).is_file() {
            // For individual files, match exact path
            r#"
            SELECT * FROM files 
            WHERE path = ? AND processing_status = 'error'
            ORDER BY modified_at DESC
            "#
        } else {
            // For directories, match files within that directory  
            r#"
            SELECT * FROM files 
            WHERE path LIKE ? || '%' AND processing_status = 'error'
            ORDER BY modified_at DESC
            "#
        };
        
        let rows = sqlx::query(query)
            .bind(location_path)
            .fetch_all(&self.pool)
            .await?;

        let mut files = Vec::new();
        for row in rows {
            files.push(self.row_to_file_record(row)?);
        }

        Ok(files)
    }

    pub async fn update_file_status(&self, file_id: &str, status: &str, error_message: Option<&str>) -> Result<()> {
        sqlx::query("UPDATE files SET processing_status = ?, error_message = ? WHERE id = ?")
            .bind(status)
            .bind(error_message)
            .bind(file_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn update_file_analysis(&self, file_id: &str, content: &str, analysis: &str, tags: Option<&str>, embedding: Option<&[f32]>) -> Result<()> {
        let embedding_blob = embedding.map(|e| {
            e.iter().flat_map(|f| f.to_le_bytes()).collect::<Vec<u8>>()
        });

        sqlx::query(
            "UPDATE files SET content = ?, ai_analysis = ?, tags = ?, embedding = ?, processing_status = 'completed', indexed_at = ? WHERE id = ?"
        )
        .bind(content)
        .bind(analysis)
        .bind(tags)
        .bind(embedding_blob)
        .bind(Utc::now().to_rfc3339())
        .bind(file_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // Search operations
    pub async fn search_files(&self, query: &str, limit: i64, offset: i64) -> Result<Vec<FileRecord>> {
        // Simple LIKE search instead of FTS for now
        let search_pattern = format!("%{}%", query);
        
        let rows = sqlx::query(
            r#"
            SELECT f.* FROM files f
            WHERE f.name LIKE ? OR f.content LIKE ? OR f.ai_analysis LIKE ?
            ORDER BY f.modified_at DESC
            LIMIT ? OFFSET ?
            "#
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(&search_pattern)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        let mut files = Vec::new();
        for row in rows {
            files.push(self.row_to_file_record(row)?);
        }

        Ok(files)
    }

    pub async fn get_processing_stats(&self) -> Result<serde_json::Value> {
        let stats = sqlx::query(
            r#"
            SELECT 
                COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN processing_status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN processing_status = 'error' THEN 1 END) as errors,
                COUNT(*) as total
            FROM files
            "#
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(serde_json::json!({
            "total_processed": stats.get::<i64, _>("completed"),
            "queue_size": stats.get::<i64, _>("pending"),
            "current_processing": stats.get::<i64, _>("processing"),
            "errors": stats.get::<i64, _>("errors"),
            "average_processing_time_ms": 1500.0,
            "last_processed_at": Utc::now().to_rfc3339()
        }))
    }

    pub async fn get_insights_data(&self) -> Result<serde_json::Value> {
        tracing::info!("Starting insights data collection");
        
        // Start with a very simple query to test basic functionality
        let _total_files_result = match sqlx::query("SELECT COUNT(*) as total FROM files")
            .fetch_one(&self.pool)
            .await {
                Ok(row) => {
                    let total: i64 = row.get("total");
                    tracing::info!("Total files query successful: {}", total);
                    total
                }
                Err(e) => {
                    tracing::error!("Total files query failed: {}", e);
                    return Err(anyhow::anyhow!("Failed to get total files: {}", e));
                }
            };
        
        // Get file type statistics
        let file_types = match sqlx::query(
            r#"
            SELECT 
                CASE 
                    WHEN extension IN ('pdf', 'doc', 'docx', 'txt', 'md', 'rtf') THEN 'documents'
                    WHEN extension IN ('jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'tiff', 'webp') THEN 'images'
                    WHEN extension IN ('js', 'ts', 'py', 'rs', 'java', 'cpp', 'c', 'h', 'css', 'html', 'xml', 'json') THEN 'code'
                    ELSE 'other'
                END as category,
                COUNT(*) as count
            FROM files 
            WHERE processing_status = 'completed'
            GROUP BY category
            "#
        )
        .fetch_all(&self.pool)
        .await {
            Ok(result) => {
                tracing::info!("File types query successful, got {} rows", result.len());
                result
            }
            Err(e) => {
                tracing::error!("File types query failed: {}", e);
                return Err(anyhow::anyhow!("Failed to get file types: {}", e));
            }
        };

        let mut categories = std::collections::HashMap::new();
        let mut total_files = 0i64;
        
        for row in file_types {
            let category: String = row.get("category");
            let count: i64 = row.get("count");
            categories.insert(category, count);
            total_files += count;
        }

        // Calculate percentages and create category data
        let documents_count = categories.get("documents").unwrap_or(&0);
        let images_count = categories.get("images").unwrap_or(&0);
        let code_count = categories.get("code").unwrap_or(&0);
        let other_count = categories.get("other").unwrap_or(&0);

        let calc_percentage = |count: i64| -> f64 {
            if total_files > 0 { (count as f64 / total_files as f64) * 100.0 } else { 0.0 }
        };

        // Get recent processing activity (last 20 activities)
        let recent_activity = match sqlx::query(
            r#"
            SELECT 
                name,
                processing_status,
                modified_at,
                error_message,
                path
            FROM files 
            ORDER BY modified_at DESC 
            LIMIT 20
            "#
        )
        .fetch_all(&self.pool)
        .await {
            Ok(result) => {
                tracing::debug!("Recent activity query successful, got {} rows", result.len());
                result
            }
            Err(e) => {
                tracing::error!("Recent activity query failed: {}", e);
                return Err(anyhow::anyhow!("Failed to get recent activity: {}", e));
            }
        };

        let activity_items: Vec<serde_json::Value> = recent_activity.iter().enumerate().filter_map(|(i, row)| {
            // Use safe row access to avoid panics
            let name: Option<String> = row.try_get("name").ok();
            let status: Option<String> = row.try_get("processing_status").ok();
            let modified_at: Option<String> = row.try_get("modified_at").ok();
            let error_message: Option<String> = row.try_get("error_message").ok().flatten();
            
            // Skip rows with missing essential data
            let name = name?;
            let status = status?;
            let modified_at = modified_at?;
            
            let (message, activity_status) = match status.as_str() {
                "completed" => (format!("✅ Successfully processed {}", name), "completed"),
                "processing" => (format!("🔄 Currently processing {}", name), "in_progress"),
                "error" => (format!("❌ Failed to process {} - {}", name, error_message.unwrap_or("Unknown error".to_string())), "error"),
                "pending" => (format!("⏳ Queued for processing: {}", name), "pending"),
                _ => (format!("📄 File activity: {}", name), "unknown")
            };

            Some(serde_json::json!({
                "id": format!("activity_{}", i),
                "type": status,
                "message": message,
                "timestamp": modified_at,
                "status": activity_status
            }))
        }).collect();

        // Get overall processing statistics
        let processing_stats = match sqlx::query(
            r#"
            SELECT 
                COUNT(*) as total_files,
                COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed_files,
                COUNT(CASE WHEN processing_status = 'error' THEN 1 END) as error_files,
                COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending_files,
                COUNT(CASE WHEN processing_status = 'processing' THEN 1 END) as processing_files
            FROM files
            "#
        )
        .fetch_one(&self.pool)
        .await {
            Ok(result) => {
                tracing::debug!("Processing stats query successful");
                result
            }
            Err(e) => {
                tracing::error!("Processing stats query failed: {}", e);
                return Err(anyhow::anyhow!("Failed to get processing stats: {}", e));
            }
        };

        let total_db_files: i64 = processing_stats.try_get("total_files").unwrap_or(0);
        let completed_files: i64 = processing_stats.try_get("completed_files").unwrap_or(0);
        let error_files: i64 = processing_stats.try_get("error_files").unwrap_or(0);

        // Calculate success rate
        let success_rate = if total_db_files > 0 {
            ((completed_files as f64 / total_db_files as f64) * 100.0).round()
        } else {
            0.0
        };

        tracing::debug!("Insights data collection completed successfully");

        Ok(serde_json::json!({
            "file_types": {
                "documents": documents_count,
                "images": images_count,
                "code": code_count,
                "other": other_count,
                "total": total_files
            },
            "categories": [
                {
                    "name": "Documents",
                    "count": documents_count,
                    "percentage": calc_percentage(*documents_count),
                    "color": "blue"
                },
                {
                    "name": "Images", 
                    "count": images_count,
                    "percentage": calc_percentage(*images_count),
                    "color": "green"
                },
                {
                    "name": "Code",
                    "count": code_count,
                    "percentage": calc_percentage(*code_count),
                    "color": "purple"
                },
                {
                    "name": "Other",
                    "count": other_count,
                    "percentage": calc_percentage(*other_count),
                    "color": "gray"
                }
            ],
            "recent_activity": activity_items,
            "processing_summary": {
                "total_files": total_db_files,
                "completed_files": completed_files,
                "error_files": error_files,
                "success_rate": success_rate
            }
        }))
    }

    pub async fn get_location_stats(&self, location_path: &str) -> Result<serde_json::Value> {
        // Handle both individual files and directories
        let query = if std::path::Path::new(location_path).is_file() {
            // For individual files, match exact path
            r#"
            SELECT 
                COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN processing_status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN processing_status = 'error' THEN 1 END) as errors,
                COUNT(*) as total
            FROM files
            WHERE path = ?
            "#
        } else {
            // For directories, match files within that directory (path starts with the directory path)
            r#"
            SELECT 
                COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN processing_status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN processing_status = 'error' THEN 1 END) as errors,
                COUNT(*) as total
            FROM files
            WHERE path LIKE ? || '%'
            "#
        };
        
        let stats = sqlx::query(query)
            .bind(location_path)
            .fetch_one(&self.pool)
            .await?;

        Ok(serde_json::json!({
            "total_files": stats.get::<i64, _>("total"),
            "processed_files": stats.get::<i64, _>("completed"),
            "pending_files": stats.get::<i64, _>("pending") + stats.get::<i64, _>("processing"),
            "error_files": stats.get::<i64, _>("errors")
        }))
    }

    fn row_to_file_record(&self, row: sqlx::sqlite::SqliteRow) -> Result<FileRecord> {
        let embedding_blob: Option<Vec<u8>> = row.try_get("embedding")?;
        let embedding = embedding_blob.map(|blob| {
            blob.chunks_exact(4)
                .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
                .collect()
        });

        Ok(FileRecord {
            id: row.get("id"),
            path: row.get("path"),
            name: row.get("name"),
            extension: row.get("extension"),
            size: row.get("size"),
            created_at: DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))?.with_timezone(&Utc),
            modified_at: DateTime::parse_from_rfc3339(&row.get::<String, _>("modified_at"))?.with_timezone(&Utc),
            last_accessed: row.get::<Option<String>, _>("last_accessed")
                .map(|s| DateTime::parse_from_rfc3339(&s).map(|dt| dt.with_timezone(&Utc)))
                .transpose()?,
            mime_type: row.get("mime_type"),
            hash: row.get("hash"),
            content: row.get("content"),
            tags: row.get("tags"),
            metadata: row.get("metadata"),
            ai_analysis: row.get("ai_analysis"),
            embedding,
            indexed_at: row.get::<Option<String>, _>("indexed_at")
                .map(|s| DateTime::parse_from_rfc3339(&s).map(|dt| dt.with_timezone(&Utc)))
                .transpose()?,
            processing_status: row.get("processing_status"),
            error_message: row.get("error_message"),
        })
    }

    // Collections operations
    pub async fn create_collection(&self, name: &str, description: Option<&str>) -> Result<Collection> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        
        sqlx::query(
            r#"
            INSERT INTO collections (id, name, description, created_at, updated_at, file_count)
            VALUES (?, ?, ?, ?, ?, 0)
            "#
        )
        .bind(&id)
        .bind(name)
        .bind(description)
        .bind(now.to_rfc3339())
        .bind(now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(Collection {
            id,
            name: name.to_string(),
            description: description.map(|s| s.to_string()),
            created_at: now,
            updated_at: now,
            file_count: 0,
            rules: None,
            insights: None,
        })
    }

    pub async fn get_collections(&self) -> Result<Vec<Collection>> {
        let rows = sqlx::query("SELECT * FROM collections ORDER BY updated_at DESC")
            .fetch_all(&self.pool)
            .await?;

        let mut collections = Vec::new();
        for row in rows {
            collections.push(self.row_to_collection(row)?);
        }
        Ok(collections)
    }

    pub async fn get_collection_by_id(&self, id: &str) -> Result<Option<Collection>> {
        let row = sqlx::query("SELECT * FROM collections WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            Ok(Some(self.row_to_collection(row)?))
        } else {
            Ok(None)
        }
    }

    pub async fn update_collection(&self, id: &str, name: Option<&str>, description: Option<&str>) -> Result<()> {
        let mut query_parts = Vec::new();
        let mut bindings = Vec::new();

        if let Some(name) = name {
            query_parts.push("name = ?");
            bindings.push(name);
        }
        if let Some(description) = description {
            query_parts.push("description = ?");
            bindings.push(description);
        }

        if !query_parts.is_empty() {
            query_parts.push("updated_at = ?");
            let now = Utc::now().to_rfc3339();
            bindings.push(&now);

            let query = format!("UPDATE collections SET {} WHERE id = ?", query_parts.join(", "));
            let mut sql_query = sqlx::query(&query);
            
            for binding in bindings {
                sql_query = sql_query.bind(binding);
            }
            sql_query = sql_query.bind(id);
            
            sql_query.execute(&self.pool).await?;
        }

        Ok(())
    }

    pub async fn delete_collection(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM collections WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn add_file_to_collection(&self, file_id: &str, collection_id: &str) -> Result<()> {
        let now = Utc::now().to_rfc3339();
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO file_collections (file_id, collection_id, added_at)
            VALUES (?, ?, ?)
            "#
        )
        .bind(file_id)
        .bind(collection_id)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        // Update collection file count
        sqlx::query(
            r#"
            UPDATE collections 
            SET file_count = (
                SELECT COUNT(*) FROM file_collections WHERE collection_id = ?
            ),
            updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(collection_id)
        .bind(&now)
        .bind(collection_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn remove_file_from_collection(&self, file_id: &str, collection_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM file_collections WHERE file_id = ? AND collection_id = ?")
            .bind(file_id)
            .bind(collection_id)
            .execute(&self.pool)
            .await?;

        // Update collection file count
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            UPDATE collections 
            SET file_count = (
                SELECT COUNT(*) FROM file_collections WHERE collection_id = ?
            ),
            updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(collection_id)
        .bind(now)
        .bind(collection_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_files_in_collection(&self, collection_id: &str) -> Result<Vec<FileRecord>> {
        let rows = sqlx::query(
            r#"
            SELECT f.* FROM files f
            INNER JOIN file_collections fc ON f.id = fc.file_id
            WHERE fc.collection_id = ?
            ORDER BY fc.added_at DESC
            "#
        )
        .bind(collection_id)
        .fetch_all(&self.pool)
        .await?;

        let mut files = Vec::new();
        for row in rows {
            files.push(self.row_to_file_record(row)?);
        }
        Ok(files)
    }

    fn row_to_collection(&self, row: sqlx::sqlite::SqliteRow) -> Result<Collection> {
        Ok(Collection {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            created_at: DateTime::parse_from_rfc3339(&row.get::<String, _>("created_at"))?.with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))?.with_timezone(&Utc),
            file_count: row.get("file_count"),
            rules: row.get("rules"),
            insights: row.get("insights"),
        })
    }
}