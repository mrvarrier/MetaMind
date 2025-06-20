#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio;
    use chrono::Utc;
    use uuid::Uuid;

    async fn create_test_database() -> (Database, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let db_path = temp_dir.path().join("test.db");
        let database = Database::new(db_path).await.expect("Failed to create test database");
        (database, temp_dir)
    }

    fn create_test_file_record() -> FileRecord {
        let now = Utc::now();
        FileRecord {
            id: Uuid::new_v4().to_string(),
            path: "/test/path/file.txt".to_string(),
            name: "file.txt".to_string(),
            extension: Some("txt".to_string()),
            size: 1024,
            created_at: now,
            modified_at: now,
            last_accessed: Some(now),
            mime_type: Some("text/plain".to_string()),
            hash: Some("test-hash".to_string()),
            content: Some("Test file content".to_string()),
            tags: Some(r#"["test", "document"]"#.to_string()),
            metadata: Some(r#"{"author": "Test Author"}"#.to_string()),
            ai_analysis: Some("This is a test document.".to_string()),
            embedding: Some(vec![0.1, 0.2, 0.3, 0.4]),
            indexed_at: Some(now),
            processing_status: "completed".to_string(),
            error_message: None,
        }
    }

    #[tokio::test]
    async fn test_database_creation() {
        let (_database, _temp_dir) = create_test_database().await;
        // If we get here without panicking, the database was created successfully
    }

    #[tokio::test]
    async fn test_file_insertion_and_retrieval() {
        let (database, _temp_dir) = create_test_database().await;
        let file_record = create_test_file_record();

        // Insert file
        database.insert_file(&file_record).await.expect("Failed to insert file");

        // Retrieve file by path
        let retrieved = database.get_file_by_path(&file_record.path).await
            .expect("Failed to retrieve file")
            .expect("File not found");

        assert_eq!(retrieved.id, file_record.id);
        assert_eq!(retrieved.path, file_record.path);
        assert_eq!(retrieved.name, file_record.name);
        assert_eq!(retrieved.content, file_record.content);
        assert_eq!(retrieved.processing_status, file_record.processing_status);
    }

    #[tokio::test]
    async fn test_file_exists() {
        let (database, _temp_dir) = create_test_database().await;
        let file_record = create_test_file_record();

        // File should not exist initially
        let exists_before = database.file_exists(&file_record.path).await
            .expect("Failed to check file existence");
        assert!(!exists_before);

        // Insert file
        database.insert_file(&file_record).await.expect("Failed to insert file");

        // File should exist now
        let exists_after = database.file_exists(&file_record.path).await
            .expect("Failed to check file existence");
        assert!(exists_after);
    }

    #[tokio::test]
    async fn test_file_status_update() {
        let (database, _temp_dir) = create_test_database().await;
        let mut file_record = create_test_file_record();
        file_record.processing_status = "pending".to_string();

        database.insert_file(&file_record).await.expect("Failed to insert file");

        // Update status to processing
        database.update_file_status(&file_record.id, "processing", None).await
            .expect("Failed to update file status");

        let updated = database.get_file_by_path(&file_record.path).await
            .expect("Failed to retrieve file")
            .expect("File not found");

        assert_eq!(updated.processing_status, "processing");
        assert_eq!(updated.error_message, None);

        // Update status to error with message
        let error_msg = "Test error message";
        database.update_file_status(&file_record.id, "error", Some(error_msg)).await
            .expect("Failed to update file status");

        let updated_with_error = database.get_file_by_path(&file_record.path).await
            .expect("Failed to retrieve file")
            .expect("File not found");

        assert_eq!(updated_with_error.processing_status, "error");
        assert_eq!(updated_with_error.error_message, Some(error_msg.to_string()));
    }

    #[tokio::test]
    async fn test_file_analysis_update() {
        let (database, _temp_dir) = create_test_database().await;
        let mut file_record = create_test_file_record();
        file_record.content = None;
        file_record.ai_analysis = None;
        file_record.tags = None;
        file_record.embedding = None;

        database.insert_file(&file_record).await.expect("Failed to insert file");

        let content = "Updated content";
        let analysis = "Updated AI analysis";
        let tags = r#"["updated", "tags"]"#;
        let embedding = vec![0.5, 0.6, 0.7, 0.8];

        database.update_file_analysis(&file_record.id, content, analysis, Some(tags), Some(&embedding)).await
            .expect("Failed to update file analysis");

        let updated = database.get_file_by_path(&file_record.path).await
            .expect("Failed to retrieve file")
            .expect("File not found");

        assert_eq!(updated.content, Some(content.to_string()));
        assert_eq!(updated.ai_analysis, Some(analysis.to_string()));
        assert_eq!(updated.tags, Some(tags.to_string()));
        assert_eq!(updated.embedding, Some(embedding));
        assert_eq!(updated.processing_status, "completed");
        assert!(updated.indexed_at.is_some());
    }

    #[tokio::test]
    async fn test_get_files_by_status() {
        let (database, _temp_dir) = create_test_database().await;
        
        // Create files with different statuses
        let mut file1 = create_test_file_record();
        file1.path = "/test/file1.txt".to_string();
        file1.processing_status = "pending".to_string();

        let mut file2 = create_test_file_record();
        file2.path = "/test/file2.txt".to_string();
        file2.processing_status = "completed".to_string();

        let mut file3 = create_test_file_record();
        file3.path = "/test/file3.txt".to_string();
        file3.processing_status = "pending".to_string();

        database.insert_file(&file1).await.expect("Failed to insert file1");
        database.insert_file(&file2).await.expect("Failed to insert file2");
        database.insert_file(&file3).await.expect("Failed to insert file3");

        // Get pending files
        let pending_files = database.get_files_by_status("pending").await
            .expect("Failed to get pending files");
        assert_eq!(pending_files.len(), 2);

        // Get completed files
        let completed_files = database.get_files_by_status("completed").await
            .expect("Failed to get completed files");
        assert_eq!(completed_files.len(), 1);
        assert_eq!(completed_files[0].id, file2.id);
    }

    #[tokio::test]
    async fn test_search_files() {
        let (database, _temp_dir) = create_test_database().await;
        
        let mut file1 = create_test_file_record();
        file1.path = "/test/document.pdf".to_string();
        file1.name = "document.pdf".to_string();
        file1.content = Some("This is a PDF document about machine learning".to_string());

        let mut file2 = create_test_file_record();
        file2.path = "/test/image.jpg".to_string();
        file2.name = "image.jpg".to_string();
        file2.content = Some("Image file description".to_string());

        let mut file3 = create_test_file_record();
        file3.path = "/test/report.txt".to_string();
        file3.name = "report.txt".to_string();
        file3.content = Some("Annual report with machine learning insights".to_string());

        database.insert_file(&file1).await.expect("Failed to insert file1");
        database.insert_file(&file2).await.expect("Failed to insert file2");
        database.insert_file(&file3).await.expect("Failed to insert file3");

        // Search for "machine learning"
        let results = database.search_files("machine learning", 10, 0).await
            .expect("Failed to search files");
        
        assert_eq!(results.len(), 2);
        let result_paths: Vec<&String> = results.iter().map(|f| &f.path).collect();
        assert!(result_paths.contains(&&file1.path));
        assert!(result_paths.contains(&&file3.path));

        // Search for "image"
        let image_results = database.search_files("image", 10, 0).await
            .expect("Failed to search files");
        
        assert_eq!(image_results.len(), 1);
        assert_eq!(image_results[0].path, file2.path);
    }

    #[tokio::test]
    async fn test_search_files_with_embeddings() {
        let (database, _temp_dir) = create_test_database().await;
        
        let mut file_with_embedding = create_test_file_record();
        file_with_embedding.path = "/test/with_embedding.txt".to_string();
        file_with_embedding.content = Some("Content with embedding".to_string());
        file_with_embedding.embedding = Some(vec![0.1, 0.2, 0.3]);

        let mut file_without_embedding = create_test_file_record();
        file_without_embedding.path = "/test/without_embedding.txt".to_string();
        file_without_embedding.content = Some("Content without embedding".to_string());
        file_without_embedding.embedding = None;

        database.insert_file(&file_with_embedding).await.expect("Failed to insert file with embedding");
        database.insert_file(&file_without_embedding).await.expect("Failed to insert file without embedding");

        // Search for files with embeddings
        let results = database.search_files_with_embeddings("content", 10).await
            .expect("Failed to search files with embeddings");
        
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, file_with_embedding.path);
        assert!(results[0].embedding.is_some());
    }

    #[tokio::test]
    async fn test_processing_stats() {
        let (database, _temp_dir) = create_test_database().await;
        
        // Create files with different statuses
        let statuses = vec!["completed", "pending", "processing", "error", "completed"];
        for (i, status) in statuses.iter().enumerate() {
            let mut file = create_test_file_record();
            file.path = format!("/test/file{}.txt", i);
            file.processing_status = status.to_string();
            database.insert_file(&file).await.expect("Failed to insert file");
        }

        let stats = database.get_processing_stats().await
            .expect("Failed to get processing stats");

        let stats_obj = stats.as_object().expect("Stats should be an object");
        assert_eq!(stats_obj["total_processed"].as_i64().unwrap(), 2); // 2 completed
        assert_eq!(stats_obj["queue_size"].as_i64().unwrap(), 1); // 1 pending
        assert_eq!(stats_obj["current_processing"].as_i64().unwrap(), 1); // 1 processing
        assert_eq!(stats_obj["errors"].as_i64().unwrap(), 1); // 1 error
    }

    #[tokio::test]
    async fn test_collection_operations() {
        let (database, _temp_dir) = create_test_database().await;
        
        // Create collection
        let collection = database.create_collection("Test Collection", Some("Test description")).await
            .expect("Failed to create collection");

        assert_eq!(collection.name, "Test Collection");
        assert_eq!(collection.description, Some("Test description".to_string()));
        assert_eq!(collection.file_count, 0);

        // Get collections
        let collections = database.get_collections().await
            .expect("Failed to get collections");
        assert_eq!(collections.len(), 1);
        assert_eq!(collections[0].id, collection.id);

        // Update collection
        database.update_collection(&collection.id, Some("Updated Name"), None).await
            .expect("Failed to update collection");

        let updated_collection = database.get_collection_by_id(&collection.id).await
            .expect("Failed to get collection by id")
            .expect("Collection not found");
        assert_eq!(updated_collection.name, "Updated Name");

        // Delete collection
        database.delete_collection(&collection.id).await
            .expect("Failed to delete collection");

        let deleted_collection = database.get_collection_by_id(&collection.id).await
            .expect("Failed to check for deleted collection");
        assert!(deleted_collection.is_none());
    }

    #[tokio::test]
    async fn test_file_collection_operations() {
        let (database, _temp_dir) = create_test_database().await;
        
        // Create file and collection
        let file_record = create_test_file_record();
        database.insert_file(&file_record).await.expect("Failed to insert file");

        let collection = database.create_collection("Test Collection", None).await
            .expect("Failed to create collection");

        // Add file to collection
        database.add_file_to_collection(&file_record.id, &collection.id).await
            .expect("Failed to add file to collection");

        // Check collection file count updated
        let updated_collection = database.get_collection_by_id(&collection.id).await
            .expect("Failed to get collection")
            .expect("Collection not found");
        assert_eq!(updated_collection.file_count, 1);

        // Get files in collection
        let files_in_collection = database.get_files_in_collection(&collection.id).await
            .expect("Failed to get files in collection");
        assert_eq!(files_in_collection.len(), 1);
        assert_eq!(files_in_collection[0].id, file_record.id);

        // Remove file from collection
        database.remove_file_from_collection(&file_record.id, &collection.id).await
            .expect("Failed to remove file from collection");

        let final_collection = database.get_collection_by_id(&collection.id).await
            .expect("Failed to get collection")
            .expect("Collection not found");
        assert_eq!(final_collection.file_count, 0);

        let empty_files = database.get_files_in_collection(&collection.id).await
            .expect("Failed to get files in collection");
        assert_eq!(empty_files.len(), 0);
    }

    #[tokio::test]
    async fn test_location_stats() {
        let (database, _temp_dir) = create_test_database().await;
        
        // Create files in different locations with different statuses
        let locations_and_statuses = vec![
            ("/test/dir/file1.txt", "completed"),
            ("/test/dir/file2.txt", "pending"),
            ("/test/dir/subdir/file3.txt", "error"),
            ("/other/file4.txt", "completed"),
        ];

        for (path, status) in locations_and_statuses {
            let mut file = create_test_file_record();
            file.path = path.to_string();
            file.processing_status = status.to_string();
            database.insert_file(&file).await.expect("Failed to insert file");
        }

        // Get stats for /test/dir (should include subdirectories)
        let stats = database.get_location_stats("/test/dir").await
            .expect("Failed to get location stats");

        let stats_obj = stats.as_object().expect("Stats should be an object");
        assert_eq!(stats_obj["total_files"].as_i64().unwrap(), 3);
        assert_eq!(stats_obj["processed_files"].as_i64().unwrap(), 1);
        assert_eq!(stats_obj["pending_files"].as_i64().unwrap(), 1); // pending + processing
        assert_eq!(stats_obj["error_files"].as_i64().unwrap(), 1);
    }

    #[tokio::test]
    async fn test_insights_data() {
        let (database, _temp_dir) = create_test_database().await;
        
        // Create files with different extensions
        let files_data = vec![
            ("file1.pdf", "completed"),
            ("file2.docx", "completed"),
            ("image1.jpg", "completed"),
            ("image2.png", "completed"),
            ("script.js", "completed"),
            ("style.css", "error"),
        ];

        for (name, status) in files_data {
            let mut file = create_test_file_record();
            file.path = format!("/test/{}", name);
            file.name = name.to_string();
            file.extension = Some(name.split('.').last().unwrap().to_string());
            file.processing_status = status.to_string();
            database.insert_file(&file).await.expect("Failed to insert file");
        }

        let insights = database.get_insights_data().await
            .expect("Failed to get insights data");

        let insights_obj = insights.as_object().expect("Insights should be an object");
        
        // Check file types
        let file_types = insights_obj["file_types"].as_object().unwrap();
        assert_eq!(file_types["documents"].as_i64().unwrap(), 2); // pdf, docx
        assert_eq!(file_types["images"].as_i64().unwrap(), 2); // jpg, png
        assert_eq!(file_types["code"].as_i64().unwrap(), 1); // js (css is error status)
        
        // Check processing summary
        let processing_summary = insights_obj["processing_summary"].as_object().unwrap();
        assert_eq!(processing_summary["total_files"].as_i64().unwrap(), 6);
        assert_eq!(processing_summary["completed_files"].as_i64().unwrap(), 5);
        assert_eq!(processing_summary["error_files"].as_i64().unwrap(), 1);
    }
}