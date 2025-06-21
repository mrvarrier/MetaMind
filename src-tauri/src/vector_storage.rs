use anyhow::{Result, anyhow};
use sqlx::{SqlitePool, Row};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use sha2::{Sha256, Digest};

/// Manager for vector storage and retrieval operations
pub struct VectorStorageManager {
    db: SqlitePool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredVector {
    pub id: String,
    pub file_id: String,
    pub vector_type: VectorType,
    pub embedding: Vec<f32>,
    pub dimensions: usize,
    pub model_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VectorType {
    Content,
    Metadata,
    Summary,
}

impl VectorType {
    pub fn as_str(&self) -> &'static str {
        match self {
            VectorType::Content => "content",
            VectorType::Metadata => "metadata", 
            VectorType::Summary => "summary",
        }
    }

    pub fn from_str(s: &str) -> Result<Self> {
        match s {
            "content" => Ok(VectorType::Content),
            "metadata" => Ok(VectorType::Metadata),
            "summary" => Ok(VectorType::Summary),
            _ => Err(anyhow!("Invalid vector type: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVectors {
    pub file_id: String,
    pub content: Option<Vec<f32>>,
    pub metadata: Option<Vec<f32>>,
    pub summary: Option<Vec<f32>>,
    pub model_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderVector {
    pub folder_path: String,
    pub aggregate_vector: Vec<f32>,
    pub theme_vector: Option<Vec<f32>>,
    pub file_count: usize,
    pub total_size: u64,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryVector {
    pub query_text: String,
    pub expanded_query: Option<String>,
    pub vector: Vec<f32>,
    pub model_name: String,
    pub hit_count: u32,
    pub last_used: DateTime<Utc>,
}

impl VectorStorageManager {
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    /// Initialize vector storage schema
    pub async fn initialize(&self) -> Result<()> {
        // Read and execute the vector schema SQL
        let schema_sql = include_str!("database/vector_schema.sql");
        
        // Split by semicolon and execute each statement
        for statement in schema_sql.split(';') {
            let trimmed = statement.trim();
            if !trimmed.is_empty() && !trimmed.starts_with("--") {
                if let Err(e) = sqlx::query(trimmed).execute(&self.db).await {
                    tracing::warn!("Schema statement failed (may be expected): {}", e);
                    // Continue with other statements - some may fail if already exist
                }
            }
        }

        tracing::info!("Vector storage schema initialized");
        Ok(())
    }

    /// Store multiple vector types for a file
    pub async fn store_file_vectors(
        &self,
        file_id: &str,
        content_vector: Option<Vec<f32>>,
        metadata_vector: Option<Vec<f32>>,
        summary_vector: Option<Vec<f32>>,
        model_name: &str,
    ) -> Result<()> {
        let mut tx = self.db.begin().await?;

        // Update main files table
        sqlx::query(
            "UPDATE files SET 
             content_vector = ?, 
             metadata_vector = ?, 
             summary_vector = ?,
             vector_model = ?,
             vector_dimensions = ?,
             vector_created_at = CURRENT_TIMESTAMP
             WHERE id = ?"
        )
        .bind(content_vector.as_ref().map(|v| self.serialize_vector(v)))
        .bind(metadata_vector.as_ref().map(|v| self.serialize_vector(v)))
        .bind(summary_vector.as_ref().map(|v| self.serialize_vector(v)))
        .bind(model_name)
        .bind(content_vector.as_ref().map(|v| v.len() as i32).unwrap_or(0))
        .bind(file_id)
        .execute(&mut *tx)
        .await?;

        // Store in dedicated vector table for faster access
        let vectors = [
            (VectorType::Content, content_vector),
            (VectorType::Metadata, metadata_vector),
            (VectorType::Summary, summary_vector),
        ];

        for (vector_type, vector_opt) in vectors {
            if let Some(vector) = vector_opt {
                let vector_id = Uuid::new_v4().to_string();
                
                sqlx::query(
                    "INSERT OR REPLACE INTO file_vectors 
                     (id, file_id, vector_type, embedding, dimensions, model_name)
                     VALUES (?, ?, ?, ?, ?, ?)"
                )
                .bind(&vector_id)
                .bind(file_id)
                .bind(vector_type.as_str())
                .bind(self.serialize_vector(&vector))
                .bind(vector.len() as i32)
                .bind(model_name)
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;
        tracing::debug!("Stored vectors for file: {}", file_id);
        Ok(())
    }

    /// Retrieve all content vectors for similarity search
    pub async fn get_all_content_vectors(&self) -> Result<Vec<(String, Vec<f32>)>> {
        let rows = sqlx::query(
            "SELECT file_id, embedding FROM file_vectors 
             WHERE vector_type = 'content' AND embedding IS NOT NULL"
        )
        .fetch_all(&self.db)
        .await?;

        let mut vectors = Vec::with_capacity(rows.len());
        
        for row in rows {
            let file_id: String = row.get("file_id");
            let embedding_bytes: Vec<u8> = row.get("embedding");
            
            if let Ok(vector) = self.deserialize_vector(&embedding_bytes) {
                vectors.push((file_id, vector));
            } else {
                tracing::warn!("Failed to deserialize vector for file: {}", file_id);
            }
        }

        Ok(vectors)
    }

    /// Retrieve vectors of specific type
    pub async fn get_vectors_by_type(&self, vector_type: VectorType) -> Result<Vec<(String, Vec<f32>)>> {
        let rows = sqlx::query(
            "SELECT file_id, embedding FROM file_vectors 
             WHERE vector_type = ? AND embedding IS NOT NULL"
        )
        .bind(vector_type.as_str())
        .fetch_all(&self.db)
        .await?;

        let mut vectors = Vec::with_capacity(rows.len());
        
        for row in rows {
            let file_id: String = row.get("file_id");
            let embedding_bytes: Vec<u8> = row.get("embedding");
            
            if let Ok(vector) = self.deserialize_vector(&embedding_bytes) {
                vectors.push((file_id, vector));
            }
        }

        Ok(vectors)
    }

    /// Get comprehensive vectors for a specific file
    pub async fn get_file_vectors(&self, file_id: &str) -> Result<Option<FileVectors>> {
        let row = sqlx::query(
            "SELECT content_vector, metadata_vector, summary_vector, 
             vector_model, vector_created_at
             FROM files WHERE id = ?"
        )
        .bind(file_id)
        .fetch_optional(&self.db)
        .await?;

        if let Some(row) = row {
            let content = self.get_optional_vector(&row, "content_vector")?;
            let metadata = self.get_optional_vector(&row, "metadata_vector")?;
            let summary = self.get_optional_vector(&row, "summary_vector")?;
            let model_name: String = row.get("vector_model");
            let created_at: DateTime<Utc> = row.get("vector_created_at");

            Ok(Some(FileVectors {
                file_id: file_id.to_string(),
                content,
                metadata,
                summary,
                model_name,
                created_at,
            }))
        } else {
            Ok(None)
        }
    }

    /// Store folder aggregate vector
    pub async fn store_folder_vector(
        &self,
        folder_path: &str,
        aggregate_vector: Vec<f32>,
        theme_vector: Option<Vec<f32>>,
        file_count: usize,
        total_size: u64,
        model_name: &str,
    ) -> Result<()> {
        let folder_id = Uuid::new_v4().to_string();
        
        sqlx::query(
            "INSERT OR REPLACE INTO folder_vectors 
             (id, folder_path, aggregate_vector, theme_vector, file_count, total_size, vector_model, dimensions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&folder_id)
        .bind(folder_path)
        .bind(self.serialize_vector(&aggregate_vector))
        .bind(theme_vector.as_ref().map(|v| self.serialize_vector(v)))
        .bind(file_count as i32)
        .bind(total_size as i64)
        .bind(model_name)
        .bind(aggregate_vector.len() as i32)
        .execute(&self.db)
        .await?;

        tracing::debug!("Stored folder vector for: {}", folder_path);
        Ok(())
    }

    /// Get all folder vectors for similarity search
    pub async fn get_all_folder_vectors(&self) -> Result<Vec<(String, Vec<f32>)>> {
        let rows = sqlx::query(
            "SELECT folder_path, aggregate_vector FROM folder_vectors 
             WHERE aggregate_vector IS NOT NULL"
        )
        .fetch_all(&self.db)
        .await?;

        let mut vectors = Vec::with_capacity(rows.len());
        
        for row in rows {
            let folder_path: String = row.get("folder_path");
            let embedding_bytes: Vec<u8> = row.get("aggregate_vector");
            
            if let Ok(vector) = self.deserialize_vector(&embedding_bytes) {
                vectors.push((folder_path, vector));
            }
        }

        Ok(vectors)
    }

    /// Get or create query vector with caching
    pub async fn get_or_create_query_vector(
        &self,
        query: &str,
        expanded_query: Option<String>,
        vector_generator: impl std::future::Future<Output = Result<Vec<f32>>>,
        model_name: &str,
    ) -> Result<Vec<f32>> {
        let query_hash = self.hash_query(query);

        // Try to get from cache first
        if let Some(cached_vector) = self.get_cached_query_vector(&query_hash).await? {
            // Update hit count
            self.update_query_cache_usage(&query_hash).await?;
            return Ok(cached_vector);
        }

        // Generate new vector
        let vector = vector_generator.await?;

        // Store in cache
        self.store_query_vector(query, &expanded_query, &vector, model_name).await?;

        Ok(vector)
    }

    /// Get cached query vector
    async fn get_cached_query_vector(&self, query_hash: &str) -> Result<Option<Vec<f32>>> {
        let row = sqlx::query(
            "SELECT query_vector FROM query_vector_cache WHERE query_hash = ?"
        )
        .bind(query_hash)
        .fetch_optional(&self.db)
        .await?;

        if let Some(row) = row {
            let embedding_bytes: Vec<u8> = row.get("query_vector");
            let vector = self.deserialize_vector(&embedding_bytes)?;
            Ok(Some(vector))
        } else {
            Ok(None)
        }
    }

    /// Store query vector in cache
    async fn store_query_vector(
        &self,
        query: &str,
        expanded_query: &Option<String>,
        vector: &[f32],
        model_name: &str,
    ) -> Result<()> {
        let query_hash = self.hash_query(query);
        let cache_id = Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT OR REPLACE INTO query_vector_cache 
             (id, query_hash, query_text, query_vector, expanded_query, vector_model, dimensions)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&cache_id)
        .bind(&query_hash)
        .bind(query)
        .bind(self.serialize_vector(vector))
        .bind(expanded_query)
        .bind(model_name)
        .bind(vector.len() as i32)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Update query cache usage statistics
    async fn update_query_cache_usage(&self, query_hash: &str) -> Result<()> {
        sqlx::query(
            "UPDATE query_vector_cache 
             SET hit_count = hit_count + 1, last_used = CURRENT_TIMESTAMP 
             WHERE query_hash = ?"
        )
        .bind(query_hash)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Clean up old cache entries
    pub async fn cleanup_cache(&self, max_entries: usize, max_age_days: u32) -> Result<usize> {
        // Delete entries older than max_age_days
        let deleted_old = sqlx::query(
            "DELETE FROM query_vector_cache 
             WHERE created_at < datetime('now', '-' || ? || ' days')"
        )
        .bind(max_age_days)
        .execute(&self.db)
        .await?
        .rows_affected();

        // Keep only top max_entries by usage
        let deleted_excess = sqlx::query(
            "DELETE FROM query_vector_cache 
             WHERE id NOT IN (
                 SELECT id FROM query_vector_cache 
                 ORDER BY hit_count DESC, last_used DESC 
                 LIMIT ?
             )"
        )
        .bind(max_entries as i32)
        .execute(&self.db)
        .await?
        .rows_affected();

        let total_deleted = deleted_old + deleted_excess;
        if total_deleted > 0 {
            tracing::info!("Cleaned up {} cache entries", total_deleted);
        }

        Ok(total_deleted as usize)
    }

    /// Get files that have specific vector types
    pub async fn get_files_with_vectors(&self, vector_types: &[VectorType]) -> Result<Vec<String>> {
        let type_conditions: Vec<String> = vector_types.iter()
            .map(|vt| format!("{}_vector IS NOT NULL", vt.as_str()))
            .collect();
        
        let where_clause = type_conditions.join(" AND ");
        let query = format!("SELECT id FROM files WHERE {}", where_clause);

        let rows = sqlx::query(&query)
            .fetch_all(&self.db)
            .await?;

        Ok(rows.into_iter().map(|row| row.get("id")).collect())
    }

    /// Get vector processing statistics
    pub async fn get_vector_statistics(&self) -> Result<VectorStatistics> {
        let total_files = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files")
            .fetch_one(&self.db)
            .await? as usize;

        let files_with_content_vectors = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM files WHERE content_vector IS NOT NULL"
        )
        .fetch_one(&self.db)
        .await? as usize;

        let files_with_any_vectors = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM files WHERE content_vector IS NOT NULL 
             OR metadata_vector IS NOT NULL OR summary_vector IS NOT NULL"
        )
        .fetch_one(&self.db)
        .await? as usize;

        let total_folder_vectors = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM folder_vectors"
        )
        .fetch_one(&self.db)
        .await? as usize;

        let cache_entries = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM query_vector_cache"
        )
        .fetch_one(&self.db)
        .await? as usize;

        Ok(VectorStatistics {
            total_files,
            files_with_content_vectors,
            files_with_any_vectors,
            total_folder_vectors,
            cache_entries,
            vectorization_coverage: if total_files > 0 {
                files_with_any_vectors as f32 / total_files as f32
            } else {
                0.0
            },
        })
    }

    /// Helper: Serialize vector to bytes
    fn serialize_vector(&self, vector: &[f32]) -> Vec<u8> {
        vector.iter()
            .flat_map(|&f| f.to_le_bytes())
            .collect()
    }

    /// Helper: Deserialize vector from bytes
    fn deserialize_vector(&self, bytes: &[u8]) -> Result<Vec<f32>> {
        if bytes.len() % 4 != 0 {
            return Err(anyhow!("Invalid vector byte length: {}", bytes.len()));
        }

        let mut vector = Vec::with_capacity(bytes.len() / 4);
        
        for chunk in bytes.chunks_exact(4) {
            let bytes_array: [u8; 4] = chunk.try_into()
                .map_err(|_| anyhow!("Failed to convert bytes to f32"))?;
            vector.push(f32::from_le_bytes(bytes_array));
        }

        Ok(vector)
    }

    /// Helper: Get optional vector from row
    fn get_optional_vector(&self, row: &sqlx::sqlite::SqliteRow, column: &str) -> Result<Option<Vec<f32>>> {
        let bytes_opt: Option<Vec<u8>> = row.get(column);
        
        if let Some(bytes) = bytes_opt {
            Ok(Some(self.deserialize_vector(&bytes)?))
        } else {
            Ok(None)
        }
    }

    /// Helper: Generate hash for query caching
    fn hash_query(&self, query: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(query.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorStatistics {
    pub total_files: usize,
    pub files_with_content_vectors: usize,
    pub files_with_any_vectors: usize,
    pub total_folder_vectors: usize,
    pub cache_entries: usize,
    pub vectorization_coverage: f32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        
        // Create basic files table for testing
        sqlx::query(
            "CREATE TABLE files (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                name TEXT NOT NULL,
                size INTEGER,
                modified_at TIMESTAMP
            )"
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_vector_serialization() {
        let pool = setup_test_db().await;
        let storage = VectorStorageManager::new(pool);

        let original_vector = vec![1.0, -2.5, 3.14, 0.0];
        let serialized = storage.serialize_vector(&original_vector);
        let deserialized = storage.deserialize_vector(&serialized).unwrap();

        assert_eq!(original_vector, deserialized);
    }

    #[tokio::test]
    async fn test_query_hash() {
        let pool = setup_test_db().await;
        let storage = VectorStorageManager::new(pool);

        let hash1 = storage.hash_query("test query");
        let hash2 = storage.hash_query("test query");
        let hash3 = storage.hash_query("different query");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }
}