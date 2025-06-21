use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::time::Instant;

use crate::vector_storage::VectorStorageManager;
use crate::semantic_search::SearchResponse;

/// High-performance vector cache system for MetaMind
#[derive(Debug)]
pub struct VectorCache {
    // In-memory vector cache
    vector_cache: Arc<RwLock<HashMap<String, CachedVector>>>,
    
    // Search results cache
    search_cache: Arc<RwLock<HashMap<String, CachedSearchResult>>>,
    
    // Query vector cache
    query_cache: Arc<RwLock<HashMap<String, CachedQueryVector>>>,
    
    // Configuration
    config: VectorCacheConfig,
    
    // Statistics
    stats: Arc<RwLock<CacheStatistics>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorCacheConfig {
    pub max_vectors: usize,
    pub max_search_results: usize,
    pub max_query_vectors: usize,
    pub vector_ttl_seconds: u64,
    pub search_ttl_seconds: u64,
    pub query_ttl_seconds: u64,
    pub enable_compression: bool,
    pub enable_prefetching: bool,
    pub batch_size: usize,
}

impl Default for VectorCacheConfig {
    fn default() -> Self {
        Self {
            max_vectors: 10000,
            max_search_results: 1000,
            max_query_vectors: 500,
            vector_ttl_seconds: 3600, // 1 hour
            search_ttl_seconds: 300,  // 5 minutes
            query_ttl_seconds: 1800,  // 30 minutes
            enable_compression: true,
            enable_prefetching: true,
            batch_size: 100,
        }
    }
}

#[derive(Debug, Clone)]
struct CachedVector {
    vector: Vec<f32>,
    file_id: String,
    vector_type: String,
    created_at: DateTime<Utc>,
    last_accessed: DateTime<Utc>,
    access_count: u64,
    compressed: bool,
}

#[derive(Debug, Clone)]
struct CachedSearchResult {
    response: SearchResponse,
    query_hash: String,
    created_at: DateTime<Utc>,
    last_accessed: DateTime<Utc>,
    access_count: u64,
}

#[derive(Debug, Clone)]
struct CachedQueryVector {
    vector: Vec<f32>,
    query: String,
    expanded_query: Option<String>,
    created_at: DateTime<Utc>,
    last_accessed: DateTime<Utc>,
    access_count: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CacheStatistics {
    pub vector_cache_hits: u64,
    pub vector_cache_misses: u64,
    pub search_cache_hits: u64,
    pub search_cache_misses: u64,
    pub query_cache_hits: u64,
    pub query_cache_misses: u64,
    pub total_vectors_cached: usize,
    pub total_searches_cached: usize,
    pub total_queries_cached: usize,
    pub memory_usage_mb: f64,
    pub average_vector_access_time_ms: f64,
    pub cache_efficiency: f64,
}

impl VectorCache {
    pub fn new(config: VectorCacheConfig) -> Self {
        Self {
            vector_cache: Arc::new(RwLock::new(HashMap::new())),
            search_cache: Arc::new(RwLock::new(HashMap::new())),
            query_cache: Arc::new(RwLock::new(HashMap::new())),
            config,
            stats: Arc::new(RwLock::new(CacheStatistics::default())),
        }
    }

    /// Get vector from cache
    pub async fn get_vector(&self, file_id: &str, vector_type: &str) -> Option<Vec<f32>> {
        let start = Instant::now();
        let cache_key = format!("{}:{}", file_id, vector_type);
        
        let mut cache = self.vector_cache.write().await;
        let mut stats = self.stats.write().await;
        
        if let Some(cached) = cache.get(&cache_key) {
            // Check TTL
            let age = Utc::now().signed_duration_since(cached.created_at);
            if age.num_seconds() as u64 > self.config.vector_ttl_seconds {
                cache.remove(&cache_key);
                stats.vector_cache_misses += 1;
                return None;
            }
            
            // Update access stats
            let mut updated = cached.clone();
            updated.last_accessed = Utc::now();
            updated.access_count += 1;
            cache.insert(cache_key, updated.clone());
            
            stats.vector_cache_hits += 1;
            stats.average_vector_access_time_ms = 
                (stats.average_vector_access_time_ms + start.elapsed().as_millis() as f64) / 2.0;
            
            Some(self.decompress_vector_if_needed(&updated.vector, updated.compressed))
        } else {
            stats.vector_cache_misses += 1;
            None
        }
    }

    /// Store vector in cache
    pub async fn store_vector(&self, file_id: &str, vector_type: &str, vector: Vec<f32>) {
        let cache_key = format!("{}:{}", file_id, vector_type);
        let compressed_vector = if self.config.enable_compression {
            self.compress_vector(&vector)
        } else {
            vector.clone()
        };
        
        let cached = CachedVector {
            vector: compressed_vector,
            file_id: file_id.to_string(),
            vector_type: vector_type.to_string(),
            created_at: Utc::now(),
            last_accessed: Utc::now(),
            access_count: 1,
            compressed: self.config.enable_compression,
        };
        
        let mut cache = self.vector_cache.write().await;
        
        // Simple eviction if over capacity
        if cache.len() >= self.config.max_vectors {
            // Remove oldest entry (simple eviction)
            if let Some(oldest_key) = self.find_oldest_cache_entry(&cache).await {
                cache.remove(&oldest_key);
            }
        }
        
        cache.insert(cache_key, cached);
        
        let mut stats = self.stats.write().await;
        stats.total_vectors_cached = cache.len();
    }

    /// Get search results from cache
    pub async fn get_search_result(&self, query_hash: &str) -> Option<SearchResponse> {
        let mut cache = self.search_cache.write().await;
        let mut stats = self.stats.write().await;
        
        if let Some(cached) = cache.get(query_hash) {
            // Check TTL
            let age = Utc::now().signed_duration_since(cached.created_at);
            if age.num_seconds() as u64 > self.config.search_ttl_seconds {
                cache.remove(query_hash);
                stats.search_cache_misses += 1;
                return None;
            }
            
            // Update access stats
            let mut updated = cached.clone();
            updated.last_accessed = Utc::now();
            updated.access_count += 1;
            cache.insert(query_hash.to_string(), updated.clone());
            
            stats.search_cache_hits += 1;
            Some(updated.response)
        } else {
            stats.search_cache_misses += 1;
            None
        }
    }

    /// Store search results in cache
    pub async fn store_search_result(&self, query_hash: &str, response: SearchResponse) {
        let cached = CachedSearchResult {
            response,
            query_hash: query_hash.to_string(),
            created_at: Utc::now(),
            last_accessed: Utc::now(),
            access_count: 1,
        };
        
        let mut cache = self.search_cache.write().await;
        
        // Simple eviction if over capacity
        if cache.len() >= self.config.max_search_results {
            if let Some(oldest_key) = self.find_oldest_search_entry(&cache).await {
                cache.remove(&oldest_key);
            }
        }
        
        cache.insert(query_hash.to_string(), cached);
        
        let mut stats = self.stats.write().await;
        stats.total_searches_cached = cache.len();
    }

    /// Get query vector from cache
    pub async fn get_query_vector(&self, query: &str) -> Option<Vec<f32>> {
        let query_hash = self.hash_query(query);
        let mut cache = self.query_cache.write().await;
        let mut stats = self.stats.write().await;
        
        if let Some(cached) = cache.get(&query_hash) {
            // Check TTL
            let age = Utc::now().signed_duration_since(cached.created_at);
            if age.num_seconds() as u64 > self.config.query_ttl_seconds {
                cache.remove(&query_hash);
                stats.query_cache_misses += 1;
                return None;
            }
            
            // Update access stats
            let mut updated = cached.clone();
            updated.last_accessed = Utc::now();
            updated.access_count += 1;
            cache.insert(query_hash.clone(), updated.clone());
            
            stats.query_cache_hits += 1;
            Some(updated.vector)
        } else {
            stats.query_cache_misses += 1;
            None
        }
    }

    /// Store query vector in cache
    pub async fn store_query_vector(&self, query: &str, vector: Vec<f32>, expanded_query: Option<String>) {
        let query_hash = self.hash_query(query);
        let cached = CachedQueryVector {
            vector,
            query: query.to_string(),
            expanded_query,
            created_at: Utc::now(),
            last_accessed: Utc::now(),
            access_count: 1,
        };
        
        let mut cache = self.query_cache.write().await;
        
        // Simple eviction if over capacity
        if cache.len() >= self.config.max_query_vectors {
            if let Some(oldest_key) = self.find_oldest_query_entry(&cache).await {
                cache.remove(&oldest_key);
            }
        }
        
        cache.insert(query_hash, cached);
        
        let mut stats = self.stats.write().await;
        stats.total_queries_cached = cache.len();
    }

    /// Prefetch related vectors for better performance
    pub async fn prefetch_related_vectors(&self, file_ids: &[String], vector_storage: &VectorStorageManager) {
        if !self.config.enable_prefetching {
            return;
        }

        let mut missing_vectors = Vec::new();
        
        // Check which vectors are not in cache
        for file_id in file_ids {
            for vector_type in &["content", "metadata", "summary"] {
                if self.get_vector(file_id, vector_type).await.is_none() {
                    missing_vectors.push((file_id.clone(), vector_type.to_string()));
                }
            }
        }

        // Batch load missing vectors
        for chunk in missing_vectors.chunks(self.config.batch_size) {
            let mut futures = Vec::new();
            
            for (file_id, vector_type) in chunk {
                let storage = vector_storage.clone();
                let fid = file_id.clone();
                let vtype = vector_type.clone();
                
                let future = async move {
                    // In a real implementation, you'd have a batch get method
                    // For now, this is a placeholder
                    (fid, vtype, Vec::<f32>::new()) // Placeholder empty vector
                };
                
                futures.push(future);
            }

            // For now, just handle one at a time to avoid futures dependency
            for future in futures {
                let result = future.await;
                if !result.2.is_empty() {
                    self.store_vector(&result.0, &result.1, result.2).await;
                }
            }
        }
    }

    /// Clean up expired cache entries
    pub async fn cleanup_expired(&self) {
        let now = Utc::now();
        
        // Clean vector cache
        {
            let mut cache = self.vector_cache.write().await;
            let expired_keys: Vec<String> = cache.iter()
                .filter_map(|(key, cached)| {
                    let age = now.signed_duration_since(cached.created_at);
                    if age.num_seconds() as u64 > self.config.vector_ttl_seconds {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect();
            
            for key in expired_keys {
                cache.remove(&key);
            }
        }
        
        // Clean search cache
        {
            let mut cache = self.search_cache.write().await;
            let expired_keys: Vec<String> = cache.iter()
                .filter_map(|(key, cached)| {
                    let age = now.signed_duration_since(cached.created_at);
                    if age.num_seconds() as u64 > self.config.search_ttl_seconds {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect();
            
            for key in expired_keys {
                cache.remove(&key);
            }
        }
        
        // Clean query cache
        {
            let mut cache = self.query_cache.write().await;
            let expired_keys: Vec<String> = cache.iter()
                .filter_map(|(key, cached)| {
                    let age = now.signed_duration_since(cached.created_at);
                    if age.num_seconds() as u64 > self.config.query_ttl_seconds {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect();
            
            for key in expired_keys {
                cache.remove(&key);
            }
        }
        
        tracing::debug!("Cache cleanup completed");
    }

    /// Get cache statistics
    pub async fn get_statistics(&self) -> CacheStatistics {
        let mut stats = self.stats.read().await.clone();
        
        // Calculate cache efficiency
        let total_hits = stats.vector_cache_hits + stats.search_cache_hits + stats.query_cache_hits;
        let total_requests = total_hits + stats.vector_cache_misses + stats.search_cache_misses + stats.query_cache_misses;
        
        stats.cache_efficiency = if total_requests > 0 {
            total_hits as f64 / total_requests as f64
        } else {
            0.0
        };
        
        // Estimate memory usage (rough calculation)
        let vector_cache_size = self.vector_cache.read().await.len();
        let search_cache_size = self.search_cache.read().await.len();
        let query_cache_size = self.query_cache.read().await.len();
        
        // Rough memory estimation (768 dimensions * 4 bytes per f32 + overhead)
        stats.memory_usage_mb = (
            vector_cache_size * 768 * 4 +
            search_cache_size * 1024 +  // Rough estimate for search results
            query_cache_size * 768 * 4
        ) as f64 / (1024.0 * 1024.0);
        
        stats
    }

    /// Clear all caches
    pub async fn clear_all(&self) {
        let mut vector_cache = self.vector_cache.write().await;
        let mut search_cache = self.search_cache.write().await;
        let mut query_cache = self.query_cache.write().await;
        
        vector_cache.clear();
        search_cache.clear();
        query_cache.clear();
        
        let mut stats = self.stats.write().await;
        *stats = CacheStatistics::default();
        
        tracing::info!("All caches cleared");
    }

    /// Compress vector for storage (simple implementation)
    fn compress_vector(&self, vector: &[f32]) -> Vec<f32> {
        // For now, return as-is. In production, you could implement:
        // - Quantization (f32 -> u8/u16)
        // - Compression algorithms
        // - Dimensionality reduction
        vector.to_vec()
    }

    /// Decompress vector if needed
    fn decompress_vector_if_needed(&self, vector: &[f32], _compressed: bool) -> Vec<f32> {
        // For now, return as-is
        vector.to_vec()
    }

    /// Find oldest cache entry for eviction
    async fn find_oldest_cache_entry(&self, cache: &HashMap<String, CachedVector>) -> Option<String> {
        cache.iter()
            .min_by_key(|(_, cached)| cached.last_accessed)
            .map(|(key, _)| key.clone())
    }

    /// Find oldest search cache entry for eviction
    async fn find_oldest_search_entry(&self, cache: &HashMap<String, CachedSearchResult>) -> Option<String> {
        cache.iter()
            .min_by_key(|(_, cached)| cached.last_accessed)
            .map(|(key, _)| key.clone())
    }

    /// Find oldest query cache entry for eviction
    async fn find_oldest_query_entry(&self, cache: &HashMap<String, CachedQueryVector>) -> Option<String> {
        cache.iter()
            .min_by_key(|(_, cached)| cached.last_accessed)
            .map(|(key, _)| key.clone())
    }

    /// Generate hash for query
    fn hash_query(&self, query: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(query.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

/// Background cache management task
pub struct CacheManager {
    cache: Arc<VectorCache>,
    cleanup_interval_seconds: u64,
}

impl CacheManager {
    pub fn new(cache: Arc<VectorCache>, cleanup_interval_seconds: u64) -> Self {
        Self {
            cache,
            cleanup_interval_seconds,
        }
    }

    /// Start background cache management
    pub async fn start(&self) {
        let cache = Arc::clone(&self.cache);
        let interval = self.cleanup_interval_seconds;
        
        tokio::spawn(async move {
            let mut cleanup_timer = tokio::time::interval(
                tokio::time::Duration::from_secs(interval)
            );
            
            loop {
                cleanup_timer.tick().await;
                cache.cleanup_expired().await;
                
                let stats = cache.get_statistics().await;
                tracing::debug!("Cache stats - Efficiency: {:.2}%, Memory: {:.2}MB, Vectors: {}", 
                    stats.cache_efficiency * 100.0,
                    stats.memory_usage_mb,
                    stats.total_vectors_cached
                );
            }
        });
        
        tracing::info!("Cache manager started with {}s cleanup interval", self.cleanup_interval_seconds);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_vector_cache() {
        let config = VectorCacheConfig::default();
        let cache = VectorCache::new(config);
        
        let vector = vec![1.0, 2.0, 3.0];
        cache.store_vector("file1", "content", vector.clone()).await;
        
        let retrieved = cache.get_vector("file1", "content").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), vector);
        
        let stats = cache.get_statistics().await;
        assert_eq!(stats.vector_cache_hits, 1);
    }

    #[tokio::test]
    async fn test_query_cache() {
        let config = VectorCacheConfig::default();
        let cache = VectorCache::new(config);
        
        let query = "test query";
        let vector = vec![1.0, 2.0, 3.0];
        
        cache.store_query_vector(query, vector.clone(), None).await;
        
        let retrieved = cache.get_query_vector(query).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), vector);
        
        let stats = cache.get_statistics().await;
        assert_eq!(stats.query_cache_hits, 1);
    }

    #[tokio::test]
    async fn test_cache_cleanup() {
        let mut config = VectorCacheConfig::default();
        config.vector_ttl_seconds = 0; // Immediate expiry
        
        let cache = VectorCache::new(config);
        
        let vector = vec![1.0, 2.0, 3.0];
        cache.store_vector("file1", "content", vector.clone()).await;
        
        // Wait a bit for expiry
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        
        cache.cleanup_expired().await;
        
        let retrieved = cache.get_vector("file1", "content").await;
        assert!(retrieved.is_none());
    }
}