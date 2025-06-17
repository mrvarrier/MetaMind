use sqlx::{SqlitePool, Row};
use anyhow::Result;
use std::path::Path;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone)]
pub struct Database {
    pool: SqlitePool,
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

        let database_url = format!("sqlite:{}", database_path.display());
        let pool = SqlitePool::connect(&database_url).await?;
        
        let db = Database { pool };
        
        // Run migrations
        db.run_migrations().await?;
        
        Ok(db)
    }

    async fn run_migrations(&self) -> Result<()> {
        // Enable FTS5 extension
        sqlx::query("PRAGMA foreign_keys = ON").execute(&self.pool).await?;
        
        // Create main tables
        self.create_files_table().await?;
        self.create_collections_table().await?;
        self.create_file_collections_table().await?;
        self.create_fts_table().await?;
        
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
        // Create FTS5 virtual table for full-text search
        sqlx::query(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                id UNINDEXED,
                name,
                content,
                tags,
                ai_analysis,
                content='files',
                content_rowid='rowid'
            )
            "#
        ).execute(&self.pool).await?;

        // Create triggers to keep FTS table synchronized
        sqlx::query(
            r#"
            CREATE TRIGGER IF NOT EXISTS files_fts_insert AFTER INSERT ON files BEGIN
                INSERT INTO files_fts(id, name, content, tags, ai_analysis) 
                VALUES (new.id, new.name, COALESCE(new.metadata, ''), COALESCE(new.tags, ''), COALESCE(new.ai_analysis, ''));
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
                DELETE FROM files_fts WHERE id = old.id;
                INSERT INTO files_fts(id, name, content, tags, ai_analysis) 
                VALUES (new.id, new.name, COALESCE(new.metadata, ''), COALESCE(new.tags, ''), COALESCE(new.ai_analysis, ''));
            END
            "#
        ).execute(&self.pool).await?;

        Ok(())
    }

    // File operations
    pub async fn insert_file(&self, file: &FileRecord) -> Result<()> {
        let embedding_blob = file.embedding.as_ref().map(|e| {
            e.iter().flat_map(|f| f.to_le_bytes()).collect::<Vec<u8>>()
        });

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO files 
            (id, path, name, extension, size, created_at, modified_at, last_accessed, 
             mime_type, hash, tags, metadata, ai_analysis, embedding, indexed_at, 
             processing_status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    pub async fn update_file_status(&self, file_id: &str, status: &str, error_message: Option<&str>) -> Result<()> {
        sqlx::query("UPDATE files SET processing_status = ?, error_message = ? WHERE id = ?")
            .bind(status)
            .bind(error_message)
            .bind(file_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn update_file_analysis(&self, file_id: &str, analysis: &str, tags: Option<&str>, embedding: Option<&[f32]>) -> Result<()> {
        let embedding_blob = embedding.map(|e| {
            e.iter().flat_map(|f| f.to_le_bytes()).collect::<Vec<u8>>()
        });

        sqlx::query(
            "UPDATE files SET ai_analysis = ?, tags = ?, embedding = ?, processing_status = 'completed', indexed_at = ? WHERE id = ?"
        )
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
        let fts_query = format!("\"{}\"", query.replace("\"", "\"\""));
        
        let rows = sqlx::query(
            r#"
            SELECT f.* FROM files f
            JOIN files_fts fts ON f.id = fts.id
            WHERE files_fts MATCH ?
            ORDER BY bm25(files_fts)
            LIMIT ? OFFSET ?
            "#
        )
        .bind(fts_query)
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