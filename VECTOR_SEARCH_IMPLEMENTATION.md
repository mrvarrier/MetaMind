# MetaMind Vector Search Implementation Plan

## Overview

This document outlines the detailed implementation plan to transform MetaMind from AI-enhanced keyword search to true semantic vector search. The goal is to enable conceptual search across files and folders using vector embeddings for similarity matching.

## Current State Analysis

### What We Have
- ✅ Ollama integration with embedding generation
- ✅ SQLite database with embedding storage (BLOB fields)
- ✅ File processing pipeline with AI analysis
- ✅ Traditional FTS5 text search
- ✅ Frontend search interface
- ✅ Processing queue system

### What's Missing
- ❌ Vector similarity calculation algorithms
- ❌ Efficient vector indexing and search
- ❌ Query vectorization
- ❌ Folder-level vector aggregation
- ❌ Hybrid search combining vector + text
- ❌ Vector search result ranking

## Implementation Requirements

### 1. Database Schema Updates

#### 1.1 Enhanced File Vectors Table
```sql
-- Add vector-specific columns to existing files table
ALTER TABLE files ADD COLUMN content_vector BLOB;
ALTER TABLE files ADD COLUMN metadata_vector BLOB;
ALTER TABLE files ADD COLUMN summary_vector BLOB;
ALTER TABLE files ADD COLUMN vector_model TEXT DEFAULT 'nomic-embed-text';
ALTER TABLE files ADD COLUMN vector_dimensions INTEGER DEFAULT 768;
ALTER TABLE files ADD COLUMN vector_created_at TIMESTAMP;

-- Create vector index table for faster similarity search
CREATE TABLE file_vectors (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    vector_type TEXT NOT NULL, -- 'content', 'metadata', 'summary'
    embedding BLOB NOT NULL,
    dimensions INTEGER NOT NULL,
    model_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE INDEX idx_file_vectors_file_id ON file_vectors(file_id);
CREATE INDEX idx_file_vectors_type ON file_vectors(vector_type);
```

#### 1.2 Folder Vector System
```sql
-- New table for folder-level vectors
CREATE TABLE folder_vectors (
    id TEXT PRIMARY KEY,
    folder_path TEXT NOT NULL UNIQUE,
    aggregate_vector BLOB NOT NULL,
    theme_vector BLOB,
    file_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vector_model TEXT DEFAULT 'nomic-embed-text',
    dimensions INTEGER DEFAULT 768
);

CREATE INDEX idx_folder_vectors_path ON folder_vectors(folder_path);
```

#### 1.3 Vector Search Cache
```sql
-- Cache for frequently searched query vectors
CREATE TABLE query_vector_cache (
    id TEXT PRIMARY KEY,
    query_hash TEXT NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    query_vector BLOB NOT NULL,
    hit_count INTEGER DEFAULT 1,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_cache_hash ON query_vector_cache(query_hash);
```

### 2. Rust Backend Implementation

#### 2.1 Vector Math Module
```rust
// src-tauri/src/vector_math.rs
use anyhow::Result;

pub struct VectorMath;

impl VectorMath {
    /// Calculate cosine similarity between two vectors
    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> Result<f32> {
        // Implementation: dot_product / (norm_a * norm_b)
    }
    
    /// Calculate Euclidean distance between vectors
    pub fn euclidean_distance(a: &[f32], b: &[f32]) -> Result<f32> {
        // Implementation: sqrt(sum((a[i] - b[i])^2))
    }
    
    /// Normalize vector to unit length
    pub fn normalize(vector: &mut [f32]) -> Result<()> {
        // Implementation: vector / ||vector||
    }
    
    /// Find top-k most similar vectors using HNSW-like algorithm
    pub fn find_similar_vectors(
        query: &[f32],
        candidates: &[(String, Vec<f32>)],
        k: usize,
        threshold: f32
    ) -> Result<Vec<(String, f32)>> {
        // Implementation: efficient similarity search
    }
}
```

#### 2.2 Enhanced Vector Storage Manager
```rust
// src-tauri/src/vector_storage.rs
use anyhow::Result;
use sqlx::SqlitePool;

pub struct VectorStorageManager {
    db: SqlitePool,
}

impl VectorStorageManager {
    /// Store multiple vector types for a file
    pub async fn store_file_vectors(
        &self,
        file_id: &str,
        content_vector: Option<Vec<f32>>,
        metadata_vector: Option<Vec<f32>>,
        summary_vector: Option<Vec<f32>>,
        model_name: &str,
    ) -> Result<()> {
        // Store vectors in file_vectors table
    }
    
    /// Retrieve vectors for similarity search
    pub async fn get_all_content_vectors(&self) -> Result<Vec<(String, Vec<f32>)>> {
        // Efficient bulk retrieval for search
    }
    
    /// Store folder aggregate vector
    pub async fn store_folder_vector(
        &self,
        folder_path: &str,
        aggregate_vector: Vec<f32>,
        file_count: usize,
    ) -> Result<()> {
        // Store computed folder vectors
    }
    
    /// Get or create query vector with caching
    pub async fn get_query_vector(
        &self,
        query: &str,
        ai_processor: &AIProcessor,
    ) -> Result<Vec<f32>> {
        // Check cache first, generate if needed
    }
}
```

#### 2.3 Semantic Search Engine
```rust
// src-tauri/src/semantic_search.rs
use anyhow::Result;

pub struct SemanticSearchEngine {
    vector_storage: VectorStorageManager,
    ai_processor: Arc<AIProcessor>,
    vector_math: VectorMath,
}

impl SemanticSearchEngine {
    /// Perform semantic search across files
    pub async fn search_files(
        &self,
        query: &str,
        limit: usize,
        similarity_threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        // 1. Get or generate query vector
        // 2. Retrieve all file vectors
        // 3. Calculate similarities
        // 4. Rank and filter results
        // 5. Return enriched results
    }
    
    /// Search within specific folders
    pub async fn search_in_folders(
        &self,
        query: &str,
        folder_paths: &[String],
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        // Folder-scoped semantic search
    }
    
    /// Hybrid search combining vector + text search
    pub async fn hybrid_search(
        &self,
        query: &str,
        limit: usize,
        vector_weight: f32,
        text_weight: f32,
    ) -> Result<Vec<SearchResult>> {
        // Combine semantic and traditional search scores
    }
    
    /// Find similar files to a given file
    pub async fn find_similar_files(
        &self,
        file_id: &str,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        // Content-based file similarity
    }
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub file_id: String,
    pub file_path: String,
    pub similarity_score: f32,
    pub search_type: SearchType,
    pub matched_content: Option<String>,
    pub ai_summary: Option<String>,
}

#[derive(Debug, Clone)]
pub enum SearchType {
    SemanticContent,
    SemanticMetadata,
    SemanticSummary,
    Hybrid,
}
```

#### 2.4 Folder Vector Aggregation
```rust
// src-tauri/src/folder_vectorizer.rs
use anyhow::Result;

pub struct FolderVectorizer {
    vector_storage: VectorStorageManager,
    vector_math: VectorMath,
}

impl FolderVectorizer {
    /// Compute aggregate vector for a folder
    pub async fn vectorize_folder(&self, folder_path: &str) -> Result<Vec<f32>> {
        // 1. Get all file vectors in folder
        // 2. Calculate weighted average based on file importance
        // 3. Apply folder-specific weighting (recent files, large files)
        // 4. Normalize result
    }
    
    /// Update folder vectors when files change
    pub async fn update_folder_vectors(&self, affected_folders: &[String]) -> Result<()> {
        // Incremental folder vector updates
    }
    
    /// Find folders similar to query or file
    pub async fn find_similar_folders(
        &self,
        query_vector: &[f32],
        limit: usize,
    ) -> Result<Vec<(String, f32)>> {
        // Folder-level semantic search
    }
}
```

### 3. AI Processor Enhancements

#### 3.1 Enhanced Vector Generation
```rust
// Additions to src-tauri/src/ai_processor/mod.rs

impl AIProcessor {
    /// Generate multiple vector types for comprehensive search
    pub async fn generate_comprehensive_vectors(
        &self,
        file_path: &Path,
        content: &str,
    ) -> Result<FileVectors> {
        // 1. Content vector (full text)
        let content_vector = self.generate_embedding(content).await?;
        
        // 2. Metadata vector (filename, extension, path context)
        let metadata_text = self.extract_metadata_text(file_path);
        let metadata_vector = self.generate_embedding(&metadata_text).await?;
        
        // 3. Summary vector (AI-generated summary)
        let summary = self.generate_summary(content).await?;
        let summary_vector = self.generate_embedding(&summary).await?;
        
        Ok(FileVectors {
            content: content_vector,
            metadata: metadata_vector,
            summary: summary_vector,
        })
    }
    
    /// Generate optimized query vector
    pub async fn generate_query_vector(&self, query: &str) -> Result<Vec<f32>> {
        // 1. Expand query with synonyms/related terms
        let expanded_query = self.expand_search_query(query).await?;
        
        // 2. Generate embedding for enhanced query
        self.generate_embedding(&expanded_query).await
    }
    
    /// Expand search query with AI understanding
    async fn expand_search_query(&self, query: &str) -> Result<String> {
        let prompt = format!(
            "Expand this search query with related terms and concepts for better semantic search: '{}'
            
            Provide synonyms, related concepts, and alternative phrasings.
            Return only the expanded search text without explanations.",
            query
        );
        
        self.process_text(&prompt, "llama3.1:8b").await
    }
}

#[derive(Debug)]
pub struct FileVectors {
    pub content: Vec<f32>,
    pub metadata: Vec<f32>,
    pub summary: Vec<f32>,
}
```

### 4. Processing Queue Integration

#### 4.1 Vector Processing Jobs
```rust
// Additions to src-tauri/src/processing_queue/mod.rs

#[derive(Debug, Clone)]
pub enum JobType {
    // ... existing types
    GenerateVectors(PathBuf),
    UpdateFolderVectors(String),
    RebuildVectorIndex,
}

impl ProcessingQueue {
    /// Queue vector generation for new/updated files
    pub async fn queue_vector_generation(&self, file_path: PathBuf) -> Result<()> {
        let job = Job::new(JobType::GenerateVectors(file_path), JobPriority::Normal);
        self.add_job(job).await
    }
    
    /// Queue folder vector updates
    pub async fn queue_folder_vector_update(&self, folder_path: String) -> Result<()> {
        let job = Job::new(JobType::UpdateFolderVectors(folder_path), JobPriority::Low);
        self.add_job(job).await
    }
    
    /// Process vector generation job
    async fn process_vector_generation(&self, file_path: &Path) -> Result<()> {
        // 1. Extract/read file content
        // 2. Generate comprehensive vectors
        // 3. Store in vector storage
        // 4. Queue folder vector updates
    }
}
```

### 5. Frontend Integration

#### 5.1 Enhanced Search Interface
```typescript
// src/components/search/SemanticSearchInterface.tsx

interface SemanticSearchProps {
  onResults: (results: SearchResult[]) => void;
}

export function SemanticSearchInterface({ onResults }: SemanticSearchProps) {
  // 1. Search mode toggle (semantic vs text vs hybrid)
  // 2. Similarity threshold slider
  // 3. Search scope selector (files only, folders only, both)
  // 4. Advanced filters (file type, date range, etc.)
  // 5. Search suggestions based on query expansion
}

// Search result types
interface SearchResult {
  fileId: string;
  filePath: string;
  similarityScore: number;
  searchType: 'semantic' | 'text' | 'hybrid';
  matchedContent?: string;
  aiSummary?: string;
  relatedFiles?: SearchResult[];
}
```

#### 5.2 New Tauri Commands
```rust
// Additions to src-tauri/src/main.rs

#[tauri::command]
async fn semantic_search(
    state: State<'_, AppState>,
    query: String,
    limit: Option<usize>,
    threshold: Option<f32>,
) -> Result<Vec<SearchResult>, String> {
    // Implement semantic search command
}

#[tauri::command]
async fn find_similar_files(
    state: State<'_, AppState>,
    file_id: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    // Find files similar to given file
}

#[tauri::command]
async fn hybrid_search(
    state: State<'_, AppState>,
    query: String,
    vector_weight: f32,
    text_weight: f32,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    // Combined semantic + text search
}

#[tauri::command]
async fn search_folders(
    state: State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<FolderSearchResult>, String> {
    // Semantic folder search
}
```

## Performance Considerations

### 1. Vector Index Optimization
- **HNSW (Hierarchical Navigable Small Worlds)** algorithm for approximate nearest neighbor search
- **LSH (Locality Sensitive Hashing)** for faster similarity estimation
- **Quantization** to reduce memory usage (float32 → uint8)
- **Batch processing** for multiple similarity calculations

### 2. Memory Management
```rust
// Vector caching strategy
pub struct VectorCache {
    content_vectors: LruCache<String, Vec<f32>>,
    query_vectors: LruCache<String, Vec<f32>>,
    max_memory_mb: usize,
}

impl VectorCache {
    /// Load vectors on demand with LRU eviction
    pub fn get_or_load(&mut self, file_id: &str) -> Result<&Vec<f32>> {
        // Smart caching with memory limits
    }
}
```

### 3. Background Processing
- **Incremental vector updates** when files change
- **Lazy loading** of vectors during search
- **Asynchronous folder aggregation** 
- **Periodic vector index optimization**

## Configuration Options

### 1. Vector Search Settings
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchConfig {
    pub enabled: bool,
    pub similarity_threshold: f32,
    pub max_results: usize,
    pub vector_cache_size_mb: usize,
    pub embedding_model: String,
    pub search_mode: SearchMode,
    pub folder_vectors_enabled: bool,
    pub query_expansion_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchMode {
    SemanticOnly,
    TextOnly,
    Hybrid { vector_weight: f32, text_weight: f32 },
}
```

### 2. Performance Tuning
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorPerformanceConfig {
    pub batch_size: usize,
    pub parallel_processing: bool,
    pub use_quantization: bool,
    pub index_rebuild_interval_hours: u32,
    pub background_updates: bool,
}
```

## Implementation Timeline

### Phase 1: Core Vector Math (Week 1)
- [ ] Implement `VectorMath` module with similarity calculations
- [ ] Create database schema updates
- [ ] Basic vector storage and retrieval

### Phase 2: Search Engine (Week 2)
- [ ] Implement `SemanticSearchEngine` 
- [ ] Add comprehensive vector generation to AI processor
- [ ] Create Tauri commands for semantic search

### Phase 3: Folder Vectors (Week 3)
- [ ] Implement `FolderVectorizer`
- [ ] Add folder-level search capabilities
- [ ] Integrate with file monitoring for auto-updates

### Phase 4: Frontend Integration (Week 4)
- [ ] Enhanced search interface with semantic options
- [ ] Search result visualization with similarity scores
- [ ] Advanced filtering and search modes

### Phase 5: Optimization (Week 5)
- [ ] Performance tuning and caching
- [ ] Index optimization algorithms
- [ ] Memory management improvements

### Phase 6: Testing & Polish (Week 6)
- [ ] Comprehensive testing with large datasets
- [ ] Performance benchmarking
- [ ] User experience refinements

## Success Metrics

### 1. Search Quality
- **Semantic relevance**: Users find conceptually related content
- **Precision**: Reduced false positives compared to keyword search
- **Recall**: Improved discovery of relevant content with different terminology

### 2. Performance
- **Search speed**: Sub-200ms response times for most queries
- **Memory usage**: Reasonable memory footprint (< 500MB for 10k files)
- **Accuracy**: >85% user satisfaction with search results

### 3. User Experience
- **Search success rate**: Users find what they're looking for more often
- **Discovery**: Users find useful content they weren't specifically searching for
- **Adoption**: Increased usage of search functionality

## Dependencies

### Required Rust Crates
```toml
[dependencies]
# Existing dependencies...

# Vector operations
nalgebra = "0.32"
approx = "0.5"

# Performance optimizations
rayon = "1.8"  # Parallel processing
lru = "0.12"   # LRU cache
```

### Model Requirements
- **Ollama**: Running locally with embedding model (nomic-embed-text recommended)
- **Minimum RAM**: 8GB (16GB recommended for large datasets)
- **Storage**: Additional ~10-50MB per 1000 files for vector storage

## Risk Mitigation

### 1. Fallback Strategies
- **Graceful degradation**: Fall back to text search if vector search fails
- **Progressive enhancement**: Semantic search enhances rather than replaces existing functionality
- **Configuration toggles**: Users can disable vector search if needed

### 2. Data Integrity
- **Vector versioning**: Handle model changes gracefully
- **Consistency checks**: Ensure vectors stay in sync with file content
- **Backup strategies**: Vector data can be regenerated from source files

### 3. Performance Safety
- **Memory limits**: Prevent excessive memory usage
- **Timeout protection**: Avoid hanging on large similarity calculations
- **Rate limiting**: Prevent AI service overload during bulk processing

This implementation will transform MetaMind into a true semantic search system while maintaining all existing functionality and providing smooth user experience upgrades.