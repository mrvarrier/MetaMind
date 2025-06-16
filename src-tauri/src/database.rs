use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, Row};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Database {
    pool: SqlitePool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
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
    pub tags: Option<String>, // JSON array
    pub metadata: Option<String>, // JSON object
    pub ai_analysis: Option<String>, // JSON object
    pub embedding: Option<Vec<u8>>, // Serialized vector
    pub indexed_at: Option<DateTime<Utc>>,
    pub processing_status: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file: FileRecord,
    pub score: f64,
    pub snippet: Option<String>,
    pub highlights: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub file_count: i64,
    pub rules: Option<String>, // JSON array of rules
    pub insights: Option<String>, // JSON object
}

impl Database {
    pub async fn new() -> AppResult<Self> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| AppError::Database("Could not find data directory".to_string()))?;
        
        let db_dir = data_dir.join("metamind");
        tokio::fs::create_dir_all(&db_dir).await?;
        
        let db_path = db_dir.join("metamind.db");
        let database_url = format!("sqlite:{}", db_path.display());
        
        let pool = SqlitePool::connect(&database_url).await?;
        
        let database = Self { pool };
        database.run_migrations().await?;
        
        Ok(database)
    }

    async fn run_migrations(&self) -> AppResult<()> {
        // Create files table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                extension TEXT,
                size INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                last_accessed TEXT,
                mime_type TEXT,
                hash TEXT,
                tags TEXT, -- JSON array
                metadata TEXT, -- JSON object
                ai_analysis TEXT, -- JSON object
                embedding BLOB, -- Serialized vector
                indexed_at TEXT,
                processing_status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT
            );
            "#
        )
        .execute(&self.pool)
        .await?;

        // Create FTS table for full-text search
        sqlx::query(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                id,
                name,
                content,
                tags,
                metadata,
                ai_analysis,
                content='files',
                content_rowid='rowid'
            );
            "#
        )
        .execute(&self.pool)
        .await?;

        // Create collections table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                file_count INTEGER NOT NULL DEFAULT 0,
                rules TEXT, -- JSON array
                insights TEXT -- JSON object
            );
            "#
        )
        .execute(&self.pool)
        .await?;

        // Create collection_files junction table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS collection_files (
                collection_id TEXT NOT NULL,
                file_id TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (collection_id, file_id),
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
            );
            "#
        )
        .execute(&self.pool)
        .await?;

        // Create indexes
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);")
            .execute(&self.pool)
            .await?;
        
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_files_modified_at ON files(modified_at);")
            .execute(&self.pool)
            .await?;
        
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_files_processing_status ON files(processing_status);")
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn insert_file(&self, file: &FileRecord) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO files (
                id, path, name, extension, size, created_at, modified_at, 
                last_accessed, mime_type, hash, tags, metadata, ai_analysis, 
                embedding, indexed_at, processing_status, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&file.id)
        .bind(&file.path)
        .bind(&file.name)
        .bind(&file.extension)
        .bind(file.size)
        .bind(file.created_at.to_rfc3339())
        .bind(file.modified_at.to_rfc3339())
        .bind(file.last_accessed.map(|t| t.to_rfc3339()))
        .bind(&file.mime_type)
        .bind(&file.hash)
        .bind(&file.tags)
        .bind(&file.metadata)
        .bind(&file.ai_analysis)
        .bind(&file.embedding)
        .bind(file.indexed_at.map(|t| t.to_rfc3339()))
        .bind(&file.processing_status)
        .bind(&file.error_message)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_file_by_path(&self, path: &str) -> AppResult<Option<FileRecord>> {
        let file = sqlx::query_as::<_, FileRecord>(
            "SELECT * FROM files WHERE path = ?"
        )
        .bind(path)
        .fetch_optional(&self.pool)
        .await?;

        Ok(file)
    }

    pub async fn get_file_by_id(&self, id: &str) -> AppResult<Option<FileRecord>> {
        let file = sqlx::query_as::<_, FileRecord>(
            "SELECT * FROM files WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(file)
    }

    pub async fn search_files(&self, query: &str, limit: Option<usize>) -> AppResult<Vec<FileRecord>> {
        let limit = limit.unwrap_or(100);
        
        let files = sqlx::query_as::<_, FileRecord>(
            r#"
            SELECT f.* FROM files f
            JOIN files_fts fts ON f.id = fts.id
            WHERE files_fts MATCH ?
            ORDER BY bm25(files_fts) DESC
            LIMIT ?
            "#
        )
        .bind(query)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;

        Ok(files)
    }

    pub async fn get_files_by_status(&self, status: &str) -> AppResult<Vec<FileRecord>> {
        let files = sqlx::query_as::<_, FileRecord>(
            "SELECT * FROM files WHERE processing_status = ?"
        )
        .bind(status)
        .fetch_all(&self.pool)
        .await?;

        Ok(files)
    }

    pub async fn update_file_status(&self, id: &str, status: &str, error: Option<&str>) -> AppResult<()> {
        sqlx::query(
            "UPDATE files SET processing_status = ?, error_message = ? WHERE id = ?"
        )
        .bind(status)
        .bind(error)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn update_file_ai_analysis(&self, id: &str, analysis: &str, embedding: Option<&[u8]>) -> AppResult<()> {
        sqlx::query(
            "UPDATE files SET ai_analysis = ?, embedding = ?, indexed_at = ?, processing_status = 'completed' WHERE id = ?"
        )
        .bind(analysis)
        .bind(embedding)
        .bind(Utc::now().to_rfc3339())
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_file(&self, id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM files WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_statistics(&self) -> AppResult<serde_json::Value> {
        let total_files: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM files")
            .fetch_one(&self.pool)
            .await?;

        let processed_files: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM files WHERE processing_status = 'completed'")
            .fetch_one(&self.pool)
            .await?;

        let pending_files: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM files WHERE processing_status = 'pending'")
            .fetch_one(&self.pool)
            .await?;

        let error_files: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM files WHERE processing_status = 'error'")
            .fetch_one(&self.pool)
            .await?;

        let total_size: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(size), 0) FROM files")
            .fetch_one(&self.pool)
            .await?;

        Ok(serde_json::json!({
            "total_files": total_files,
            "processed_files": processed_files,
            "pending_files": pending_files,
            "error_files": error_files,
            "total_size_bytes": total_size,
            "processing_progress": if total_files > 0 { (processed_files as f64 / total_files as f64) * 100.0 } else { 0.0 }
        }))
    }

    // Collection methods
    pub async fn create_collection(&self, name: &str, description: Option<&str>) -> AppResult<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        sqlx::query(
            "INSERT INTO collections (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(name)
        .bind(description)
        .bind(now.to_rfc3339())
        .bind(now.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    pub async fn get_collections(&self) -> AppResult<Vec<Collection>> {
        let collections = sqlx::query_as::<_, Collection>(
            "SELECT * FROM collections ORDER BY updated_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(collections)
    }
}