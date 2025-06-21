use anyhow::{Result, anyhow};
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

use crate::vector_math::VectorMath;
use crate::vector_storage::{VectorStorageManager, VectorType};
use crate::ai_processor::AIProcessor;
use crate::content_extractor::ExtractedContent;

/// Advanced semantic search engine with vector capabilities
pub struct SemanticSearchEngine {
    vector_storage: VectorStorageManager,
    ai_processor: AIProcessor,
    config: SearchConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    pub similarity_threshold: f32,
    pub max_results: usize,
    pub enable_hybrid_search: bool,
    pub enable_folder_search: bool,
    pub enable_query_expansion: bool,
    pub content_weight: f32,
    pub metadata_weight: f32,
    pub summary_weight: f32,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            similarity_threshold: 0.7,
            max_results: 50,
            enable_hybrid_search: true,
            enable_folder_search: true,
            enable_query_expansion: true,
            content_weight: 0.6,
            metadata_weight: 0.2,
            summary_weight: 0.2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_id: String,
    pub file_path: String,
    pub file_name: String,
    pub similarity_score: f32,
    pub match_type: MatchType,
    pub snippet: Option<String>,
    pub highlights: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub last_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderSearchResult {
    pub folder_path: String,
    pub similarity_score: f32,
    pub file_count: usize,
    pub total_size: u64,
    pub representative_files: Vec<String>,
    pub theme_description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MatchType {
    SemanticContent,
    SemanticMetadata,
    SemanticSummary,
    HybridMatch,
    FolderTheme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub search_type: SearchType,
    pub filters: Option<SearchFilters>,
    pub limit: Option<usize>,
    pub threshold: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchType {
    Semantic,
    Hybrid,
    FolderOnly,
    ContentOnly,
    MetadataOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub file_types: Option<Vec<String>>,
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    pub size_range: Option<(u64, u64)>,
    pub categories: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub folder_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    pub expanded_query: Option<String>,
    pub total_results: usize,
    pub search_time_ms: u128,
    pub results: Vec<SearchResult>,
    pub folder_results: Vec<FolderSearchResult>,
    pub suggestions: Vec<String>,
    pub facets: SearchFacets,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFacets {
    pub file_types: HashMap<String, usize>,
    pub categories: HashMap<String, usize>,
    pub date_ranges: HashMap<String, usize>,
    pub size_ranges: HashMap<String, usize>,
}

impl SemanticSearchEngine {
    pub fn new(vector_storage: VectorStorageManager, ai_processor: AIProcessor) -> Self {
        Self {
            vector_storage,
            ai_processor,
            config: SearchConfig::default(),
        }
    }

    pub fn with_config(mut self, config: SearchConfig) -> Self {
        self.config = config;
        self
    }

    /// Perform comprehensive semantic search
    pub async fn search(&self, request: SearchRequest) -> Result<SearchResponse> {
        let start_time = std::time::Instant::now();
        
        // Expand query if enabled
        let expanded_query = if self.config.enable_query_expansion {
            self.expand_query(&request.query).await.ok()
        } else {
            None
        };

        // Generate query vector with caching
        let query_vector = self.vector_storage.get_or_create_query_vector(
            &request.query,
            expanded_query.clone(),
            self.generate_query_vector(&request.query),
            "nomic-embed-text", // TODO: Make configurable
        ).await?;

        // Perform search based on type
        let (mut results, folder_results) = match request.search_type {
            SearchType::Semantic => {
                let files = self.semantic_search(&query_vector, &request).await?;
                let folders = if self.config.enable_folder_search {
                    self.folder_search(&query_vector, &request).await?
                } else {
                    Vec::new()
                };
                (files, folders)
            },
            SearchType::Hybrid => {
                self.hybrid_search(&query_vector, &request).await?
            },
            SearchType::FolderOnly => {
                let folders = self.folder_search(&query_vector, &request).await?;
                (Vec::new(), folders)
            },
            SearchType::ContentOnly => {
                let files = self.content_only_search(&query_vector, &request).await?;
                (files, Vec::new())
            },
            SearchType::MetadataOnly => {
                let files = self.metadata_only_search(&query_vector, &request).await?;
                (files, Vec::new())
            },
        };

        // Apply filters
        if let Some(filters) = &request.filters {
            results = self.apply_filters(results, filters).await?;
        }

        // Limit results
        let limit = request.limit.unwrap_or(self.config.max_results);
        results.truncate(limit);

        // Generate suggestions and facets
        let suggestions = self.generate_suggestions(&request.query, &results).await?;
        let facets = self.generate_facets(&results).await?;

        let search_time = start_time.elapsed().as_millis();

        Ok(SearchResponse {
            query: request.query,
            expanded_query,
            total_results: results.len(),
            search_time_ms: search_time,
            results,
            folder_results,
            suggestions,
            facets,
        })
    }

    /// Generate comprehensive vectors for content
    pub async fn generate_content_vectors(&self, content: &ExtractedContent) -> Result<(Option<Vec<f32>>, Option<Vec<f32>>, Option<Vec<f32>>)> {
        // Generate content vector from main text
        let content_vector = if !content.text.trim().is_empty() {
            Some(self.ai_processor.generate_embedding(&content.text).await?)
        } else {
            None
        };

        // Generate metadata vector from structured metadata
        let metadata_vector = if self.has_meaningful_metadata(content) {
            let metadata_text = self.serialize_metadata_for_embedding(content);
            Some(self.ai_processor.generate_embedding(&metadata_text).await?)
        } else {
            None
        };

        // Generate summary vector if content is substantial
        let summary_vector = if content.text.len() > 500 {
            match self.generate_content_summary(&content.text).await {
                Ok(summary) => Some(self.ai_processor.generate_embedding(&summary).await?),
                Err(_) => None,
            }
        } else {
            None
        };

        Ok((content_vector, metadata_vector, summary_vector))
    }

    /// Perform pure semantic search using vector similarity
    async fn semantic_search(&self, query_vector: &[f32], request: &SearchRequest) -> Result<Vec<SearchResult>> {
        let threshold = request.threshold.unwrap_or(self.config.similarity_threshold);
        let limit = request.limit.unwrap_or(self.config.max_results);

        let mut all_results = Vec::new();

        // Search content vectors
        if self.config.content_weight > 0.0 {
            let content_vectors = self.vector_storage.get_vectors_by_type(VectorType::Content).await?;
            let content_matches = VectorMath::find_similar_vectors(
                query_vector,
                &content_vectors,
                limit,
                threshold,
            )?;

            for (file_id, score) in content_matches {
                all_results.push(SearchResult {
                    file_id: file_id.clone(),
                    file_path: String::new(), // Will be filled by file lookup
                    file_name: String::new(),
                    similarity_score: score * self.config.content_weight,
                    match_type: MatchType::SemanticContent,
                    snippet: None,
                    highlights: Vec::new(),
                    metadata: HashMap::new(),
                    last_modified: Utc::now(),
                });
            }
        }

        // Search metadata vectors
        if self.config.metadata_weight > 0.0 {
            let metadata_vectors = self.vector_storage.get_vectors_by_type(VectorType::Metadata).await?;
            let metadata_matches = VectorMath::find_similar_vectors(
                query_vector,
                &metadata_vectors,
                limit,
                threshold,
            )?;

            for (file_id, score) in metadata_matches {
                // Check if this file already has a result
                if let Some(existing) = all_results.iter_mut().find(|r| r.file_id == file_id) {
                    // Combine scores
                    existing.similarity_score += score * self.config.metadata_weight;
                    existing.match_type = MatchType::HybridMatch;
                } else {
                    all_results.push(SearchResult {
                        file_id: file_id.clone(),
                        file_path: String::new(),
                        file_name: String::new(),
                        similarity_score: score * self.config.metadata_weight,
                        match_type: MatchType::SemanticMetadata,
                        snippet: None,
                        highlights: Vec::new(),
                        metadata: HashMap::new(),
                        last_modified: Utc::now(),
                    });
                }
            }
        }

        // Search summary vectors
        if self.config.summary_weight > 0.0 {
            let summary_vectors = self.vector_storage.get_vectors_by_type(VectorType::Summary).await?;
            let summary_matches = VectorMath::find_similar_vectors(
                query_vector,
                &summary_vectors,
                limit,
                threshold,
            )?;

            for (file_id, score) in summary_matches {
                if let Some(existing) = all_results.iter_mut().find(|r| r.file_id == file_id) {
                    existing.similarity_score += score * self.config.summary_weight;
                    existing.match_type = MatchType::HybridMatch;
                } else {
                    all_results.push(SearchResult {
                        file_id: file_id.clone(),
                        file_path: String::new(),
                        file_name: String::new(),
                        similarity_score: score * self.config.summary_weight,
                        match_type: MatchType::SemanticSummary,
                        snippet: None,
                        highlights: Vec::new(),
                        metadata: HashMap::new(),
                        last_modified: Utc::now(),
                    });
                }
            }
        }

        // Sort by combined similarity score
        all_results.sort_by(|a, b| b.similarity_score.partial_cmp(&a.similarity_score).unwrap_or(std::cmp::Ordering::Equal));
        all_results.truncate(limit);

        // TODO: Enrich results with file metadata
        Ok(all_results)
    }

    /// Search folder-level vectors
    async fn folder_search(&self, query_vector: &[f32], request: &SearchRequest) -> Result<Vec<FolderSearchResult>> {
        let threshold = request.threshold.unwrap_or(self.config.similarity_threshold);
        let limit = request.limit.unwrap_or(self.config.max_results);

        let folder_vectors = self.vector_storage.get_all_folder_vectors().await?;
        let folder_matches = VectorMath::find_similar_vectors(
            query_vector,
            &folder_vectors,
            limit,
            threshold,
        )?;

        let mut results = Vec::new();
        for (folder_path, score) in folder_matches {
            // TODO: Get folder metadata and representative files
            results.push(FolderSearchResult {
                folder_path: folder_path.clone(),
                similarity_score: score,
                file_count: 0, // Will be filled by folder lookup
                total_size: 0,
                representative_files: Vec::new(),
                theme_description: None,
            });
        }

        Ok(results)
    }

    /// Hybrid search combining semantic and traditional search
    async fn hybrid_search(&self, query_vector: &[f32], request: &SearchRequest) -> Result<(Vec<SearchResult>, Vec<FolderSearchResult>)> {
        // Get semantic results
        let semantic_results = self.semantic_search(query_vector, request).await?;
        
        // Get folder results if enabled
        let folder_results = if self.config.enable_folder_search {
            self.folder_search(query_vector, request).await?
        } else {
            Vec::new()
        };

        // TODO: Implement traditional keyword search and merge results
        // For now, return semantic results
        Ok((semantic_results, folder_results))
    }

    /// Content-only semantic search
    async fn content_only_search(&self, query_vector: &[f32], request: &SearchRequest) -> Result<Vec<SearchResult>> {
        let threshold = request.threshold.unwrap_or(self.config.similarity_threshold);
        let limit = request.limit.unwrap_or(self.config.max_results);

        let content_vectors = self.vector_storage.get_vectors_by_type(VectorType::Content).await?;
        let matches = VectorMath::find_similar_vectors(query_vector, &content_vectors, limit, threshold)?;

        let results = matches.into_iter().map(|(file_id, score)| {
            SearchResult {
                file_id: file_id.clone(),
                file_path: String::new(),
                file_name: String::new(),
                similarity_score: score,
                match_type: MatchType::SemanticContent,
                snippet: None,
                highlights: Vec::new(),
                metadata: HashMap::new(),
                last_modified: Utc::now(),
            }
        }).collect();

        Ok(results)
    }

    /// Metadata-only semantic search
    async fn metadata_only_search(&self, query_vector: &[f32], request: &SearchRequest) -> Result<Vec<SearchResult>> {
        let threshold = request.threshold.unwrap_or(self.config.similarity_threshold);
        let limit = request.limit.unwrap_or(self.config.max_results);

        let metadata_vectors = self.vector_storage.get_vectors_by_type(VectorType::Metadata).await?;
        let matches = VectorMath::find_similar_vectors(query_vector, &metadata_vectors, limit, threshold)?;

        let results = matches.into_iter().map(|(file_id, score)| {
            SearchResult {
                file_id: file_id.clone(),
                file_path: String::new(),
                file_name: String::new(),
                similarity_score: score,
                match_type: MatchType::SemanticMetadata,
                snippet: None,
                highlights: Vec::new(),
                metadata: HashMap::new(),
                last_modified: Utc::now(),
            }
        }).collect();

        Ok(results)
    }

    /// Generate query vector using AI processor
    async fn generate_query_vector(&self, query: &str) -> Result<Vec<f32>> {
        self.ai_processor.generate_embedding(query).await
    }

    /// Expand query using AI for better semantic matching
    async fn expand_query(&self, query: &str) -> Result<String> {
        let prompt = format!(
            r#"Expand this search query with related terms and concepts for better semantic search.
            Keep the expansion concise and relevant.
            
            Original query: "{}"
            
            Provide 3-5 related terms or concepts that would help find semantically similar content.
            Format as a single line of space-separated terms."#,
            query
        );

        // TODO: Use AI processor to expand query
        // For now, return original query
        Ok(query.to_string())
    }

    /// Generate content summary for vector creation
    async fn generate_content_summary(&self, content: &str) -> Result<String> {
        let prompt = format!(
            r#"Summarize this content in 2-3 sentences, capturing the main themes and concepts:
            
            {}
            
            Provide a concise summary that captures the essence for semantic search:"#,
            if content.len() > 2000 { &content[..2000] } else { content }
        );

        // TODO: Use AI processor to generate summary
        // For now, return truncated content
        Ok(if content.len() > 200 {
            format!("{}...", &content[..200])
        } else {
            content.to_string()
        })
    }

    /// Check if content has meaningful metadata for embedding
    fn has_meaningful_metadata(&self, content: &ExtractedContent) -> bool {
        content.metadata.title.is_some() || 
        content.metadata.author.is_some() || 
        !content.metadata.keywords.is_empty() ||
        content.metadata.subject.is_some()
    }

    /// Serialize metadata into text for embedding
    fn serialize_metadata_for_embedding(&self, content: &ExtractedContent) -> String {
        let mut metadata_parts = Vec::new();

        if let Some(title) = &content.metadata.title {
            metadata_parts.push(format!("Title: {}", title));
        }

        if let Some(author) = &content.metadata.author {
            metadata_parts.push(format!("Author: {}", author));
        }

        if let Some(subject) = &content.metadata.subject {
            metadata_parts.push(format!("Subject: {}", subject));
        }

        if !content.metadata.keywords.is_empty() {
            metadata_parts.push(format!("Keywords: {}", content.metadata.keywords.join(", ")));
        }

        metadata_parts.push(format!("File type: {}", content.file_type));

        metadata_parts.join(". ")
    }

    /// Apply search filters to results
    async fn apply_filters(&self, mut results: Vec<SearchResult>, _filters: &SearchFilters) -> Result<Vec<SearchResult>> {
        // TODO: Implement filtering logic
        // For now, return unfiltered results
        Ok(results)
    }

    /// Generate search suggestions
    async fn generate_suggestions(&self, _query: &str, _results: &[SearchResult]) -> Result<Vec<String>> {
        // TODO: Implement suggestion generation
        Ok(Vec::new())
    }

    /// Generate search facets for filtering
    async fn generate_facets(&self, _results: &[SearchResult]) -> Result<SearchFacets> {
        // TODO: Implement facet generation
        Ok(SearchFacets {
            file_types: HashMap::new(),
            categories: HashMap::new(),
            date_ranges: HashMap::new(),
            size_ranges: HashMap::new(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn setup_test_search_engine() -> SemanticSearchEngine {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        let vector_storage = VectorStorageManager::new(pool);
        let ai_processor = AIProcessor::new("http://localhost:11434".to_string(), "llama3.2".to_string());
        
        SemanticSearchEngine::new(vector_storage, ai_processor)
    }

    #[tokio::test]
    async fn test_search_config_defaults() {
        let config = SearchConfig::default();
        assert_eq!(config.similarity_threshold, 0.7);
        assert_eq!(config.max_results, 50);
        assert!(config.enable_hybrid_search);
    }

    #[tokio::test]
    async fn test_semantic_search_engine_creation() {
        let engine = setup_test_search_engine().await;
        assert_eq!(engine.config.max_results, 50);
    }

    #[tokio::test]
    async fn test_metadata_serialization() {
        let engine = setup_test_search_engine().await;
        
        let mut content = ExtractedContent {
            text: "Test content".to_string(),
            file_type: "pdf".to_string(),
            metadata: Default::default(),
        };
        
        content.metadata.title = Some("Test Document".to_string());
        content.metadata.author = Some("Test Author".to_string());
        
        let serialized = engine.serialize_metadata_for_embedding(&content);
        assert!(serialized.contains("Title: Test Document"));
        assert!(serialized.contains("Author: Test Author"));
    }
}