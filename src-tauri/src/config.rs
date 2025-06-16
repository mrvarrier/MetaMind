use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub ai: AIConfig,
    pub search: SearchConfig,
    pub monitoring: MonitoringConfig,
    pub ui: UIConfig,
    pub performance: PerformanceConfig,
    pub privacy: PrivacyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub primary_provider: AIProvider,
    pub fallback_provider: Option<AIProvider>,
    pub ollama_url: String,
    pub model_preferences: ModelPreferences,
    pub processing_queue_size: usize,
    pub batch_size: usize,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AIProvider {
    Ollama { model: String, url: String },
    OpenAI { api_key: String, model: String },
    Anthropic { api_key: String, model: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPreferences {
    pub text_analysis: String,
    pub image_analysis: String,
    pub document_analysis: String,
    pub code_analysis: String,
    pub embedding_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    pub max_results: usize,
    pub enable_semantic_search: bool,
    pub enable_fuzzy_search: bool,
    pub cache_size: usize,
    pub index_batch_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub watched_directories: Vec<PathBuf>,
    pub excluded_patterns: Vec<String>,
    pub max_file_size_mb: u64,
    pub enable_recursive: bool,
    pub scan_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    pub theme: Theme,
    pub language: String,
    pub enable_animations: bool,
    pub compact_mode: bool,
    pub default_view: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Theme {
    Light,
    Dark,
    Auto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    pub max_cpu_usage: f32,
    pub max_memory_usage_mb: u64,
    pub enable_gpu_acceleration: bool,
    pub processing_threads: usize,
    pub enable_background_processing: bool,
    pub thermal_throttling: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyConfig {
    pub enable_telemetry: bool,
    pub enable_crash_reporting: bool,
    pub local_processing_only: bool,
    pub encrypt_sensitive_data: bool,
    pub data_retention_days: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            ai: AIConfig {
                primary_provider: AIProvider::Ollama {
                    model: "llama3.1:8b".to_string(),
                    url: "http://localhost:11434".to_string(),
                },
                fallback_provider: None,
                ollama_url: "http://localhost:11434".to_string(),
                model_preferences: ModelPreferences {
                    text_analysis: "llama3.1:8b".to_string(),
                    image_analysis: "llava:13b".to_string(),
                    document_analysis: "llama3.1:8b".to_string(),
                    code_analysis: "codellama:13b".to_string(),
                    embedding_model: "nomic-embed-text:latest".to_string(),
                },
                processing_queue_size: 1000,
                batch_size: 10,
                timeout_seconds: 300,
            },
            search: SearchConfig {
                max_results: 100,
                enable_semantic_search: true,
                enable_fuzzy_search: true,
                cache_size: 10000,
                index_batch_size: 100,
            },
            monitoring: MonitoringConfig {
                watched_directories: vec![],
                excluded_patterns: vec![
                    "*.tmp".to_string(),
                    "*.log".to_string(),
                    ".git/**".to_string(),
                    "node_modules/**".to_string(),
                    ".DS_Store".to_string(),
                ],
                max_file_size_mb: 100,
                enable_recursive: true,
                scan_interval_seconds: 30,
            },
            ui: UIConfig {
                theme: Theme::Auto,
                language: "en".to_string(),
                enable_animations: true,
                compact_mode: false,
                default_view: "grid".to_string(),
            },
            performance: PerformanceConfig {
                max_cpu_usage: 50.0,
                max_memory_usage_mb: 1024,
                enable_gpu_acceleration: true,
                processing_threads: num_cpus::get(),
                enable_background_processing: true,
                thermal_throttling: true,
            },
            privacy: PrivacyConfig {
                enable_telemetry: false,
                enable_crash_reporting: true,
                local_processing_only: false,
                encrypt_sensitive_data: true,
                data_retention_days: 30,
            },
        }
    }
}

impl AppConfig {
    pub async fn load() -> AppResult<Self> {
        let config_path = Self::config_path()?;
        
        if config_path.exists() {
            let content = fs::read_to_string(&config_path).await?;
            let config: AppConfig = serde_json::from_str(&content)?;
            Ok(config)
        } else {
            let config = Self::default();
            config.save().await?;
            Ok(config)
        }
    }

    pub async fn save(&self) -> AppResult<()> {
        let config_path = Self::config_path()?;
        
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&config_path, content).await?;
        
        Ok(())
    }

    pub fn update_from_json(&mut self, update: serde_json::Value) -> AppResult<()> {
        // Merge the update with current config
        let current_json = serde_json::to_value(self)?;
        let merged = merge_json(current_json, update);
        *self = serde_json::from_value(merged)?;
        Ok(())
    }

    fn config_path() -> AppResult<PathBuf> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| AppError::Config("Could not find config directory".to_string()))?;
        
        Ok(config_dir.join("metamind").join("config.json"))
    }
}

fn merge_json(base: serde_json::Value, update: serde_json::Value) -> serde_json::Value {
    match (base, update) {
        (serde_json::Value::Object(mut base), serde_json::Value::Object(update)) => {
            for (key, value) in update {
                match base.get(&key) {
                    Some(base_value) => {
                        base.insert(key, merge_json(base_value.clone(), value));
                    }
                    None => {
                        base.insert(key, value);
                    }
                }
            }
            serde_json::Value::Object(base)
        }
        (_, update) => update,
    }
}