use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde::{Serialize, Deserialize};
use reqwest::Client;
use tokio::time::{timeout, Duration};

use crate::content_extractor::ExtractedContent;

#[derive(Debug, Serialize, Deserialize)]
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
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: Option<OllamaOptions>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaOptions {
    temperature: f32,
    top_p: f32,
    max_tokens: Option<u32>,
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

#[derive(Debug, Clone)]
pub struct AIProcessor {
    client: Client,
    ollama_url: String,
    model: String,
    embedding_model: String,
}

impl AIProcessor {
    pub fn new(ollama_url: String, model: String) -> Self {
        Self {
            client: Client::new(),
            ollama_url,
            model,
            embedding_model: "nomic-embed-text".to_string(), // Default embedding model
        }
    }

    pub async fn analyze_content(&self, content: &ExtractedContent) -> Result<AIAnalysis> {
        // Create analysis prompt based on content type
        let prompt = self.create_analysis_prompt(content);
        
        // Get AI analysis
        let analysis_text = self.query_ollama(&prompt).await?;
        
        // Generate embeddings
        let embedding = self.generate_embedding(&content.text).await.ok();
        
        // Parse the analysis response
        let analysis = self.parse_analysis_response(&analysis_text, content, embedding)?;
        
        Ok(analysis)
    }

    fn create_analysis_prompt(&self, content: &ExtractedContent) -> String {
        let content_preview = if content.text.len() > 2000 {
            format!("{}...", &content.text[..2000])
        } else {
            content.text.clone()
        };

        match content.file_type.as_str() {
            "pdf" | "document" => {
                format!(
                    r#"Analyze this document content and provide:
1. A brief summary (2-3 sentences)
2. 5-10 relevant tags/keywords
3. Document category (e.g., report, manual, article, legal, academic, etc.)
4. Key entities mentioned (people, organizations, locations)
5. Main topics discussed
6. Sentiment (positive/negative/neutral as a number from -1 to 1)

Content:
{}

Respond in JSON format:
{{
  "summary": "...",
  "tags": ["tag1", "tag2", ...],
  "category": "...",
  "sentiment": 0.0,
  "key_entities": ["entity1", "entity2", ...],
  "topics": ["topic1", "topic2", ...],
  "language": "english",
  "confidence": 0.85
}}"#,
                    content_preview
                )
            }
            "code" => {
                format!(
                    r#"Analyze this code file and provide:
1. A brief description of what the code does
2. Programming language and framework tags
3. Code category (e.g., frontend, backend, utility, test, config, etc.)
4. Key functions/classes/modules identified
5. Main topics/purposes

Code content:
{}

Respond in JSON format:
{{
  "summary": "...",
  "tags": ["programming_language", "framework", "concept1", ...],
  "category": "...",
  "sentiment": 0.0,
  "key_entities": ["function1", "class1", ...],
  "topics": ["purpose1", "concept1", ...],
  "language": "programming",
  "confidence": 0.9
}}"#,
                    content_preview
                )
            }
            "image" => {
                format!(
                    r#"Analyze this image metadata and provide:
1. Description based on available metadata
2. Relevant tags for the image
3. Image category (e.g., photo, screenshot, diagram, artwork, etc.)
4. Any identifiable elements from metadata

Image information:
{}

Respond in JSON format:
{{
  "summary": "...",
  "tags": ["image_type", "subject", ...],
  "category": "...",
  "sentiment": 0.0,
  "key_entities": ["element1", "element2", ...],
  "topics": ["subject1", "theme1", ...],
  "language": "visual",
  "confidence": 0.7
}}"#,
                    content_preview
                )
            }
            _ => {
                format!(
                    r#"Analyze this file content and provide:
1. A brief summary of the content
2. Relevant tags/keywords
3. Content category
4. Key elements or entities
5. Main topics

Content:
{}

Respond in JSON format:
{{
  "summary": "...",
  "tags": ["tag1", "tag2", ...],
  "category": "...",
  "sentiment": 0.0,
  "key_entities": ["entity1", "entity2", ...],
  "topics": ["topic1", "topic2", ...],
  "language": "unknown",
  "confidence": 0.75
}}"#,
                    content_preview
                )
            }
        }
    }

    async fn query_ollama(&self, prompt: &str) -> Result<String> {
        let request = OllamaRequest {
            model: self.model.clone(),
            prompt: prompt.to_string(),
            stream: false,
            options: Some(OllamaOptions {
                temperature: 0.3,
                top_p: 0.9,
                max_tokens: Some(1000),
            }),
        };

        let response = timeout(
            Duration::from_secs(60),
            self.client
                .post(&format!("{}/api/generate", self.ollama_url))
                .json(&request)
                .send()
        ).await??;

        if !response.status().is_success() {
            return Err(anyhow!("Ollama request failed: {}", response.status()));
        }

        let ollama_response: OllamaResponse = response.json().await?;
        Ok(ollama_response.response)
    }

    async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>> {
        // Truncate text if too long for embedding
        let embedding_text = if text.len() > 8000 {
            &text[..8000]
        } else {
            text
        };

        let request = EmbeddingRequest {
            model: self.embedding_model.clone(),
            prompt: embedding_text.to_string(),
        };

        let response = timeout(
            Duration::from_secs(30),
            self.client
                .post(&format!("{}/api/embeddings", self.ollama_url))
                .json(&request)
                .send()
        ).await??;

        if !response.status().is_success() {
            return Err(anyhow!("Embedding request failed: {}", response.status()));
        }

        let embedding_response: EmbeddingResponse = response.json().await?;
        Ok(embedding_response.embedding)
    }

    fn parse_analysis_response(
        &self,
        response: &str,
        content: &ExtractedContent,
        embedding: Option<Vec<f32>>,
    ) -> Result<AIAnalysis> {
        // Try to parse JSON response
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(response) {
            let summary = parsed.get("summary")
                .and_then(|v| v.as_str())
                .unwrap_or("AI analysis completed")
                .to_string();

            let tags = parsed.get("tags")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.to_string())
                        .collect()
                })
                .unwrap_or_else(|| vec!["untagged".to_string()]);

            let category = parsed.get("category")
                .and_then(|v| v.as_str())
                .unwrap_or("general")
                .to_string();

            let sentiment = parsed.get("sentiment")
                .and_then(|v| v.as_f64())
                .map(|f| f as f32);

            let key_entities = parsed.get("key_entities")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.to_string())
                        .collect()
                })
                .unwrap_or_default();

            let topics = parsed.get("topics")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| s.to_string())
                        .collect()
                })
                .unwrap_or_default();

            let language = parsed.get("language")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let confidence = parsed.get("confidence")
                .and_then(|v| v.as_f64())
                .map(|f| f as f32)
                .unwrap_or(0.5);

            let mut metadata = HashMap::new();
            metadata.insert("file_type".to_string(), serde_json::Value::String(content.file_type.clone()));
            
            if let Some(title) = &content.metadata.title {
                metadata.insert("title".to_string(), serde_json::Value::String(title.clone()));
            }
            
            if let Some(author) = &content.metadata.author {
                metadata.insert("author".to_string(), serde_json::Value::String(author.clone()));
            }

            Ok(AIAnalysis {
                summary,
                tags,
                category,
                sentiment,
                key_entities,
                topics,
                language,
                confidence,
                embedding,
                metadata,
            })
        } else {
            // Fallback: create analysis from raw response
            self.create_fallback_analysis(response, content, embedding)
        }
    }

    fn create_fallback_analysis(
        &self,
        response: &str,
        content: &ExtractedContent,
        embedding: Option<Vec<f32>>,
    ) -> Result<AIAnalysis> {
        // Extract basic information when JSON parsing fails
        let summary = if response.len() > 200 {
            format!("{}...", &response[..200])
        } else {
            response.to_string()
        };

        let tags = vec![
            content.file_type.clone(),
            "ai_analyzed".to_string(),
        ];

        let category = match content.file_type.as_str() {
            "pdf" | "document" => "document",
            "code" => "source_code",
            "image" => "image",
            "text" => "text",
            _ => "general",
        }.to_string();

        let mut metadata = HashMap::new();
        metadata.insert("file_type".to_string(), serde_json::Value::String(content.file_type.clone()));
        metadata.insert("analysis_method".to_string(), serde_json::Value::String("fallback".to_string()));

        Ok(AIAnalysis {
            summary,
            tags,
            category,
            sentiment: Some(0.0),
            key_entities: Vec::new(),
            topics: Vec::new(),
            language: Some("unknown".to_string()),
            confidence: 0.3,
            embedding,
            metadata,
        })
    }

    pub async fn is_available(&self) -> bool {
        match timeout(
            Duration::from_secs(5),
            self.client.get(&format!("{}/api/tags", self.ollama_url)).send()
        ).await {
            Ok(Ok(response)) => response.status().is_success(),
            _ => false,
        }
    }

    pub async fn get_available_models(&self) -> Result<Vec<String>> {
        let response = self.client
            .get(&format!("{}/api/tags", self.ollama_url))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to get models: {}", response.status()));
        }

        let models_response: serde_json::Value = response.json().await?;
        
        let models = models_response
            .get("models")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|model| model.get("name"))
                    .filter_map(|name| name.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    }
}