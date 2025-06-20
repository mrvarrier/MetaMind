#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::{TempDir, NamedTempFile};
    use std::io::Write;
    use tokio;

    fn create_temp_file_with_content(content: &str, extension: &str) -> (TempDir, std::path::PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join(format!("test_file.{}", extension));
        std::fs::write(&file_path, content).expect("Failed to write test file");
        (temp_dir, file_path)
    }

    #[tokio::test]
    async fn test_extract_text_content() {
        let content = "This is a test text file.\nIt contains multiple lines.\nAnd some test content.";
        let (_temp_dir, file_path) = create_temp_file_with_content(content, "txt");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract text content");

        assert_eq!(result.text, content);
        assert_eq!(result.file_type, "text");
        assert_eq!(result.metadata.word_count, Some(12)); // 12 words in the content
        assert!(result.metadata.language.is_some());
    }

    #[tokio::test]
    async fn test_extract_markdown_content() {
        let content = "# Test Markdown\n\nThis is a **markdown** file with some content.";
        let (_temp_dir, file_path) = create_temp_file_with_content(content, "md");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract markdown content");

        assert_eq!(result.text, content);
        assert_eq!(result.file_type, "text");
        assert_eq!(result.metadata.title, Some("Test Markdown".to_string()));
    }

    #[tokio::test]
    async fn test_extract_json_content() {
        let json_content = r#"{
            "name": "Test Document",
            "description": "This is a test JSON file",
            "tags": ["test", "json", "document"],
            "metadata": {
                "author": "Test Author",
                "version": "1.0"
            }
        }"#;
        let (_temp_dir, file_path) = create_temp_file_with_content(json_content, "json");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract JSON content");

        assert_eq!(result.file_type, "json");
        assert!(result.text.contains("Test Document"));
        assert!(result.text.contains("test json document"));
        assert!(result.text.contains("Test Author"));
        assert!(result.metadata.word_count.is_some());
    }

    #[tokio::test]
    async fn test_extract_csv_content() {
        let csv_content = "Name,Age,City\nJohn,30,New York\nJane,25,San Francisco\nBob,35,Chicago";
        let (_temp_dir, file_path) = create_temp_file_with_content(csv_content, "csv");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract CSV content");

        assert_eq!(result.file_type, "csv");
        assert!(result.text.contains("CSV Headers: Name,Age,City"));
        assert!(result.text.contains("Row 1: John,30,New York"));
        assert!(result.metadata.word_count.is_some());
    }

    #[tokio::test]
    async fn test_extract_html_content() {
        let html_content = r#"
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test HTML Page</title>
        </head>
        <body>
            <h1>Welcome to the test page</h1>
            <p>This is a <strong>test</strong> HTML document.</p>
            <div>Some additional content here.</div>
        </body>
        </html>
        "#;
        let (_temp_dir, file_path) = create_temp_file_with_content(html_content, "html");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract HTML content");

        assert_eq!(result.file_type, "markup");
        assert_eq!(result.metadata.title, Some("Test HTML Page".to_string()));
        
        // Content should have HTML tags stripped
        assert!(result.text.contains("Welcome to the test page"));
        assert!(result.text.contains("This is a test HTML document"));
        assert!(!result.text.contains("<h1>"));
        assert!(!result.text.contains("<strong>"));
    }

    #[tokio::test]
    async fn test_extract_code_content() {
        let code_content = r#"
        // This is a test JavaScript file
        function greetUser(name) {
            console.log(`Hello, ${name}!`);
            return true;
        }
        
        const user = "Test User";
        greetUser(user);
        "#;
        let (_temp_dir, file_path) = create_temp_file_with_content(code_content, "js");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract code content");

        assert_eq!(result.file_type, "code");
        assert!(result.text.contains("function greetUser"));
        assert!(result.text.contains("File type: js"));
        assert!(result.metadata.word_count.is_some());
    }

    #[tokio::test]
    async fn test_extract_image_content() {
        // Create a minimal valid PNG file (1x1 pixel transparent PNG)
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
            0x49, 0x48, 0x44, 0x52, // IHDR
            0x00, 0x00, 0x00, 0x01, // Width: 1
            0x00, 0x00, 0x00, 0x01, // Height: 1
            0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
            0x1F, 0x15, 0xC4, 0x89, // CRC
            0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
            0x49, 0x44, 0x41, 0x54, // IDAT
            0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // Compressed data
            0x0D, 0x0A, 0x2D, 0xB4, // CRC
            0x00, 0x00, 0x00, 0x00, // IEND chunk length
            0x49, 0x45, 0x4E, 0x44, // IEND
            0xAE, 0x42, 0x60, 0x82, // CRC
        ];

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test_image.png");
        std::fs::write(&file_path, png_data).expect("Failed to write PNG file");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract image content");

        assert_eq!(result.file_type, "image");
        assert!(result.text.contains("Image dimensions: 1x1"));
        assert_eq!(result.metadata.dimensions, Some((1, 1)));
    }

    #[tokio::test]
    async fn test_extract_generic_content() {
        let (_temp_dir, file_path) = create_temp_file_with_content("test content", "unknown");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract generic content");

        // Should treat as text since it's readable
        assert_eq!(result.file_type, "text");
        assert_eq!(result.text, "test content");
    }

    #[tokio::test]
    async fn test_extract_binary_content() {
        // Create a binary file with non-text content
        let binary_data = vec![0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD];
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test_binary.bin");
        std::fs::write(&file_path, binary_data).expect("Failed to write binary file");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract binary content");

        assert_eq!(result.file_type, "binary");
        assert!(result.text.contains("Binary file: test_binary.bin"));
        assert!(result.text.contains("Size: 6 bytes"));
        assert!(result.text.contains("Extension: bin"));
    }

    #[tokio::test]
    async fn test_extract_spreadsheet_content() {
        let (_temp_dir, file_path) = create_temp_file_with_content("dummy spreadsheet content", "xlsx");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract spreadsheet content");

        assert_eq!(result.file_type, "spreadsheet");
        assert!(result.text.contains("Spreadsheet file"));
        assert!(result.text.contains("tabular data, charts, and formulas"));
    }

    #[tokio::test]
    async fn test_extract_presentation_content() {
        let (_temp_dir, file_path) = create_temp_file_with_content("dummy presentation content", "pptx");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract presentation content");

        assert_eq!(result.file_type, "presentation");
        assert!(result.text.contains("Presentation file"));
        assert!(result.text.contains("slides, images, and text content"));
    }

    #[tokio::test]
    async fn test_extract_archive_content() {
        let (_temp_dir, file_path) = create_temp_file_with_content("dummy archive content", "zip");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract archive content");

        assert_eq!(result.file_type, "archive");
        assert!(result.text.contains("Archive file"));
        assert!(result.text.contains("Compressed archive containing multiple files"));
    }

    #[tokio::test]
    async fn test_extract_audio_content() {
        let (_temp_dir, file_path) = create_temp_file_with_content("dummy audio content", "mp3");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract audio content");

        assert_eq!(result.file_type, "audio");
        assert!(result.text.contains("Audio file"));
        assert!(result.text.contains("music, speech, or sound recording"));
    }

    #[tokio::test]
    async fn test_extract_video_content() {
        let (_temp_dir, file_path) = create_temp_file_with_content("dummy video content", "mp4");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract video content");

        assert_eq!(result.file_type, "video");
        assert!(result.text.contains("Video file"));
        assert!(result.text.contains("visual and audio elements"));
    }

    #[tokio::test]
    async fn test_language_detection() {
        // Test English text
        let english_text = "This is a simple English text document.";
        assert_eq!(ContentExtractor::detect_language(english_text), Some("english".to_string()));

        // Test non-English text (using special characters)
        let non_english_text = "Héllo wörld with spëcial charactërs";
        assert_eq!(ContentExtractor::detect_language(non_english_text), Some("non-english".to_string()));
    }

    #[tokio::test]
    async fn test_strip_html_tags() {
        let html = "<div><p>Hello <strong>world</strong>!</p><br><span>More text</span></div>";
        let stripped = ContentExtractor::strip_html_tags(html);
        assert_eq!(stripped, "Hello world!More text");
    }

    #[tokio::test]
    async fn test_extract_json_text() {
        let json_value = serde_json::json!({
            "name": "Test",
            "items": ["item1", "item2"],
            "metadata": {
                "count": 42,
                "active": true
            }
        });

        let mut text = String::new();
        ContentExtractor::extract_json_text(&json_value, &mut text);

        assert!(text.contains("Test"));
        assert!(text.contains("item1"));
        assert!(text.contains("item2"));
        assert!(text.contains("42"));
        assert!(text.contains("true"));
        assert!(text.contains("name"));
        assert!(text.contains("count"));
    }

    #[tokio::test]
    async fn test_file_not_found() {
        let non_existent_path = "/this/path/does/not/exist.txt";
        
        let result = ContentExtractor::extract_content(non_existent_path).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_empty_file() {
        let (_temp_dir, file_path) = create_temp_file_with_content("", "txt");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract empty file content");

        assert_eq!(result.text, "");
        assert_eq!(result.file_type, "text");
        assert_eq!(result.metadata.word_count, Some(0));
    }

    #[tokio::test]
    async fn test_large_file_content() {
        // Create a large text content
        let large_content = "word ".repeat(1000); // 5000 characters
        let (_temp_dir, file_path) = create_temp_file_with_content(&large_content, "txt");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract large file content");

        assert_eq!(result.text, large_content);
        assert_eq!(result.file_type, "text");
        assert_eq!(result.metadata.word_count, Some(1000));
    }

    #[tokio::test]
    async fn test_invalid_json() {
        let invalid_json = "{invalid json content";
        let (_temp_dir, file_path) = create_temp_file_with_content(invalid_json, "json");

        let result = ContentExtractor::extract_content(&file_path).await
            .expect("Failed to extract invalid JSON content");

        // Should fall back to text extraction
        assert_eq!(result.file_type, "text");
        assert_eq!(result.text, invalid_json);
    }
}