use std::path::PathBuf;
use tempfile::TempDir;
use tokio;
use metamind::{
    database::{Database, FileRecord},
    content_extractor::ContentExtractor,
    ai_processor::AIProcessor,
    processing_queue::{ProcessingQueue, JobPriority},
};
use chrono::Utc;
use uuid::Uuid;

/// Integration test for the complete file processing pipeline
#[tokio::test]
async fn test_complete_file_processing_pipeline() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("integration_test.db");
    
    // Initialize components
    let database = Database::new(&db_path).await.expect("Failed to create database");
    let ai_processor = AIProcessor::new("http://localhost:11434", "test-model", "test-embedding-model");
    let processing_queue = ProcessingQueue::new(database.clone(), ai_processor.clone(), 2);
    
    // Create test file
    let test_file_path = temp_dir.path().join("test_document.txt");
    let test_content = "This is a test document for integration testing. It contains some meaningful content that can be analyzed.";
    std::fs::write(&test_file_path, test_content).expect("Failed to write test file");
    
    // Create file record
    let file_record = create_test_file_record(&test_file_path, "pending");
    
    // Insert file into database
    database.insert_file(&file_record).await.expect("Failed to insert file");
    
    // Add job to processing queue
    processing_queue.add_job(&file_record, JobPriority::Normal).await.expect("Failed to add job");
    
    // Start processing (this would normally run continuously)
    processing_queue.start_processing().await.expect("Failed to start processing");
    
    // Wait for processing to complete
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    
    // Verify file was processed
    let processed_file = database.get_file_by_path(&test_file_path.to_string_lossy())
        .await
        .expect("Failed to get processed file")
        .expect("File not found");
    
    // Verify processing results
    assert!(processed_file.content.is_some());
    assert!(!processed_file.content.as_ref().unwrap().is_empty());
    assert_eq!(processed_file.processing_status, "completed");
    assert!(processed_file.indexed_at.is_some());
}

/// Test database operations under concurrent access
#[tokio::test]
async fn test_concurrent_database_operations() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("concurrent_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Create multiple tasks that insert files concurrently
    let mut handles = Vec::new();
    
    for i in 0..10 {
        let db = database.clone();
        let handle = tokio::spawn(async move {
            let file_record = create_test_file_record_with_id(
                &format!("/test/file_{}.txt", i),
                &format!("file_{}.txt", i),
                "completed"
            );
            db.insert_file(&file_record).await
        });
        handles.push(handle);
    }
    
    // Wait for all insertions to complete
    for handle in handles {
        handle.await.expect("Task failed").expect("Failed to insert file");
    }
    
    // Verify all files were inserted
    let completed_files = database.get_files_by_status("completed").await.expect("Failed to get completed files");
    assert_eq!(completed_files.len(), 10);
    
    // Test concurrent search operations
    let search_handles: Vec<_> = (0..5).map(|_| {
        let db = database.clone();
        tokio::spawn(async move {
            db.search_files("test", 10, 0).await
        })
    }).collect();
    
    // All searches should complete successfully
    for handle in search_handles {
        let results = handle.await.expect("Search task failed").expect("Search failed");
        assert!(!results.is_empty());
    }
}

/// Test content extraction for various file types
#[tokio::test]
async fn test_content_extraction_integration() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    
    // Test different file types
    let test_files = vec![
        ("test.txt", "plain text content"),
        ("test.md", "# Markdown Header\n\nMarkdown content"),
        ("test.json", r#"{"name": "test", "value": 123}"#),
        ("test.csv", "name,age,city\nJohn,30,NYC\nJane,25,LA"),
        ("test.html", "<html><body><h1>Test</h1><p>Content</p></body></html>"),
    ];
    
    for (filename, content) in test_files {
        let file_path = temp_dir.path().join(filename);
        std::fs::write(&file_path, content).expect("Failed to write test file");
        
        let extracted = ContentExtractor::extract_content(&file_path)
            .await
            .expect("Failed to extract content");
        
        assert!(!extracted.text.is_empty());
        assert!(!extracted.file_type.is_empty());
        assert!(extracted.metadata.word_count.is_some());
        assert!(extracted.metadata.word_count.unwrap() > 0);
    }
}

/// Test AI processor fallback behavior
#[tokio::test]
async fn test_ai_processor_fallback() {
    // Test with non-existent AI service
    let ai_processor = AIProcessor::new("http://localhost:9999", "non-existent-model", "non-existent-embedding");
    
    // Should not be available
    assert!(!ai_processor.is_available().await);
    
    // Create test content
    let test_content = metamind::content_extractor::ExtractedContent {
        text: "This is test content for AI analysis".to_string(),
        metadata: Default::default(),
        file_type: "text".to_string(),
    };
    
    // Analysis should fail gracefully
    let result = ai_processor.analyze_content(&test_content).await;
    assert!(result.is_err());
}

/// Test database migration and schema updates
#[tokio::test]
async fn test_database_migration() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("migration_test.db");
    
    // Create database (this runs migrations)
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Insert a file to test schema
    let file_record = create_test_file_record_with_id("/test/migration.txt", "migration.txt", "completed");
    database.insert_file(&file_record).await.expect("Failed to insert file after migration");
    
    // Verify file can be retrieved
    let retrieved = database.get_file_by_path("/test/migration.txt")
        .await
        .expect("Failed to get file after migration")
        .expect("File not found after migration");
    
    assert_eq!(retrieved.id, file_record.id);
}

/// Test search functionality with different query types
#[tokio::test]
async fn test_search_functionality() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("search_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Insert test files with different content
    let test_files = vec![
        ("/docs/manual.pdf", "User manual for software application", "This is a comprehensive user manual"),
        ("/code/main.rs", "Rust source code", "fn main() { println!(\"Hello world\"); }"),
        ("/images/photo.jpg", "Summer vacation photo", "Image taken during summer vacation in mountains"),
        ("/reports/quarterly.xlsx", "Q3 financial report", "Financial data for third quarter"),
    ];
    
    for (path, name, content) in test_files {
        let mut file_record = create_test_file_record_with_id(path, name, "completed");
        file_record.content = Some(content.to_string());
        database.insert_file(&file_record).await.expect("Failed to insert test file");
    }
    
    // Test different search queries
    let search_tests = vec![
        ("manual", 1), // Should find the manual
        ("summer", 1), // Should find the photo
        ("financial", 1), // Should find the report
        ("rust", 1), // Should find the code file
        ("hello", 1), // Should find the code file
        ("vacation", 1), // Should find the photo
        ("nonexistent", 0), // Should find nothing
    ];
    
    for (query, expected_count) in search_tests {
        let results = database.search_files(query, 10, 0)
            .await
            .expect("Search failed");
        
        assert_eq!(results.len(), expected_count, "Query '{}' returned {} results, expected {}", query, results.len(), expected_count);
    }
}

/// Test collection management
#[tokio::test]
async fn test_collection_management() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("collection_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Create collection
    let collection = database.create_collection("Test Collection", Some("Test description"))
        .await
        .expect("Failed to create collection");
    
    // Create and insert test files
    let file1 = create_test_file_record_with_id("/test/file1.txt", "file1.txt", "completed");
    let file2 = create_test_file_record_with_id("/test/file2.txt", "file2.txt", "completed");
    
    database.insert_file(&file1).await.expect("Failed to insert file1");
    database.insert_file(&file2).await.expect("Failed to insert file2");
    
    // Add files to collection
    database.add_file_to_collection(&file1.id, &collection.id).await.expect("Failed to add file1 to collection");
    database.add_file_to_collection(&file2.id, &collection.id).await.expect("Failed to add file2 to collection");
    
    // Verify collection file count
    let updated_collection = database.get_collection_by_id(&collection.id)
        .await
        .expect("Failed to get collection")
        .expect("Collection not found");
    assert_eq!(updated_collection.file_count, 2);
    
    // Get files in collection
    let files_in_collection = database.get_files_in_collection(&collection.id)
        .await
        .expect("Failed to get files in collection");
    assert_eq!(files_in_collection.len(), 2);
    
    // Remove one file from collection
    database.remove_file_from_collection(&file1.id, &collection.id)
        .await
        .expect("Failed to remove file from collection");
    
    let final_collection = database.get_collection_by_id(&collection.id)
        .await
        .expect("Failed to get collection")
        .expect("Collection not found");
    assert_eq!(final_collection.file_count, 1);
}

/// Test insights data generation
#[tokio::test]
async fn test_insights_generation() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let db_path = temp_dir.path().join("insights_test.db");
    let database = Database::new(&db_path).await.expect("Failed to create database");
    
    // Insert files with different types and statuses
    let test_files = vec![
        ("/docs/manual.pdf", "pdf", "completed"),
        ("/docs/guide.docx", "docx", "completed"),
        ("/images/photo1.jpg", "jpg", "completed"),
        ("/images/photo2.png", "png", "error"),
        ("/code/script.js", "js", "completed"),
        ("/code/style.css", "css", "pending"),
    ];
    
    for (path, extension, status) in test_files {
        let mut file_record = create_test_file_record_with_id(path, &format!("file.{}", extension), status);
        file_record.extension = Some(extension.to_string());
        database.insert_file(&file_record).await.expect("Failed to insert test file");
    }
    
    // Generate insights
    let insights = database.get_insights_data().await.expect("Failed to get insights");
    
    // Verify insights structure
    let insights_obj = insights.as_object().expect("Insights should be an object");
    assert!(insights_obj.contains_key("file_types"));
    assert!(insights_obj.contains_key("categories"));
    assert!(insights_obj.contains_key("recent_activity"));
    assert!(insights_obj.contains_key("processing_summary"));
    
    // Verify file type categorization
    let file_types = insights_obj["file_types"].as_object().unwrap();
    assert!(file_types.contains_key("documents"));
    assert!(file_types.contains_key("images"));
    assert!(file_types.contains_key("code"));
    
    // Verify processing summary
    let processing_summary = insights_obj["processing_summary"].as_object().unwrap();
    assert_eq!(processing_summary["total_files"].as_i64().unwrap(), 6);
    assert!(processing_summary["completed_files"].as_i64().unwrap() > 0);
}

// Helper functions

fn create_test_file_record(path: &std::path::Path, status: &str) -> FileRecord {
    create_test_file_record_with_id(
        &path.to_string_lossy(),
        &path.file_name().unwrap().to_string_lossy(),
        status
    )
}

fn create_test_file_record_with_id(path: &str, name: &str, status: &str) -> FileRecord {
    let now = Utc::now();
    FileRecord {
        id: Uuid::new_v4().to_string(),
        path: path.to_string(),
        name: name.to_string(),
        extension: std::path::Path::new(name).extension().map(|s| s.to_string_lossy().to_string()),
        size: 1024,
        created_at: now,
        modified_at: now,
        last_accessed: Some(now),
        mime_type: Some("text/plain".to_string()),
        hash: Some("test-hash".to_string()),
        content: Some("Test content".to_string()),
        tags: Some(r#"["test"]"#.to_string()),
        metadata: Some(r#"{"test": true}"#.to_string()),
        ai_analysis: Some("Test analysis".to_string()),
        embedding: None,
        indexed_at: Some(now),
        processing_status: status.to_string(),
        error_message: None,
    }
}