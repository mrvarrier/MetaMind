use std::path::Path;
use anyhow::{Result, anyhow};
use tokio::fs;
use serde::{Serialize, Deserialize};
// extern crate kamadak_exif as exif; // Temporarily disabled

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractedContent {
    pub text: String,
    pub metadata: ContentMetadata,
    pub file_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub created_date: Option<String>,
    pub modified_date: Option<String>,
    pub page_count: Option<u32>,
    pub word_count: Option<u32>,
    pub language: Option<String>,
    pub subject: Option<String>,
    pub keywords: Vec<String>,
    pub image_count: Option<u32>,
    pub dimensions: Option<(u32, u32)>,
    pub exif_data: Option<serde_json::Value>,
}

impl Default for ContentMetadata {
    fn default() -> Self {
        Self {
            title: None,
            author: None,
            created_date: None,
            modified_date: None,
            page_count: None,
            word_count: None,
            language: None,
            subject: None,
            keywords: Vec::new(),
            image_count: None,
            dimensions: None,
            exif_data: None,
        }
    }
}

pub struct ContentExtractor;

impl ContentExtractor {
    pub async fn extract_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let extension = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        match extension.as_str() {
            "pdf" => Self::extract_pdf_content(path).await,
            "txt" | "md" | "readme" => Self::extract_text_content(path).await,
            "jpg" | "jpeg" | "png" | "tiff" | "tif" | "bmp" | "gif" => Self::extract_image_content(path).await,
            "doc" | "docx" => Self::extract_document_content(path).await,
            "json" => Self::extract_json_content(path).await,
            "csv" => Self::extract_csv_content(path).await,
            "xml" | "html" | "htm" => Self::extract_markup_content(path).await,
            "js" | "ts" | "py" | "rs" | "java" | "cpp" | "c" | "h" | "css" | "scss" | "sass" => {
                Self::extract_code_content(path).await
            }
            _ => Self::extract_generic_content(path).await,
        }
    }

    async fn extract_pdf_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let bytes = fs::read(path).await?;
        
        match pdf_extract::extract_text_from_mem(&bytes) {
            Ok(text) => {
                let mut metadata = ContentMetadata::default();
                
                // Try to extract PDF metadata using lopdf
                if let Ok(doc) = lopdf::Document::load_mem(&bytes) {
                    if let Ok(info) = doc.trailer.get(b"Info") {
                        if let Ok(info_dict) = info.as_dict() {
                            if let Ok(title) = info_dict.get(b"Title") {
                                if let Ok(title_str) = title.as_str() {
                                    metadata.title = Some(title_str.to_string());
                                }
                            }
                            if let Ok(author) = info_dict.get(b"Author") {
                                if let Ok(author_str) = author.as_str() {
                                    metadata.author = Some(author_str.to_string());
                                }
                            }
                            if let Ok(subject) = info_dict.get(b"Subject") {
                                if let Ok(subject_str) = subject.as_str() {
                                    metadata.subject = Some(subject_str.to_string());
                                }
                            }
                        }
                    }
                    
                    // Get page count
                    metadata.page_count = Some(doc.get_pages().len() as u32);
                }
                
                // Count words
                metadata.word_count = Some(text.split_whitespace().count() as u32);
                
                Ok(ExtractedContent {
                    text: text.trim().to_string(),
                    metadata,
                    file_type: "pdf".to_string(),
                })
            }
            Err(e) => Err(anyhow!("Failed to extract PDF content: {}", e)),
        }
    }

    async fn extract_text_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let text = fs::read_to_string(path).await?;
        
        let mut metadata = ContentMetadata::default();
        metadata.word_count = Some(text.split_whitespace().count() as u32);
        
        // Try to detect language (simple heuristic)
        metadata.language = Self::detect_language(&text);
        
        // Extract title from first line if it looks like a title
        if let Some(first_line) = text.lines().next() {
            if first_line.len() < 100 && (first_line.starts_with('#') || first_line.to_uppercase() == first_line) {
                metadata.title = Some(first_line.trim_start_matches('#').trim().to_string());
            }
        }

        Ok(ExtractedContent {
            text,
            metadata,
            file_type: "text".to_string(),
        })
    }

    async fn extract_image_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let bytes = fs::read(path).await?;
        
        let mut metadata = ContentMetadata::default();
        let mut text = String::new();
        
        // Try to open image and get dimensions
        if let Ok(img) = image::load_from_memory(&bytes) {
            metadata.dimensions = Some((img.width(), img.height()));
            text.push_str(&format!("Image dimensions: {}x{}\n", img.width(), img.height()));
        }
        
        // Try to extract EXIF data (temporarily disabled for compilation)
        // TODO: Re-enable EXIF extraction once compatibility issues are resolved
        /*
        if let Ok(exif_reader) = exif::Reader::new() {
            if let Ok(exif_data) = exif_reader.read_from_container(&mut std::io::Cursor::new(&bytes)) {
                let mut exif_json = serde_json::Map::new();
                
                for field in exif_data.fields() {
                    let tag_name = format!("{}", field.tag);
                    let value_str = field.display_value().to_string();
                    exif_json.insert(tag_name, serde_json::Value::String(value_str.clone()));
                    
                    // Add important EXIF data to text for searching
                    if field.tag == exif::Tag::DateTime || 
                       field.tag == exif::Tag::Make || 
                       field.tag == exif::Tag::Model ||
                       field.tag == exif::Tag::Software {
                        text.push_str(&format!("{}: {}\n", field.tag, value_str));
                    }
                }
                
                metadata.exif_data = Some(serde_json::Value::Object(exif_json));
            }
        }
        */
        
        // Generate descriptive text for the image
        if text.is_empty() {
            text = format!("Image file: {}", path.file_name().unwrap_or_default().to_string_lossy());
        }

        Ok(ExtractedContent {
            text,
            metadata,
            file_type: "image".to_string(),
        })
    }

    async fn extract_document_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        // For now, treat as binary and extract basic info
        // In a full implementation, you'd use libraries like docx-rs or similar
        let path = path.as_ref();
        let metadata_std = fs::metadata(path).await?;
        
        let mut metadata = ContentMetadata::default();
        let text = format!(
            "Document file: {}\nSize: {} bytes\nExtension: {}",
            path.file_name().unwrap_or_default().to_string_lossy(),
            metadata_std.len(),
            path.extension().unwrap_or_default().to_string_lossy()
        );

        Ok(ExtractedContent {
            text,
            metadata,
            file_type: "document".to_string(),
        })
    }

    async fn extract_json_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let text = fs::read_to_string(path).await?;
        
        let mut metadata = ContentMetadata::default();
        
        // Try to parse JSON and extract useful information
        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&text) {
            let mut searchable_text = String::new();
            Self::extract_json_text(&json_value, &mut searchable_text);
            
            metadata.word_count = Some(searchable_text.split_whitespace().count() as u32);
            
            Ok(ExtractedContent {
                text: searchable_text,
                metadata,
                file_type: "json".to_string(),
            })
        } else {
            // If not valid JSON, treat as text
            Self::extract_text_content(path).await
        }
    }

    async fn extract_csv_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let text = fs::read_to_string(path).await?;
        
        let mut metadata = ContentMetadata::default();
        let lines: Vec<&str> = text.lines().collect();
        
        // Extract header and some sample data for searching
        let mut searchable_text = String::new();
        
        if !lines.is_empty() {
            searchable_text.push_str("CSV Headers: ");
            searchable_text.push_str(lines[0]);
            searchable_text.push('\n');
            
            // Add a few sample rows
            for (i, line) in lines.iter().skip(1).take(5).enumerate() {
                searchable_text.push_str(&format!("Row {}: {}\n", i + 1, line));
            }
        }
        
        metadata.word_count = Some(searchable_text.split_whitespace().count() as u32);

        Ok(ExtractedContent {
            text: searchable_text,
            metadata,
            file_type: "csv".to_string(),
        })
    }

    async fn extract_markup_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let text = fs::read_to_string(path).await?;
        
        let mut metadata = ContentMetadata::default();
        
        // Basic HTML/XML content extraction (remove tags)
        let content = Self::strip_html_tags(&text);
        metadata.word_count = Some(content.split_whitespace().count() as u32);
        
        // Try to extract title from HTML
        if let Some(title_start) = text.find("<title>") {
            if let Some(title_end) = text[title_start..].find("</title>") {
                let title = &text[title_start + 7..title_start + title_end];
                metadata.title = Some(title.trim().to_string());
            }
        }

        Ok(ExtractedContent {
            text: content,
            metadata,
            file_type: "markup".to_string(),
        })
    }

    async fn extract_code_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        let text = fs::read_to_string(path).await?;
        
        let mut metadata = ContentMetadata::default();
        metadata.word_count = Some(text.split_whitespace().count() as u32);
        
        // Extract comments and function names for better searchability
        let mut searchable_text = text.clone();
        
        // Add file extension as context
        if let Some(ext) = path.extension() {
            searchable_text.push_str(&format!("\nFile type: {}", ext.to_string_lossy()));
        }

        Ok(ExtractedContent {
            text: searchable_text,
            metadata,
            file_type: "code".to_string(),
        })
    }

    async fn extract_generic_content<P: AsRef<Path>>(path: P) -> Result<ExtractedContent> {
        let path = path.as_ref();
        
        // Try to read as text first
        if let Ok(text) = fs::read_to_string(path).await {
            if text.is_ascii() || text.chars().all(|c| !c.is_control() || c.is_whitespace()) {
                return Self::extract_text_content(path).await;
            }
        }
        
        // If not readable as text, extract metadata only
        let metadata_std = fs::metadata(path).await?;
        let mut metadata = ContentMetadata::default();
        
        let text = format!(
            "Binary file: {}\nSize: {} bytes\nExtension: {}",
            path.file_name().unwrap_or_default().to_string_lossy(),
            metadata_std.len(),
            path.extension().unwrap_or_default().to_string_lossy()
        );

        Ok(ExtractedContent {
            text,
            metadata,
            file_type: "binary".to_string(),
        })
    }

    fn extract_json_text(value: &serde_json::Value, text: &mut String) {
        match value {
            serde_json::Value::String(s) => {
                text.push_str(s);
                text.push(' ');
            }
            serde_json::Value::Object(map) => {
                for (key, val) in map {
                    text.push_str(key);
                    text.push(' ');
                    Self::extract_json_text(val, text);
                }
            }
            serde_json::Value::Array(arr) => {
                for val in arr {
                    Self::extract_json_text(val, text);
                }
            }
            serde_json::Value::Number(n) => {
                text.push_str(&n.to_string());
                text.push(' ');
            }
            serde_json::Value::Bool(b) => {
                text.push_str(&b.to_string());
                text.push(' ');
            }
            serde_json::Value::Null => {
                text.push_str("null ");
            }
        }
    }

    fn strip_html_tags(html: &str) -> String {
        let mut result = String::new();
        let mut in_tag = false;
        
        for ch in html.chars() {
            match ch {
                '<' => in_tag = true,
                '>' => in_tag = false,
                _ if !in_tag => result.push(ch),
                _ => {}
            }
        }
        
        result.trim().to_string()
    }

    fn detect_language(text: &str) -> Option<String> {
        // Very basic language detection - in production use a proper library
        let sample = text.chars().take(1000).collect::<String>();
        
        if sample.chars().any(|c| c as u32 > 127) {
            Some("non-english".to_string())
        } else {
            Some("english".to_string())
        }
    }
}