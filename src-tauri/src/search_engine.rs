use crate::ai_integration::AIAnalysis;
use crate::database::{Database, FileRecord, SearchResult};
use crate::error::{AppError, AppResult};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tantivy::{
    collector::TopDocs,
    doc,
    query::QueryParser,
    schema::{Field, Schema, STORED, TEXT, FAST},
    Index, IndexWriter, ReloadPolicy,
};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub text: String,
    pub filters: Option<SearchFilters>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub file_types: Option<Vec<String>>,
    pub size_range: Option<SizeRange>,
    pub date_range: Option<DateRange>,
    pub tags: Option<Vec<String>>,
    pub categories: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeRange {
    pub min: Option<u64>,
    pub max: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: Option<String>,
    pub end: Option<String>,
}

#[derive(Debug)]
pub struct SearchEngine {
    database: Arc<Database>,
    tantivy_index: Index,
    schema: Schema,
    fields: SearchFields,
    index_writer: Arc<RwLock<IndexWriter>>,
    query_cache: Arc<RwLock<HashMap<String, Vec<SearchResult>>>>,
}

#[derive(Debug, Clone)]
struct SearchFields {
    id: Field,
    path: Field,
    name: Field,
    content: Field,
    tags: Field,
    category: Field,
    metadata: Field,
}

impl SearchEngine {
    pub async fn new(database: Arc<Database>) -> AppResult<Self> {
        let mut schema_builder = Schema::builder();
        
        let fields = SearchFields {
            id: schema_builder.add_text_field("id", TEXT | STORED),
            path: schema_builder.add_text_field("path", TEXT | STORED),
            name: schema_builder.add_text_field("name", TEXT | STORED),
            content: schema_builder.add_text_field("content", TEXT),
            tags: schema_builder.add_text_field("tags", TEXT),
            category: schema_builder.add_text_field("category", TEXT | FAST),
            metadata: schema_builder.add_text_field("metadata", TEXT),
        };
        
        let schema = schema_builder.build();

        // Create index directory
        let index_dir = dirs::data_dir()
            .ok_or_else(|| AppError::Search("Could not find data directory".to_string()))?
            .join("metamind")
            .join("search_index");
        
        tokio::fs::create_dir_all(&index_dir).await?;
        
        let index = Index::create_in_dir(&index_dir, schema.clone())
            .or_else(|_| Index::open_in_dir(&index_dir))
            .map_err(|e| AppError::Search(format!("Failed to create/open search index: {}", e)))?;

        let index_writer = index.writer(50_000_000)
            .map_err(|e| AppError::Search(format!("Failed to create index writer: {}", e)))?;

        Ok(Self {
            database,
            tantivy_index: index,
            schema,
            fields,
            index_writer: Arc::new(RwLock::new(index_writer)),
            query_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn search(&self, query: &str, filters: Option<serde_json::Value>) -> AppResult<serde_json::Value> {
        // Check cache first
        let cache_key = format!("{}:{:?}", query, filters);
        {
            let cache = self.query_cache.read().await;
            if let Some(cached_results) = cache.get(&cache_key) {
                return Ok(serde_json::to_value(cached_results)?);
            }
        }

        let reader = self.tantivy_index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommit)
            .try_into()
            .map_err(|e| AppError::Search(format!("Failed to create index reader: {}", e)))?;

        let searcher = reader.searcher();
        
        // Parse the query
        let query_parser = QueryParser::for_index(
            &self.tantivy_index,
            vec![self.fields.name, self.fields.content, self.fields.tags, self.fields.metadata],
        );
        
        let parsed_query = query_parser
            .parse_query(query)
            .map_err(|e| AppError::Search(format!("Failed to parse query: {}", e)))?;

        // Search with Tantivy
        let top_docs = searcher
            .search(&parsed_query, &TopDocs::with_limit(100))
            .map_err(|e| AppError::Search(format!("Search failed: {}", e)))?;

        let mut results = Vec::new();
        
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher
                .doc(doc_address)
                .map_err(|e| AppError::Search(format!("Failed to retrieve document: {}", e)))?;

            if let Some(id_value) = retrieved_doc.get_first(self.fields.id) {
                if let Some(id) = id_value.as_text() {
                    if let Ok(Some(file_record)) = self.database.get_file_by_id(id).await {
                        let search_result = SearchResult {
                            file: file_record,
                            score: score as f64,
                            snippet: self.extract_snippet(&retrieved_doc, query),
                            highlights: self.extract_highlights(&retrieved_doc, query),
                        };
                        results.push(search_result);
                    }
                }
            }
        }

        // Apply additional filters if provided
        if let Some(filters_json) = filters {
            if let Ok(search_filters) = serde_json::from_value::<SearchFilters>(filters_json) {
                results = self.apply_filters(results, &search_filters);
            }
        }

        // Sort by relevance score
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        // Cache the results
        {
            let mut cache = self.query_cache.write().await;
            if cache.len() > 1000 {
                cache.clear(); // Simple cache eviction
            }
            cache.insert(cache_key, results.clone());
        }

        // Also search the database for additional results
        let db_results = self.database.search_files(query, Some(50)).await?;
        
        // Combine and deduplicate results
        let combined_results = self.combine_results(results, db_results);

        Ok(serde_json::json!({
            "results": combined_results,
            "total": combined_results.len(),
            "query": query,
            "execution_time_ms": 0 // Would be calculated in real implementation
        }))
    }

    pub async fn index_file(&self, file: &FileRecord, analysis: &AIAnalysis) -> AppResult<()> {
        let mut writer = self.index_writer.write().await;

        // Create document for indexing
        let mut doc = doc!(
            self.fields.id => file.id.clone(),
            self.fields.path => file.path.clone(),
            self.fields.name => file.name.clone(),
        );

        // Add content from AI analysis
        if !analysis.summary.is_empty() {
            doc.add_text(self.fields.content, &analysis.summary);
        }

        // Add tags
        let tags_text = analysis.tags.join(" ");
        if !tags_text.is_empty() {
            doc.add_text(self.fields.tags, &tags_text);
        }

        // Add category
        doc.add_text(self.fields.category, &analysis.category);

        // Add metadata as searchable text
        if let Ok(metadata_text) = serde_json::to_string(&analysis.metadata) {
            doc.add_text(self.fields.metadata, &metadata_text);
        }

        // Add the document to the index
        writer.add_document(doc)
            .map_err(|e| AppError::Search(format!("Failed to add document to index: {}", e)))?;

        // Commit periodically (not on every document for performance)
        // In a real implementation, you'd batch commits
        writer.commit()
            .map_err(|e| AppError::Search(format!("Failed to commit to index: {}", e)))?;

        Ok(())
    }

    pub async fn remove_file(&self, file_id: &str) -> AppResult<()> {
        let mut writer = self.index_writer.write().await;
        
        // Create a term for the file ID
        let id_term = tantivy::Term::from_field_text(self.fields.id, file_id);
        
        // Delete the document
        writer.delete_term(id_term);
        writer.commit()
            .map_err(|e| AppError::Search(format!("Failed to remove document from index: {}", e)))?;

        Ok(())
    }

    pub async fn reindex_all(&self) -> AppResult<()> {
        // Clear the current index
        {
            let mut writer = self.index_writer.write().await;
            writer.delete_all_documents()
                .map_err(|e| AppError::Search(format!("Failed to clear index: {}", e)))?;
            writer.commit()
                .map_err(|e| AppError::Search(format!("Failed to commit index clear: {}", e)))?;
        }

        // Get all processed files from database
        let processed_files = self.database.get_files_by_status("completed").await?;

        for file in processed_files {
            if let Some(ai_analysis_json) = &file.ai_analysis {
                if let Ok(analysis) = serde_json::from_str::<AIAnalysis>(ai_analysis_json) {
                    self.index_file(&file, &analysis).await?;
                }
            }
        }

        Ok(())
    }

    fn extract_snippet(&self, doc: &tantivy::Document, _query: &str) -> Option<String> {
        // Extract a snippet from the document content
        if let Some(content_value) = doc.get_first(self.fields.content) {
            if let Some(content) = content_value.as_text() {
                if content.len() > 200 {
                    return Some(format!("{}...", &content[..200]));
                } else {
                    return Some(content.to_string());
                }
            }
        }
        None
    }

    fn extract_highlights(&self, doc: &tantivy::Document, query: &str) -> Vec<String> {
        let mut highlights = Vec::new();
        
        // Simple highlighting implementation
        let query_terms: Vec<&str> = query.split_whitespace().collect();
        
        for field in [self.fields.name, self.fields.content, self.fields.tags] {
            if let Some(field_value) = doc.get_first(field) {
                if let Some(text) = field_value.as_text() {
                    for term in &query_terms {
                        if text.to_lowercase().contains(&term.to_lowercase()) {
                            highlights.push(format!("{}...{}", 
                                text.chars().take(50).collect::<String>(),
                                text.chars().rev().take(50).collect::<String>()
                            ));
                            break;
                        }
                    }
                }
            }
        }
        
        highlights
    }

    fn apply_filters(&self, mut results: Vec<SearchResult>, filters: &SearchFilters) -> Vec<SearchResult> {
        // Filter by file types
        if let Some(file_types) = &filters.file_types {
            results.retain(|result| {
                if let Some(ext) = &result.file.extension {
                    file_types.contains(ext)
                } else {
                    false
                }
            });
        }

        // Filter by size range
        if let Some(size_range) = &filters.size_range {
            results.retain(|result| {
                let size = result.file.size as u64;
                let min_ok = size_range.min.map_or(true, |min| size >= min);
                let max_ok = size_range.max.map_or(true, |max| size <= max);
                min_ok && max_ok
            });
        }

        // Filter by categories
        if let Some(categories) = &filters.categories {
            results.retain(|result| {
                if let Some(ai_analysis) = &result.file.ai_analysis {
                    if let Ok(analysis) = serde_json::from_str::<AIAnalysis>(ai_analysis) {
                        return categories.contains(&analysis.category);
                    }
                }
                false
            });
        }

        // Filter by tags
        if let Some(filter_tags) = &filters.tags {
            results.retain(|result| {
                if let Some(ai_analysis) = &result.file.ai_analysis {
                    if let Ok(analysis) = serde_json::from_str::<AIAnalysis>(ai_analysis) {
                        return filter_tags.iter().any(|tag| analysis.tags.contains(tag));
                    }
                }
                false
            });
        }

        results
    }

    fn combine_results(&self, tantivy_results: Vec<SearchResult>, db_results: Vec<FileRecord>) -> Vec<SearchResult> {
        let mut combined = tantivy_results;
        let existing_ids: std::collections::HashSet<String> = combined
            .iter()
            .map(|r| r.file.id.clone())
            .collect();

        // Add database results that aren't already in Tantivy results
        for file in db_results {
            if !existing_ids.contains(&file.id) {
                combined.push(SearchResult {
                    file,
                    score: 0.5, // Lower score for database-only results
                    snippet: None,
                    highlights: vec![],
                });
            }
        }

        combined
    }

    pub async fn get_suggestions(&self, partial_query: &str) -> AppResult<Vec<String>> {
        // Simple suggestion implementation
        let suggestions = vec![
            format!("{} documents", partial_query),
            format!("{} images", partial_query),
            format!("{} code", partial_query),
        ];
        
        Ok(suggestions)
    }

    pub async fn get_search_statistics(&self) -> AppResult<serde_json::Value> {
        let index_size = self.tantivy_index.searcher()
            .map_err(|e| AppError::Search(format!("Failed to get searcher: {}", e)))?
            .num_docs();

        Ok(serde_json::json!({
            "indexed_documents": index_size,
            "cache_size": self.query_cache.read().await.len()
        }))
    }
}