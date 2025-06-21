# MetaMind Vector Search Guide

## Overview

MetaMind now features advanced semantic search capabilities powered by AI vector embeddings. This enables finding files based on conceptual meaning rather than just keyword matching.

## Key Features

### 🔍 Search Modes
- **AI Mode**: Pure semantic search using vector similarity
- **Hybrid Mode**: Combines semantic and text search with configurable weights
- **Text Mode**: Traditional keyword-based search

### 🧠 Vector Intelligence
- **Content Vectors**: Semantic understanding of file content
- **Metadata Vectors**: File name, path, and type context
- **Summary Vectors**: AI-generated content summaries
- **Folder Vectors**: Aggregate themes and topics

### ⚡ Performance
- **Vector Caching**: LRU cache with TTL for fast repeated searches
- **Background Processing**: Async vector generation and updates
- **Benchmarking**: Real-time performance monitoring

## How to Use

### Basic Semantic Search
1. Open the search interface
2. Select "AI" search mode
3. Enter natural language queries like:
   - "machine learning research papers"
   - "photos of vacation trips"
   - "code related to database optimization"

### Advanced Search Options
- **Similarity Threshold**: Adjust how strict semantic matching should be
- **Result Limit**: Control number of results returned
- **Search Scope**: Choose files only, folders only, or both

### Hybrid Search
- Combine semantic understanding with keyword precision
- Adjust vector vs text weights based on your needs
- Best for finding specific content with conceptual context

## Configuration

### Vector Search Settings
- **Enable/Disable**: Toggle semantic search on/off
- **Cache Size**: Configure memory usage for vector cache
- **Model Selection**: Choose embedding model (default: nomic-embed-text)
- **Background Updates**: Enable automatic vector regeneration

### Performance Tuning
- **Batch Size**: Control parallel processing
- **Memory Limits**: Set maximum cache memory usage
- **Index Rebuilding**: Configure periodic optimization

## Technical Details

### Vector Types
- **Content**: Full text embedding (768 dimensions)
- **Metadata**: File properties and context
- **Summary**: AI-generated content overview
- **Query**: Search term embeddings with expansion

### Similarity Algorithms
- **Cosine Similarity**: Measures angle between vectors
- **Euclidean Distance**: Direct distance in vector space
- **Dot Product**: Raw similarity computation

### Caching Strategy
- **Vector Cache**: Stores file embeddings for fast access
- **Search Cache**: Caches search results by query hash
- **Query Cache**: Stores expanded query vectors

## Troubleshooting

### Common Issues

**Slow Search Performance**
- Reduce vector cache size if memory limited
- Disable background updates during heavy usage
- Lower similarity threshold for faster results

**Poor Search Results**
- Check if files have been vectorized (processing queue)
- Verify AI model is running (Ollama status)
- Try hybrid search for better precision

**Memory Usage**
- Adjust cache size in settings
- Enable vector compression
- Clear cache periodically

### Performance Optimization

**For Large Collections (10,000+ files)**
- Increase vector cache size
- Enable parallel processing
- Use folder-level search for broad queries

**For Limited Resources**
- Reduce cache size and batch processing
- Disable folder vectorization if not needed
- Use text search for simple queries

## Benchmarking

MetaMind includes comprehensive benchmarking tools:

### Available Benchmarks
- **Vector Math**: Similarity calculation performance
- **Storage Operations**: Read/write benchmark tests
- **Search Performance**: End-to-end search timing
- **Cache Performance**: Hit/miss ratio analysis
- **Scalability**: Performance across dataset sizes
- **Concurrency**: Multi-user performance testing

### Running Benchmarks
Access benchmarking through the developer tools or settings panel to monitor and optimize performance for your specific use case.

## Best Practices

### Query Writing
- Use descriptive, natural language
- Include context and intent
- Combine concepts for better results
- Example: "presentations about quarterly sales performance"

### Collection Organization
- Group related files for better folder vectors
- Use descriptive folder names
- Leverage automatic collection features
- Delete unused collections to maintain performance

### Performance Management
- Monitor cache statistics regularly
- Adjust settings based on usage patterns
- Use appropriate search modes for different tasks
- Keep vector models updated

## API Reference

### Search Commands
- `semantic_search`: Pure vector similarity search
- `hybrid_search`: Combined vector and text search
- `find_similar_files`: Content-based similarity
- `search_folders`: Folder-level semantic search

### Vector Operations
- `generate_file_vectors`: Create vectors for new files
- `update_folder_vectors`: Refresh folder aggregations
- `get_vector_statistics`: Performance and cache metrics
- `clear_vector_cache`: Memory management

For developers integrating with MetaMind's search capabilities, refer to the Tauri command documentation in the technical architecture guide.