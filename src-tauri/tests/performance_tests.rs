use std::time::Instant;
use tempfile::TempDir;
use tokio;
use metamind::{
    database::{Database, FileRecord},
    content_extractor::ContentExtractor,
    processing_queue::{ProcessingQueue, JobPriority},
    ai_processor::AIProcessor,
};
use chrono::Utc;
use uuid::Uuid;

/// Test database performance with large number of files
#[tokio::test]
async fn test_database_performance_large_dataset() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("performance_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    let file_count = 1000;
    let start_time = Instant::now();
    
    // Insert large number of files
    for i in 0..file_count {
        let file_record = create_performance_test_file(i);
        database.insert_file(&file_record).await.expect("Failed to insert file");
    }
    
    let insert_duration = start_time.elapsed();
    println!("Inserted {} files in {:?}", file_count, insert_duration);
    
    // Test search performance
    let search_start = Instant::now();
    let results = database.search_files("test", 50, 0).await.expect("Search failed");
    let search_duration = search_start.elapsed();
    
    println!("Search completed in {:?}, found {} results", search_duration, results.len());
    
    // Performance assertions
    assert!(insert_duration.as_millis() < 30000, "Insert took too long: {:?}", insert_duration);
    assert!(search_duration.as_millis() < 1000, "Search took too long: {:?}", search_duration);
    assert!(!results.is_empty(), "Search should return results");
}

/// Test content extraction performance
#[tokio::test]
async fn test_content_extraction_performance() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    
    // Create files of different sizes
    let test_cases = vec![
        ("small.txt", "word ".repeat(100)),      // ~500 bytes
        ("medium.txt", "word ".repeat(1000)),    // ~5KB  
        ("large.txt", "word ".repeat(10000)),    // ~50KB
        ("xlarge.txt", "word ".repeat(100000)),  // ~500KB
    ];
    
    for (filename, content) in test_cases {
        let file_path = temp_dir.path().join(filename);
        std::fs::write(&file_path, &content).expect("Failed to write test file");
        
        let start_time = Instant::now();
        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract content");
        let duration = start_time.elapsed();
        
        println!("Extracted {} ({} chars) in {:?}", filename, content.len(), duration);
        
        // Verify extraction worked
        assert_eq!(result.text, content);
        assert!(result.metadata.word_count.is_some());
        
        // Performance assertion - should extract even large files quickly
        assert!(duration.as_millis() < 5000, "Extraction took too long for {}: {:?}", filename, duration);
    }
}

/// Test concurrent processing performance
#[tokio::test]
async fn test_concurrent_processing_performance() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("concurrent_perf_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    let ai_processor = AIProcessor::new("http://localhost:11434", "test-model", "test-embedding");
    let processing_queue = ProcessingQueue::new(database.clone(), ai_processor, 4);
    
    let job_count = 50;
    let start_time = Instant::now();
    
    // Create and queue multiple jobs
    for i in 0..job_count {
        let file_record = create_performance_test_file(i);
        database.insert_file(&file_record).await.expect("Failed to insert file");
        processing_queue.add_job(&file_record, JobPriority::Normal).await
            .expect("Failed to add job");
    }
    
    let queue_duration = start_time.elapsed();
    println!("Queued {} jobs in {:?}", job_count, queue_duration);
    
    // Start processing
    processing_queue.start_processing().await.expect("Failed to start processing");
    
    // Wait for processing and measure time
    let process_start = Instant::now();
    
    // Poll for completion
    loop {
        let stats = processing_queue.get_queue_status().await;
        let queued = stats["total_queued"].as_u64().unwrap_or(0);
        
        if queued == 0 {
            break;
        }
        
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Timeout after 30 seconds
        if process_start.elapsed().as_secs() > 30 {
            panic!("Processing took too long");
        }
    }
    
    let process_duration = process_start.elapsed();
    println!("Processed {} jobs in {:?}", job_count, process_duration);
    
    // Performance assertions
    assert!(queue_duration.as_millis() < 5000, "Queueing took too long: {:?}", queue_duration);
    assert!(process_duration.as_secs() < 25, "Processing took too long: {:?}", process_duration);
}

/// Test search performance with different query patterns
#[tokio::test]
async fn test_search_performance_patterns() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("search_perf_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Insert test data with varied content
    let content_patterns = vec![
        "document analysis report quarterly financial",
        "image processing algorithm machine learning",
        "user interface design responsive mobile web",
        "database optimization query performance index",
        "security authentication authorization encryption",
    ];
    
    for (i, pattern) in content_patterns.iter().enumerate() {
        for j in 0..20 { // 20 files per pattern
            let mut file_record = create_performance_test_file(i * 20 + j);
            file_record.content = Some(format!("{} content variation {}", pattern, j));
            file_record.ai_analysis = Some(format!("Analysis of {} with additional context {}", pattern, j));
            database.insert_file(&file_record).await.expect("Failed to insert file");
        }
    }
    
    // Test different search patterns
    let search_queries = vec![
        "document",
        "machine learning",
        "user interface design",
        "database optimization",
        "security authentication",
        "quarterly financial report",
        "responsive mobile",
        "algorithm processing",
    ];
    
    for query in search_queries {
        let start_time = Instant::now();
        let results = database.search_files(query, 50, 0).await.expect("Search failed");
        let duration = start_time.elapsed();
        
        println!("Search '{}': {} results in {:?}", query, results.len(), duration);
        
        // Performance assertion
        assert!(duration.as_millis() < 500, "Search '{}' took too long: {:?}", query, duration);
    }
}

/// Test memory usage during bulk operations
#[tokio::test]
async fn test_memory_usage_bulk_operations() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("memory_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Monitor memory usage (basic check)
    let initial_memory = get_memory_usage();
    
    // Perform bulk operations
    let batch_size = 100;
    let batch_count = 10;
    
    for batch in 0..batch_count {
        let mut files = Vec::new();
        
        // Create batch of files
        for i in 0..batch_size {
            let file_record = create_performance_test_file(batch * batch_size + i);
            files.push(file_record);
        }
        
        // Insert batch
        for file in files {
            database.insert_file(&file).await.expect("Failed to insert file");
        }
        
        // Check memory hasn't grown excessively
        let current_memory = get_memory_usage();
        let memory_growth = current_memory.saturating_sub(initial_memory);
        
        println!("Batch {}: Memory growth {} MB", batch, memory_growth / 1024 / 1024);
        
        // Memory shouldn't grow more than 100MB for this test
        assert!(memory_growth < 100 * 1024 * 1024, "Excessive memory growth: {} bytes", memory_growth);
    }
}

/// Test database query optimization
#[tokio::test]
async fn test_database_query_optimization() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("query_opt_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Insert files with various statuses and types
    let statuses = vec!["pending", "completed", "error", "processing"];
    let file_types = vec!["pdf", "txt", "jpg", "docx", "mp4"];
    
    for status in &statuses {
        for file_type in &file_types {
            for i in 0..50 {
                let mut file_record = create_performance_test_file(i);
                file_record.processing_status = status.to_string();
                file_record.extension = Some(file_type.to_string());
                file_record.path = format!("/test/{}/file_{}.{}", status, i, file_type);
                database.insert_file(&file_record).await.expect("Failed to insert file");
            }
        }
    }
    
    // Test various query patterns for performance
    let query_tests = vec![
        ("get_files_by_status", "completed"),
        ("get_files_by_status", "pending"),
        ("get_files_by_status", "error"),
    ];
    
    for (test_name, status) in query_tests {
        let start_time = Instant::now();
        let results = database.get_files_by_status(status).await.expect("Query failed");
        let duration = start_time.elapsed();
        
        println!("{} '{}': {} results in {:?}", test_name, status, results.len(), duration);
        
        // Should be fast even with many files
        assert!(duration.as_millis() < 100, "{} took too long: {:?}", test_name, duration);
        assert_eq!(results.len(), 250); // 50 files * 5 types
    }
    
    // Test insights generation performance
    let insights_start = Instant::now();
    let insights = database.get_insights_data().await.expect("Failed to get insights");
    let insights_duration = insights_start.elapsed();
    
    println!("Generated insights in {:?}", insights_duration);
    assert!(insights_duration.as_millis() < 1000, "Insights generation took too long: {:?}", insights_duration);
    assert!(insights.as_object().unwrap().contains_key("file_types"));
}

/// Test file processing throughput
#[tokio::test]
async fn test_processing_throughput() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    
    // Create many small test files
    let file_count = 100;
    let mut file_paths = Vec::new();
    
    for i in 0..file_count {
        let file_path = temp_dir.path().join(format!("test_file_{}.txt", i));
        let content = format!("Test content for file {} with some additional text to make it more realistic", i);
        std::fs::write(&file_path, content).expect("Failed to write test file");
        file_paths.push(file_path);
    }
    
    // Measure throughput of content extraction
    let start_time = Instant::now();
    let mut successful_extractions = 0;
    
    for file_path in file_paths {
        if ContentExtractor::extract_content(&file_path).await.is_ok() {
            successful_extractions += 1;
        }
    }
    
    let duration = start_time.elapsed();
    let throughput = successful_extractions as f64 / duration.as_secs_f64();
    
    println!("Processed {} files in {:?} ({:.2} files/sec)", successful_extractions, duration, throughput);
    
    // Should process at least 10 files per second
    assert!(throughput >= 10.0, "Throughput too low: {:.2} files/sec", throughput);
    assert_eq!(successful_extractions, file_count);
}

// Helper functions

fn create_performance_test_file(index: usize) -> FileRecord {
    let now = Utc::now();
    FileRecord {
        id: Uuid::new_v4().to_string(),
        path: format!("/test/perf/file_{}.txt", index),
        name: format!("file_{}.txt", index),
        extension: Some("txt".to_string()),
        size: 1024 + (index as i64 * 100), // Varying sizes
        created_at: now,
        modified_at: now,
        last_accessed: Some(now),
        mime_type: Some("text/plain".to_string()),
        hash: Some(format!("hash-{}", index)),
        content: Some(format!("Test content for performance file {} with additional data", index)),
        tags: Some(format!(r#"["test", "performance", "file{}"]"#, index)),
        metadata: Some(format!(r#"{{"index": {}, "test": true}}"#, index)),
        ai_analysis: Some(format!("Performance test analysis for file {}", index)),
        embedding: None,
        indexed_at: Some(now),
        processing_status: "pending".to_string(),
        error_message: None,
    }
}

#[cfg(target_os = "linux")]
fn get_memory_usage() -> usize {
    use std::fs;
    
    if let Ok(contents) = fs::read_to_string("/proc/self/status") {
        for line in contents.lines() {
            if line.starts_with("VmRSS:") {
                if let Some(value) = line.split_whitespace().nth(1) {
                    if let Ok(kb) = value.parse::<usize>() {
                        return kb * 1024; // Convert KB to bytes
                    }
                }
            }
        }
    }
    0
}

#[cfg(not(target_os = "linux"))]
fn get_memory_usage() -> usize {
    // Simplified memory usage for other platforms
    // In a real implementation, you'd use platform-specific APIs
    0
}