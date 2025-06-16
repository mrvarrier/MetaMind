use crate::config::{AIConfig, AIProvider};
use crate::error::{AppError, AppResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalysis {
    pub summary: String,
    pub tags: Vec<String>,
    pub category: String,
    pub sentiment: Option<f32>,
    pub key_entities: Vec<String>,
    pub topics: Vec<String>,
    pub language: Option<String>,
    pub confidence: f32,
    pub embedding: Option<Vec<f32>>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAnalysis {
    pub description: String,
    pub objects: Vec<String>,
    pub text_content: Option<String>,
    pub colors: Vec<String>,
    pub style: Option<String>,
    pub faces_count: Option<u32>,
    pub exif_data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentAnalysis {
    pub content: String,
    pub structure: DocumentStructure,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentStructure {
    pub headings: Vec<String>,
    pub paragraphs: u32,
    pub tables: u32,
    pub images: u32,
    pub links: u32,
}

#[derive(Debug)]
pub struct AIManager {
    config: Arc<RwLock<AIConfig>>,
    http_client: Client,
    ollama_client: OllamaClient,
}

#[derive(Debug)]
struct OllamaClient {
    base_url: String,
    client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
    done: bool,
    context: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EmbeddingRequest {
    model: String,
    prompt: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct EmbeddingResponse {
    embedding: Vec<f32>,
}

impl AIManager {
    pub async fn new(config: Arc<RwLock<AIConfig>>) -> AppResult<Self> {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()?;

        let config_read = config.read().await;
        let ollama_client = OllamaClient::new(&config_read.ollama_url);

        Ok(Self {
            config,
            http_client,
            ollama_client,
        })
    }

    pub async fn analyze_file(&self, path: &Path) -> AppResult<AIAnalysis> {
        let extension = path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match extension.to_lowercase().as_str() {
            "txt" | "md" | "rst" => self.analyze_text_file(path).await,
            "pdf" => self.analyze_pdf(path).await,
            "docx" | "doc" => self.analyze_document(path).await,
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tiff" => self.analyze_image(path).await,
            "mp3" | "wav" | "aac" | "flac" => self.analyze_audio(path).await,
            "mp4" | "avi" | "mov" | "mkv" => self.analyze_video(path).await,
            "py" | "js" | "ts" | "rs" | "go" | "java" | "cpp" | "c" => self.analyze_code(path).await,
            _ => self.analyze_generic_file(path).await,
        }
    }

    async fn analyze_text_file(&self, path: &Path) -> AppResult<AIAnalysis> {
        let content = tokio::fs::read_to_string(path).await?;
        
        if content.len() > 50000 {
            // Truncate very large files
            let truncated = &content[..50000];
            self.analyze_text_content(truncated).await
        } else {
            self.analyze_text_content(&content).await
        }
    }

    async fn analyze_text_content(&self, content: &str) -> AppResult<AIAnalysis> {
        let prompt = format!(
            r#"Analyze this text and provide a structured analysis in JSON format:

Text: {}

Please provide:
1. A concise summary (max 200 words)
2. Key tags/keywords (max 10)
3. Category (e.g., document, article, note, code, etc.)
4. Sentiment score (-1 to 1, if applicable)
5. Key entities (people, places, organizations)
6. Main topics/themes
7. Language (if detectable)
8. Confidence score (0-1)

Format as JSON with these exact keys: summary, tags, category, sentiment, key_entities, topics, language, confidence"#,
            content
        );

        let config = self.config.read().await;
        let response = self.ollama_client.generate(&config.model_preferences.text_analysis, &prompt).await?;
        
        // Parse the JSON response
        let analysis_data: serde_json::Value = serde_json::from_str(&response)
            .unwrap_or_else(|_| self.create_fallback_analysis(content));

        // Generate embedding
        let embedding = self.generate_embedding(content).await.ok();

        Ok(AIAnalysis {
            summary: analysis_data["summary"].as_str().unwrap_or("").to_string(),
            tags: analysis_data["tags"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            category: analysis_data["category"].as_str().unwrap_or("document").to_string(),
            sentiment: analysis_data["sentiment"].as_f64().map(|s| s as f32),
            key_entities: analysis_data["key_entities"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            topics: analysis_data["topics"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            language: analysis_data["language"].as_str().map(String::from),
            confidence: analysis_data["confidence"].as_f64().unwrap_or(0.7) as f32,
            embedding,
            metadata: analysis_data,
        })
    }

    async fn analyze_image(&self, path: &Path) -> AppResult<AIAnalysis> {
        // First, extract EXIF data
        let exif_data = self.extract_exif_data(path).await.ok();
        
        // For image analysis, we'd need a vision model
        let config = self.config.read().await;
        let prompt = format!(
            "Analyze this image file: {}. Describe what you see, identify objects, extract any text, and categorize the image type.",
            path.display()
        );

        // This is a simplified version - in practice, you'd send the image to a vision model
        let fallback_analysis = serde_json::json!({
            "summary": format!("Image file: {}", path.file_name().unwrap_or_default().to_string_lossy()),
            "tags": ["image", "visual"],
            "category": "image",
            "confidence": 0.5,
            "key_entities": [],
            "topics": ["visual", "media"],
            "language": null
        });

        Ok(AIAnalysis {
            summary: format!("Image file: {}", path.file_name().unwrap_or_default().to_string_lossy()),
            tags: vec!["image".to_string(), "visual".to_string()],
            category: "image".to_string(),
            sentiment: None,
            key_entities: vec![],
            topics: vec!["visual".to_string(), "media".to_string()],
            language: None,
            confidence: 0.5,
            embedding: None,
            metadata: fallback_analysis,
        })
    }

    async fn analyze_pdf(&self, path: &Path) -> AppResult<AIAnalysis> {
        // Extract text from PDF
        let text_content = self.extract_pdf_text(path).await?;
        self.analyze_text_content(&text_content).await
    }

    async fn analyze_document(&self, path: &Path) -> AppResult<AIAnalysis> {
        // Extract text from Word document
        let text_content = self.extract_document_text(path).await?;
        self.analyze_text_content(&text_content).await
    }

    async fn analyze_code(&self, path: &Path) -> AppResult<AIAnalysis> {
        let content = tokio::fs::read_to_string(path).await?;
        
        let prompt = format!(
            r#"Analyze this code file and provide a structured analysis:

Code: {}

Provide:
1. Summary of what the code does
2. Programming language
3. Key functions/classes/modules
4. Complexity level
5. Purpose/category
6. Technologies/frameworks used

Format as JSON."#,
            content
        );

        let config = self.config.read().await;
        let response = self.ollama_client.generate(&config.model_preferences.code_analysis, &prompt).await?;
        
        let analysis_data: serde_json::Value = serde_json::from_str(&response)
            .unwrap_or_else(|_| self.create_fallback_code_analysis(&content));

        let embedding = self.generate_embedding(&content).await.ok();

        Ok(AIAnalysis {
            summary: analysis_data["summary"].as_str().unwrap_or("").to_string(),
            tags: analysis_data["tags"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_else(|| vec!["code".to_string()]),
            category: "code".to_string(),
            sentiment: None,
            key_entities: analysis_data["key_entities"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            topics: analysis_data["topics"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_else(|| vec!["programming".to_string()]),
            language: analysis_data["language"].as_str().map(String::from),
            confidence: analysis_data["confidence"].as_f64().unwrap_or(0.8) as f32,
            embedding,
            metadata: analysis_data,
        })
    }

    async fn analyze_audio(&self, _path: &Path) -> AppResult<AIAnalysis> {
        // Placeholder for audio analysis
        Ok(AIAnalysis {
            summary: "Audio file".to_string(),
            tags: vec!["audio".to_string(), "media".to_string()],
            category: "audio".to_string(),
            sentiment: None,
            key_entities: vec![],
            topics: vec!["audio".to_string(), "media".to_string()],
            language: None,
            confidence: 0.5,
            embedding: None,
            metadata: serde_json::json!({}),
        })
    }

    async fn analyze_video(&self, _path: &Path) -> AppResult<AIAnalysis> {
        // Placeholder for video analysis
        Ok(AIAnalysis {
            summary: "Video file".to_string(),
            tags: vec!["video".to_string(), "media".to_string()],
            category: "video".to_string(),
            sentiment: None,
            key_entities: vec![],
            topics: vec!["video".to_string(), "media".to_string()],
            language: None,
            confidence: 0.5,
            embedding: None,
            metadata: serde_json::json!({}),
        })
    }

    async fn analyze_generic_file(&self, path: &Path) -> AppResult<AIAnalysis> {
        let file_name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        Ok(AIAnalysis {
            summary: format!("File: {}", file_name),
            tags: vec!["file".to_string()],
            category: "unknown".to_string(),
            sentiment: None,
            key_entities: vec![],
            topics: vec!["file".to_string()],
            language: None,
            confidence: 0.3,
            embedding: None,
            metadata: serde_json::json!({"file_name": file_name}),
        })
    }

    async fn generate_embedding(&self, text: &str) -> AppResult<Vec<f32>> {
        let config = self.config.read().await;
        self.ollama_client.generate_embedding(&config.model_preferences.embedding_model, text).await
    }

    async fn extract_pdf_text(&self, _path: &Path) -> AppResult<String> {
        // Placeholder - would use pdf-extract or similar
        Ok("PDF content placeholder".to_string())
    }

    async fn extract_document_text(&self, _path: &Path) -> AppResult<String> {
        // Placeholder - would use docx-rs or similar
        Ok("Document content placeholder".to_string())
    }

    async fn extract_exif_data(&self, _path: &Path) -> AppResult<serde_json::Value> {
        // Placeholder - would use exif crate
        Ok(serde_json::json!({}))
    }

    fn create_fallback_analysis(&self, content: &str) -> serde_json::Value {
        let words: Vec<&str> = content.split_whitespace().take(50).collect();
        let summary = if words.len() > 20 {
            format!("Content starting with: {}", words[..20].join(" "))
        } else {
            words.join(" ")
        };

        serde_json::json!({
            "summary": summary,
            "tags": ["text", "document"],
            "category": "document",
            "sentiment": null,
            "key_entities": [],
            "topics": ["text"],
            "language": "unknown",
            "confidence": 0.3
        })
    }

    fn create_fallback_code_analysis(&self, content: &str) -> serde_json::Value {
        let lines: Vec<&str> = content.lines().take(10).collect();
        let summary = format!("Code file with {} lines", content.lines().count());

        serde_json::json!({
            "summary": summary,
            "tags": ["code", "programming"],
            "category": "code",
            "sentiment": null,
            "key_entities": [],
            "topics": ["programming", "code"],
            "language": "unknown",
            "confidence": 0.5
        })
    }
}

impl OllamaClient {
    fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }

    async fn generate(&self, model: &str, prompt: &str) -> AppResult<String> {
        let request = OllamaRequest {
            model: model.to_string(),
            prompt: prompt.to_string(),
            stream: false,
            options: None,
        };

        let response = self.client
            .post(&format!("{}/api/generate", self.base_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AIProcessing(format!(
                "Ollama API error: {}",
                response.status()
            )));
        }

        let ollama_response: OllamaResponse = response.json().await?;
        Ok(ollama_response.response)
    }

    async fn generate_embedding(&self, model: &str, text: &str) -> AppResult<Vec<f32>> {
        let request = EmbeddingRequest {
            model: model.to_string(),
            prompt: text.to_string(),
        };

        let response = self.client
            .post(&format!("{}/api/embeddings", self.base_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AIProcessing(format!(
                "Ollama embedding API error: {}",
                response.status()
            )));
        }

        let embedding_response: EmbeddingResponse = response.json().await?;
        Ok(embedding_response.embedding)
    }
}