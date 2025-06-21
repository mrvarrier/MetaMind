// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::State;
use tokio::sync::{RwLock, Mutex};
use serde_json;
use sysinfo::{System, SystemExt, CpuExt, DiskExt};
use sqlx::Row;

mod database;
mod file_monitor;
mod content_extractor;
mod ai_processor;
mod processing_queue;
mod updater;
mod error_reporting;
mod vector_math;
mod vector_storage;
mod semantic_search;
mod folder_vectorizer;
mod vector_cache;
mod vector_benchmarks;

use database::Database;
use file_monitor::FileMonitor;
use ai_processor::AIProcessor;
use processing_queue::ProcessingQueue;
use updater::Updater;
use error_reporting::ErrorReporter;
use vector_storage::VectorStorageManager;
use semantic_search::SemanticSearchEngine;
use folder_vectorizer::FolderVectorizer;
use vector_cache::{VectorCache, VectorCacheConfig, CacheManager};
use vector_benchmarks::{VectorBenchmarks, BenchmarkConfig};

#[derive(Debug)]
pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub database: Database,
    pub file_monitor: FileMonitor,
    pub ai_processor: AIProcessor,
    pub processing_queue: Arc<Mutex<ProcessingQueue>>,
    pub updater: Arc<Mutex<Updater>>,
    pub error_reporter: Arc<Mutex<ErrorReporter>>,
    pub vector_storage: VectorStorageManager,
    pub semantic_search: SemanticSearchEngine,
    pub folder_vectorizer: FolderVectorizer,
    pub vector_cache: Arc<VectorCache>,
    pub benchmarks: VectorBenchmarks,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub ai: AIConfig,
    pub performance: PerformanceConfig,
    pub privacy: PrivacyConfig,
    pub ui: UIConfig,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AIConfig {
    pub ollama_url: String,
    pub model: String,
    pub enabled: bool,
    pub max_content_length: usize,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PerformanceConfig {
    pub max_concurrent_jobs: usize,
    pub max_file_size_mb: u64,
    pub enable_background_processing: bool,
    pub adaptive_performance: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PrivacyConfig {
    pub local_processing_only: bool,
    pub data_retention_days: u32,
    pub anonymous_analytics: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UIConfig {
    pub theme: String, // "light", "dark", "auto"
    pub animations_enabled: bool,
    pub compact_mode: bool,
    pub show_file_previews: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            ai: AIConfig {
                ollama_url: "http://localhost:11434".to_string(),
                model: "llama3.1:8b".to_string(),
                enabled: true,
                max_content_length: 1_000_000, // 1MB
                timeout_seconds: 60,
            },
            performance: PerformanceConfig {
                max_concurrent_jobs: 4,
                max_file_size_mb: 100,
                enable_background_processing: true,
                adaptive_performance: true,
            },
            privacy: PrivacyConfig {
                local_processing_only: true,
                data_retention_days: 365,
                anonymous_analytics: false,
            },
            ui: UIConfig {
                theme: "auto".to_string(),
                animations_enabled: true,
                compact_mode: false,
                show_file_previews: true,
            },
        }
    }
}

// Configuration validation and storage functions
fn validate_config(config: &AppConfig) -> Result<(), String> {
    // Validate AI configuration
    if config.ai.ollama_url.is_empty() {
        return Err("Ollama URL cannot be empty".to_string());
    }
    
    if !config.ai.ollama_url.starts_with("http://") && !config.ai.ollama_url.starts_with("https://") {
        return Err("Ollama URL must start with http:// or https://".to_string());
    }
    
    if config.ai.model.is_empty() {
        return Err("AI model name cannot be empty".to_string());
    }
    
    if config.ai.max_content_length == 0 || config.ai.max_content_length > 10_000_000 {
        return Err("AI max content length must be between 1 and 10MB".to_string());
    }
    
    if config.ai.timeout_seconds == 0 || config.ai.timeout_seconds > 300 {
        return Err("AI timeout must be between 1 and 300 seconds".to_string());
    }
    
    // Validate performance configuration
    if config.performance.max_concurrent_jobs == 0 || config.performance.max_concurrent_jobs > 32 {
        return Err("Max concurrent jobs must be between 1 and 32".to_string());
    }
    
    if config.performance.max_file_size_mb == 0 || config.performance.max_file_size_mb > 1000 {
        return Err("Max file size must be between 1MB and 1GB".to_string());
    }
    
    // Validate privacy configuration
    if config.privacy.data_retention_days == 0 || config.privacy.data_retention_days > 3650 {
        return Err("Data retention must be between 1 day and 10 years".to_string());
    }
    
    // Validate UI configuration
    if !["light", "dark", "auto"].contains(&config.ui.theme.as_str()) {
        return Err("Theme must be 'light', 'dark', or 'auto'".to_string());
    }
    
    // Validate version format
    if config.version.is_empty() {
        return Err("Version cannot be empty".to_string());
    }
    
    Ok(())
}

async fn save_config_to_disk(config: &AppConfig) -> Result<(), anyhow::Error> {
    let data_dir = dirs::config_dir()
        .or_else(|| dirs::data_dir())
        .unwrap_or_else(|| std::env::current_dir().unwrap())
        .join("MetaMind");
    
    tokio::fs::create_dir_all(&data_dir).await?;
    
    let config_path = data_dir.join("config.json");
    let config_json = serde_json::to_string_pretty(config)?;
    
    tokio::fs::write(config_path, config_json).await?;
    Ok(())
}

async fn load_config_from_disk() -> Result<AppConfig, anyhow::Error> {
    let data_dir = dirs::config_dir()
        .or_else(|| dirs::data_dir())
        .unwrap_or_else(|| std::env::current_dir().unwrap())
        .join("MetaMind");
    
    let config_path = data_dir.join("config.json");
    
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }
    
    let config_json = tokio::fs::read_to_string(config_path).await?;
    let config: AppConfig = serde_json::from_str(&config_json)?;
    
    // Validate loaded configuration
    validate_config(&config).map_err(|e| anyhow::anyhow!("Invalid configuration: {}", e))?;
    
    Ok(config)
}

#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // Get CPU usage (average across all cores)
    let cpu_usage = sys.cpus().iter()
        .map(|cpu| cpu.cpu_usage())
        .sum::<f32>() / sys.cpus().len() as f32;
    
    // Get memory info
    let memory_total = sys.total_memory();
    let memory_used = sys.used_memory();
    let memory_usage = (memory_used as f32 / memory_total as f32) * 100.0;
    
    // Get disk usage
    let disk_usage: Vec<serde_json::Value> = sys.disks()
        .iter()
        .map(|disk| {
            let total = disk.total_space();
            let available = disk.available_space();
            let used = total - available;
            let usage_percent = if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 };
            
            serde_json::json!({
                "name": disk.name().to_string_lossy(),
                "mount_point": disk.mount_point().to_string_lossy(),
                "total": total,
                "used": used,
                "available": available,
                "usage_percent": usage_percent
            })
        })
        .collect();
    
    let info = serde_json::json!({
        "cpu_usage": cpu_usage,
        "memory_usage": memory_usage,
        "memory_total": memory_total,
        "memory_used": memory_used,
        "disk_usage": disk_usage,
        "thermal_state": "Normal", // Could be enhanced with thermal sensors
        "performance_profile": "Balanced"
    });
    Ok(info)
}

#[tauri::command]
async fn start_file_monitoring(paths: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Starting file monitoring for paths: {:?}", paths);
    
    for path in paths {
        if let Err(e) = state.file_monitor.add_watch_path(&path).await {
            tracing::error!("Failed to add watch path {}: {}", path, e);
            return Err(format!("Failed to add watch path {}: {}", path, e));
        }
    }
    
    if let Err(e) = state.file_monitor.start_monitoring().await {
        tracing::error!("Failed to start file monitoring: {}", e);
        return Err(format!("Failed to start file monitoring: {}", e));
    }
    
    // Requeue any pending files for processing
    if let Err(e) = state.processing_queue.lock().await.requeue_pending_files().await {
        tracing::error!("Failed to requeue pending files: {}", e);
    }
    
    Ok(())
}

#[tauri::command]
async fn search_files(query: String, _filters: Option<serde_json::Value>, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Searching for: {}", query);
    
    let start_time = std::time::Instant::now();
    
    // Perform search in database
    let search_results = match state.database.search_files(&query, 50, 0).await {
        Ok(files) => files,
        Err(e) => {
            tracing::error!("Search failed: {}", e);
            return Err(format!("Search failed: {}", e));
        }
    };
    
    // Convert to frontend format
    let results: Vec<serde_json::Value> = search_results
        .iter()
        .map(|file| {
            serde_json::json!({
                "file": {
                    "id": file.id,
                    "path": file.path,
                    "name": file.name,
                    "extension": file.extension,
                    "size": file.size,
                    "created_at": file.created_at,
                    "modified_at": file.modified_at,
                    "mime_type": file.mime_type,
                    "processing_status": file.processing_status
                },
                "score": 0.85, // TODO: Implement proper relevance scoring
                "snippet": file.ai_analysis.as_ref()
                    .map(|analysis| {
                        if analysis.len() > 200 {
                            format!("{}...", &analysis[..200])
                        } else {
                            analysis.clone()
                        }
                    })
                    .unwrap_or_else(|| "No analysis available".to_string()),
                "highlights": file.tags.as_ref()
                    .and_then(|tags| serde_json::from_str::<Vec<String>>(tags).ok())
                    .unwrap_or_default()
            })
        })
        .collect();
    
    let execution_time = start_time.elapsed().as_millis();
    
    let response = serde_json::json!({
        "results": results,
        "total": results.len(),
        "query": query,
        "execution_time_ms": execution_time
    });
    
    Ok(response)
}

#[tauri::command]
async fn get_processing_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    match state.processing_queue.lock().await.get_statistics().await {
        Ok(stats) => Ok(stats),
        Err(e) => {
            tracing::error!("Failed to get processing status: {}", e);
            Err(format!("Failed to get processing status: {}", e))
        }
    }
}

#[tauri::command]
async fn get_processing_insights(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    match state.processing_queue.lock().await.get_processing_insights().await {
        Ok(insights) => Ok(insights),
        Err(e) => {
            tracing::error!("Failed to get processing insights: {}", e);
            Err(format!("Failed to get processing insights: {}", e))
        }
    }
}

#[tauri::command]
async fn get_config(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let config = state.config.read().await;
    Ok(serde_json::to_value(&*config).map_err(|e| e.to_string())?)
}

#[tauri::command]
async fn update_config(
    state: State<'_, AppState>,
    config_update: serde_json::Value,
) -> Result<(), String> {
    let mut config = state.config.write().await;
    if let Ok(new_config) = serde_json::from_value::<AppConfig>(config_update) {
        // Validate configuration before applying
        if let Err(e) = validate_config(&new_config) {
            return Err(format!("Invalid configuration: {}", e));
        }
        
        *config = new_config.clone();
        
        // Save configuration to disk
        if let Err(e) = save_config_to_disk(&new_config).await {
            tracing::error!("Failed to save configuration: {}", e);
            return Err(format!("Failed to save configuration: {}", e));
        }
        
        tracing::info!("Configuration updated successfully");
    }
    Ok(())
}

#[tauri::command]
async fn reset_config_to_defaults(state: State<'_, AppState>) -> Result<(), String> {
    let default_config = AppConfig::default();
    
    let mut config = state.config.write().await;
    *config = default_config.clone();
    
    // Save to disk
    if let Err(e) = save_config_to_disk(&default_config).await {
        tracing::error!("Failed to save default configuration: {}", e);
        return Err(format!("Failed to save default configuration: {}", e));
    }
    
    tracing::info!("Configuration reset to defaults");
    Ok(())
}

#[tauri::command]
async fn export_config(state: State<'_, AppState>) -> Result<String, String> {
    let config = state.config.read().await;
    match serde_json::to_string_pretty(&*config) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to export configuration: {}", e))
    }
}

#[tauri::command]
async fn import_config(
    state: State<'_, AppState>,
    config_json: String,
) -> Result<(), String> {
    let new_config: AppConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("Invalid configuration format: {}", e))?;
    
    // Validate configuration
    if let Err(e) = validate_config(&new_config) {
        return Err(format!("Invalid configuration: {}", e));
    }
    
    let mut config = state.config.write().await;
    *config = new_config.clone();
    
    // Save to disk
    if let Err(e) = save_config_to_disk(&new_config).await {
        tracing::error!("Failed to save imported configuration: {}", e);
        return Err(format!("Failed to save imported configuration: {}", e));
    }
    
    tracing::info!("Configuration imported successfully");
    Ok(())
}

#[tauri::command]
async fn get_system_capabilities() -> Result<serde_json::Value, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let total_memory_gb = (sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0).round() as u64;
    
    let capabilities = serde_json::json!({
        "cpu_cores": num_cpus::get(),
        "total_memory_gb": total_memory_gb,
        "architecture": std::env::consts::ARCH,
        "os": std::env::consts::OS,
        "gpu_acceleration": false,
        "recommended_max_threads": num_cpus::get(),
        "supports_background_processing": true
    });
    Ok(capabilities)
}

#[tauri::command]
async fn start_system_monitoring() -> Result<(), String> {
    println!("Starting system monitoring");
    Ok(())
}

#[tauri::command]
async fn stop_system_monitoring() -> Result<(), String> {
    println!("Stopping system monitoring");
    Ok(())
}

#[tauri::command]
async fn get_search_suggestions(partial_query: String) -> Result<Vec<String>, String> {
    let suggestions = vec![
        format!("{} documents", partial_query),
        format!("{} images", partial_query),
        format!("{} code", partial_query),
    ];
    Ok(suggestions)
}

#[tauri::command]
async fn get_available_models(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    // Check if AI processor is available and get models
    match state.ai_processor.get_available_models().await {
        Ok(models) => Ok(serde_json::json!({
            "models": models,
            "ai_available": true
        })),
        Err(e) => {
            tracing::warn!("Failed to get available models: {}", e);
            Ok(serde_json::json!({
                "models": [],
                "ai_available": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn check_ai_availability(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let is_available = state.ai_processor.is_available().await;
    Ok(serde_json::json!({
        "available": is_available,
        "ollama_url": state.config.read().await.ai.ollama_url,
        "model": state.config.read().await.ai.model
    }))
}

#[tauri::command]
async fn semantic_search(query: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Performing semantic search for: {}", query);
    
    if !state.ai_processor.is_available().await {
        tracing::warn!("AI not available, falling back to regular search");
        return search_files(query, None, state).await;
    }

    // Use the new semantic search engine
    let search_request = semantic_search::SearchRequest {
        query: query.clone(),
        search_type: semantic_search::SearchType::Semantic,
        filters: None,
        limit: Some(50),
        threshold: Some(0.7),
    };

    match state.semantic_search.search(search_request).await {
        Ok(search_response) => {
            // Convert our search response to the expected frontend format
            let results: Vec<serde_json::Value> = search_response.results
                .iter()
                .map(|result| {
                    serde_json::json!({
                        "file": {
                            "id": result.file_id,
                            "path": result.file_path,
                            "name": result.file_name,
                            "extension": std::path::Path::new(&result.file_path)
                                .extension()
                                .and_then(|ext| ext.to_str())
                                .unwrap_or(""),
                            "size": 0, // TODO: Get from metadata
                            "created_at": result.last_modified,
                            "modified_at": result.last_modified,
                            "mime_type": "", // TODO: Get from metadata
                            "processing_status": "completed"
                        },
                        "score": result.similarity_score,
                        "snippet": result.snippet.as_ref().unwrap_or(&format!("Match in {}", result.file_name)),
                        "highlights": result.highlights,
                        "search_type": "semantic"
                    })
                })
                .collect();

            let response = serde_json::json!({
                "results": results,
                "total": search_response.total_results,
                "query": search_response.query,
                "execution_time_ms": search_response.search_time_ms,
                "search_type": "semantic",
                "expanded_query": search_response.expanded_query,
                "suggestions": search_response.suggestions
            });

            tracing::info!("Semantic search completed: {} results in {}ms", 
                search_response.total_results, search_response.search_time_ms);
            Ok(response)
        }
        Err(e) => {
            tracing::error!("Semantic search failed: {}", e);
            // Fallback to regular search
            tracing::info!("Falling back to regular search due to semantic search failure");
            search_files(query, None, state).await
        }
    }
}

#[tauri::command]
async fn scan_directory(path: String, state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Starting directory scan: {}", path);
    
    // Check if path is a file or directory
    let path_buf = std::path::Path::new(&path);
    if path_buf.is_file() {
        // Process single file
        return process_single_file(path, state).await;
    }
    
    match state.file_monitor.scan_directory(&path).await {
        Ok(()) => {
            tracing::info!("Directory scan completed successfully");
            Ok(())
        }
        Err(e) => {
            tracing::error!("Directory scan failed: {}", e);
            Err(format!("Directory scan failed: {}", e))
        }
    }
}

#[tauri::command]
async fn process_single_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Processing single file: {}", path);
    
    use crate::file_monitor::FileMonitor;
    
    // Validate file exists and is accessible
    if !std::path::Path::new(&path).exists() {
        let error_msg = format!("File does not exist: {}", path);
        tracing::error!("{}", error_msg);
        return Err(error_msg);
    }
    
    if !std::path::Path::new(&path).is_file() {
        let error_msg = format!("Path is not a file: {}", path);
        tracing::error!("{}", error_msg);
        return Err(error_msg);
    }
    
    // Check file permissions
    match tokio::fs::metadata(&path).await {
        Ok(metadata) => {
            tracing::info!("File metadata - size: {} bytes, readable: true", metadata.len());
        }
        Err(e) => {
            let error_msg = format!("Cannot read file metadata for {}: {}", path, e);
            tracing::error!("{}", error_msg);
            return Err(error_msg);
        }
    }
    
    // Create a temporary file monitor to process the single file
    let temp_monitor = FileMonitor::new(state.database.clone())
        .with_processing_queue(state.processing_queue.clone());
    
    // Process the file using the private method (we'll need to make it public)
    match temp_monitor.process_single_file_public(&path).await {
        Ok(()) => {
            tracing::info!("Single file processing completed successfully: {}", path);
            Ok(())
        }
        Err(e) => {
            tracing::error!("Single file processing failed for {}: {:?}", path, e);
            // Provide more specific error message
            let error_msg = match e.to_string().as_str() {
                s if s.contains("UNIQUE constraint failed") => format!("File already exists in database: {}", path),
                s if s.contains("permission denied") => format!("Permission denied accessing file: {}", path),
                s if s.contains("no such file") => format!("File not found: {}", path),
                _ => format!("Failed to process file {}: {}", path, e)
            };
            Err(error_msg)
        }
    }
}

// Database maintenance commands
#[tauri::command]
async fn reprocess_error_files(state: State<'_, AppState>) -> Result<(), String> {
    tracing::info!("Reprocessing all error files with updated logic");
    
    // Get all files with error status
    let error_files = match state.database.get_files_by_status("error").await {
        Ok(files) => files,
        Err(e) => {
            tracing::error!("Failed to get error files: {}", e);
            return Err(format!("Failed to get error files: {}", e));
        }
    };
    
    let error_files_count = error_files.len();
    tracing::info!("Found {} error files to reprocess", error_files_count);
    
    // Reset their status to pending and add them back to the queue
    for file in error_files {
        // Reset status to pending
        if let Err(e) = state.database.update_file_status(&file.id, "pending", None).await {
            tracing::error!("Failed to reset status for file {}: {}", file.path, e);
            continue;
        }
        
        // Add back to processing queue
        if let Err(e) = state.processing_queue.lock().await.add_job(&file, crate::processing_queue::JobPriority::High).await {
            tracing::error!("Failed to add file to queue {}: {}", file.path, e);
        }
    }
    
    tracing::info!("Reprocessing initiated for {} files", error_files_count);
    Ok(())
}

#[tauri::command]
async fn reset_database(_state: State<'_, AppState>) -> Result<(), String> {
    tracing::warn!("Resetting database due to corruption or user request");
    
    let data_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("MetaMind");
    
    tokio::fs::create_dir_all(&data_dir)
        .await
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    
    let db_path = data_dir.join("metamind.db");
    
    // Remove the corrupted database file and any WAL files
    for file_suffix in ["", "-wal", "-shm"] {
        let file_path = if file_suffix.is_empty() {
            db_path.clone()
        } else {
            db_path.with_extension(format!("db{}", file_suffix))
        };
        
        if file_path.exists() {
            tokio::fs::remove_file(&file_path)
                .await
                .map_err(|e| format!("Failed to remove database file {}: {}", file_path.display(), e))?;
            tracing::info!("Removed database file: {}", file_path.display());
        }
    }
    
    tracing::info!("Database reset completed successfully - application restart required");
    Ok(())
}

// Collections commands
#[tauri::command]
async fn create_collection(
    name: String,
    description: Option<String>,
    state: State<'_, AppState>
) -> Result<serde_json::Value, String> {
    tracing::info!("Creating collection: {}", name);
    
    match state.database.create_collection(&name, description.as_deref()).await {
        Ok(collection) => {
            tracing::info!("Collection created successfully: {}", collection.id);
            Ok(serde_json::to_value(collection).map_err(|e| e.to_string())?)
        }
        Err(e) => {
            tracing::error!("Failed to create collection: {}", e);
            Err(format!("Failed to create collection: {}", e))
        }
    }
}

#[tauri::command]
async fn get_collections(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    match state.database.get_collections().await {
        Ok(collections) => {
            tracing::debug!("Retrieved {} collections", collections.len());
            Ok(serde_json::to_value(collections).map_err(|e| e.to_string())?)
        }
        Err(e) => {
            tracing::error!("Failed to get collections: {}", e);
            Err(format!("Failed to get collections: {}", e))
        }
    }
}

#[tauri::command]
async fn get_collection_by_id(
    id: String,
    state: State<'_, AppState>
) -> Result<serde_json::Value, String> {
    match state.database.get_collection_by_id(&id).await {
        Ok(collection) => {
            Ok(serde_json::to_value(collection).map_err(|e| e.to_string())?)
        }
        Err(e) => {
            tracing::error!("Failed to get collection: {}", e);
            Err(format!("Failed to get collection: {}", e))
        }
    }
}

#[tauri::command]
async fn update_collection(
    id: String,
    name: Option<String>,
    description: Option<String>,
    state: State<'_, AppState>
) -> Result<(), String> {
    tracing::info!("Updating collection: {}", id);
    
    match state.database.update_collection(&id, name.as_deref(), description.as_deref()).await {
        Ok(()) => {
            tracing::info!("Collection updated successfully");
            Ok(())
        }
        Err(e) => {
            tracing::error!("Failed to update collection: {}", e);
            Err(format!("Failed to update collection: {}", e))
        }
    }
}

#[tauri::command]
async fn delete_collection(
    id: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    tracing::info!("Deleting collection: {}", id);
    
    match state.database.delete_collection(&id).await {
        Ok(()) => {
            tracing::info!("Collection deleted successfully");
            Ok(())
        }
        Err(e) => {
            tracing::error!("Failed to delete collection: {}", e);
            Err(format!("Failed to delete collection: {}", e))
        }
    }
}

#[tauri::command]
async fn add_file_to_collection(
    file_id: String,
    collection_id: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    tracing::info!("Adding file {} to collection {}", file_id, collection_id);
    
    match state.database.add_file_to_collection(&file_id, &collection_id).await {
        Ok(()) => {
            tracing::info!("File added to collection successfully");
            Ok(())
        }
        Err(e) => {
            tracing::error!("Failed to add file to collection: {}", e);
            Err(format!("Failed to add file to collection: {}", e))
        }
    }
}

#[tauri::command]
async fn remove_file_from_collection(
    file_id: String,
    collection_id: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    tracing::info!("Removing file {} from collection {}", file_id, collection_id);
    
    match state.database.remove_file_from_collection(&file_id, &collection_id).await {
        Ok(()) => {
            tracing::info!("File removed from collection successfully");
            Ok(())
        }
        Err(e) => {
            tracing::error!("Failed to remove file from collection: {}", e);
            Err(format!("Failed to remove file from collection: {}", e))
        }
    }
}

#[tauri::command]
async fn get_files_in_collection(
    collection_id: String,
    state: State<'_, AppState>
) -> Result<serde_json::Value, String> {
    match state.database.get_files_in_collection(&collection_id).await {
        Ok(files) => {
            tracing::debug!("Retrieved {} files in collection {}", files.len(), collection_id);
            
            // Convert to frontend format
            let results: Vec<serde_json::Value> = files
                .iter()
                .map(|file| {
                    serde_json::json!({
                        "file": {
                            "id": file.id,
                            "path": file.path,
                            "name": file.name,
                            "extension": file.extension,
                            "size": file.size,
                            "created_at": file.created_at,
                            "modified_at": file.modified_at,
                            "mime_type": file.mime_type,
                            "processing_status": file.processing_status
                        },
                        "score": 1.0,
                        "snippet": file.ai_analysis.as_ref()
                            .map(|analysis| {
                                if analysis.len() > 200 {
                                    format!("{}...", &analysis[..200])
                                } else {
                                    analysis.clone()
                                }
                            })
                            .unwrap_or_else(|| "No analysis available".to_string()),
                        "highlights": file.tags.as_ref()
                            .and_then(|tags| serde_json::from_str::<Vec<String>>(tags).ok())
                            .unwrap_or_default()
                    })
                })
                .collect();
            
            Ok(serde_json::json!({
                "results": results,
                "total": results.len()
            }))
        }
        Err(e) => {
            tracing::error!("Failed to get files in collection: {}", e);
            Err(format!("Failed to get files in collection: {}", e))
        }
    }
}

#[tauri::command]
async fn get_location_stats(
    path: String,
    state: State<'_, AppState>
) -> Result<serde_json::Value, String> {
    tracing::debug!("Getting stats for location: {}", path);
    
    match state.database.get_location_stats(&path).await {
        Ok(stats) => {
            tracing::debug!("Retrieved stats for {}: {:?}", path, stats);
            Ok(stats)
        }
        Err(e) => {
            tracing::error!("Failed to get location stats for {}: {}", path, e);
            // Return empty stats instead of failing
            Ok(serde_json::json!({
                "total_files": 0,
                "processed_files": 0,
                "pending_files": 0,
                "error_files": 0
            }))
        }
    }
}

#[tauri::command]
async fn get_insights_data(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Getting insights data - START");
    
    // First test basic database connectivity
    match sqlx::query("SELECT COUNT(*) as count FROM files")
        .fetch_one(&state.database.pool)
        .await 
    {
        Ok(row) => {
            let count: i64 = row.get("count");
            tracing::info!("Database connectivity test passed, found {} files", count);
        }
        Err(e) => {
            tracing::error!("Database connectivity test failed: {}", e);
            return Err(format!("Database connection failed: {}", e));
        }
    }
    
    match state.database.get_insights_data().await {
        Ok(insights) => {
            tracing::info!("Retrieved insights data successfully");
            tracing::debug!("Insights data: {:?}", insights);
            Ok(insights)
        }
        Err(e) => {
            tracing::error!("Failed to get insights data: {}", e);
            Err(format!("Failed to get insights data: {}", e))
        }
    }
}

#[tauri::command]
async fn get_file_errors(
    path: String,
    state: State<'_, AppState>
) -> Result<serde_json::Value, String> {
    tracing::debug!("Getting error details for location: {}", path);
    
    // Check if it's a single file or a directory
    if std::path::Path::new(&path).is_file() {
        // Single file - get specific error
        match state.database.get_file_by_path(&path).await {
            Ok(Some(file)) => {
                Ok(serde_json::json!({
                    "type": "single_file",
                    "path": file.path,
                    "status": file.processing_status,
                    "error_message": file.error_message,
                    "last_attempt": file.modified_at
                }))
            }
            Ok(None) => {
                Err("File not found in database".to_string())
            }
            Err(e) => {
                tracing::error!("Failed to get file error details: {}", e);
                Err(format!("Failed to get file error details: {}", e))
            }
        }
    } else {
        // Directory - get all error files in this location
        match state.database.get_error_files_in_location(&path).await {
            Ok(error_files) => {
                if error_files.is_empty() {
                    Ok(serde_json::json!({
                        "type": "directory",
                        "path": path,
                        "message": "No error files found in this location"
                    }))
                } else {
                    let errors: Vec<serde_json::Value> = error_files.iter().map(|file| {
                        serde_json::json!({
                            "path": file.path,
                            "name": file.name,
                            "error_message": file.error_message,
                            "last_attempt": file.modified_at
                        })
                    }).collect();
                    
                    Ok(serde_json::json!({
                        "type": "directory", 
                        "path": path,
                        "error_count": errors.len(),
                        "errors": errors
                    }))
                }
            }
            Err(e) => {
                tracing::error!("Failed to get error files for location {}: {}", path, e);
                Err(format!("Failed to get error files: {}", e))
            }
        }
    }
}

#[tauri::command]
async fn check_for_updates(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let mut updater = state.updater.lock().await;
    match updater.check_for_updates().await {
        Ok(update_info) => Ok(serde_json::to_value(update_info).unwrap()),
        Err(e) => Err(format!("Failed to check for updates: {}", e))
    }
}

#[tauri::command]
async fn install_update(state: State<'_, AppState>) -> Result<(), String> {
    let _updater = state.updater.lock().await;
    // Placeholder - install_update method is private
    Ok(())
}

#[tauri::command]
async fn get_error_reports(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let error_reporter = state.error_reporter.lock().await;
    let reports = error_reporter.get_pending_reports().await;
    Ok(serde_json::to_value(reports).unwrap())
}

#[tauri::command]
async fn submit_error_report(
    state: State<'_, AppState>, 
    error: String, 
    user_description: Option<String>
) -> Result<(), String> {
    let error_reporter = state.error_reporter.lock().await;
    match error_reporter.report_error(
        crate::error_reporting::ErrorType::Exception,
        error,
        None,
        None,
        user_description,
    ).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to submit error report: {}", e))
    }
}

// Vector search commands
#[tauri::command]
async fn generate_file_vectors(
    file_id: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    tracing::info!("Generating vectors for file: {}", file_id);
    
    // For now, we'll need to get the file path from the file_id
    // This is a simplified implementation - in production you'd have proper ID-based lookup
    let file_path = file_id.clone(); // Assuming file_id is actually a path for now

    // Extract content for vector generation
    let content = crate::content_extractor::ContentExtractor::extract_content(&file_path).await
        .map_err(|e| format!("Content extraction failed: {}", e))?;

    // Generate vectors
    let (content_vector, metadata_vector, summary_vector) = state.semantic_search
        .generate_content_vectors(&content).await
        .map_err(|e| format!("Vector generation failed: {}", e))?;

    // Store vectors
    state.vector_storage.store_file_vectors(
        &file_id,
        content_vector,
        metadata_vector,
        summary_vector,
        "nomic-embed-text", // TODO: Make configurable
    ).await.map_err(|e| format!("Vector storage failed: {}", e))?;

    tracing::info!("Vectors generated and stored for file: {}", file_id);
    Ok(())
}

#[tauri::command]
async fn process_folder_vectors(
    folder_path: String,
    state: State<'_, AppState>
) -> Result<serde_json::Value, String> {
    tracing::info!("Processing folder vectors for: {}", folder_path);
    
    let analysis = state.folder_vectorizer.process_folder(&folder_path).await
        .map_err(|e| format!("Folder processing failed: {}", e))?;

    tracing::info!("Folder vectors processed for: {}", folder_path);
    Ok(serde_json::to_value(analysis).map_err(|e| e.to_string())?)
}

#[tauri::command]
async fn get_vector_statistics(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let stats = state.vector_storage.get_vector_statistics().await
        .map_err(|e| format!("Failed to get vector statistics: {}", e))?;
    
    Ok(serde_json::to_value(stats).map_err(|e| e.to_string())?)
}

#[tauri::command]
async fn hybrid_search(query: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Performing hybrid search for: {}", query);
    
    let search_request = semantic_search::SearchRequest {
        query: query.clone(),
        search_type: semantic_search::SearchType::Hybrid,
        filters: None,
        limit: Some(50),
        threshold: Some(0.6),
    };

    match state.semantic_search.search(search_request).await {
        Ok(search_response) => {
            let results: Vec<serde_json::Value> = search_response.results
                .iter()
                .map(|result| {
                    serde_json::json!({
                        "file": {
                            "id": result.file_id,
                            "path": result.file_path,
                            "name": result.file_name,
                            "extension": std::path::Path::new(&result.file_path)
                                .extension()
                                .and_then(|ext| ext.to_str())
                                .unwrap_or(""),
                            "size": 0, // TODO: Get from metadata
                            "created_at": result.last_modified,
                            "modified_at": result.last_modified,
                            "mime_type": "", // TODO: Get from metadata
                            "processing_status": "completed"
                        },
                        "score": result.similarity_score,
                        "snippet": result.snippet.as_ref().unwrap_or(&format!("Match in {}", result.file_name)),
                        "highlights": result.highlights,
                        "search_type": "hybrid"
                    })
                })
                .collect();

            let response = serde_json::json!({
                "results": results,
                "total": search_response.total_results,
                "query": search_response.query,
                "execution_time_ms": search_response.search_time_ms,
                "search_type": "hybrid",
                "expanded_query": search_response.expanded_query,
                "suggestions": search_response.suggestions
            });

            Ok(response)
        }
        Err(e) => {
            tracing::error!("Hybrid search failed: {}", e);
            // Fallback to regular search
            search_files(query, None, state).await
        }
    }
}

#[tauri::command]
async fn get_cache_statistics(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let stats = state.vector_cache.get_statistics().await;
    Ok(serde_json::to_value(stats).map_err(|e| e.to_string())?)
}

#[tauri::command]
async fn clear_cache(state: State<'_, AppState>) -> Result<(), String> {
    state.vector_cache.clear_all().await;
    tracing::info!("All caches cleared by user request");
    Ok(())
}

#[tauri::command]
async fn run_vector_benchmarks(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Starting comprehensive vector benchmarks");
    
    let config = BenchmarkConfig::default();
    let results = state.benchmarks.run_full_benchmark_suite(config).await
        .map_err(|e| format!("Benchmark failed: {}", e))?;
    
    let report = state.benchmarks.generate_report(&results);
    tracing::info!("Benchmark completed with {} tests", results.len());
    
    Ok(serde_json::json!({
        "results": results,
        "report": report,
        "summary": {
            "total_tests": results.len(),
            "avg_throughput": results.iter().map(|r| r.throughput_ops_per_sec).sum::<f64>() / results.len() as f64,
            "total_memory_mb": results.iter().map(|r| r.memory_usage_mb).sum::<f64>()
        }
    }))
}

#[tauri::command]
async fn run_quick_benchmark(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    tracing::info!("Starting quick vector benchmark");
    
    let mut config = BenchmarkConfig::default();
    config.dataset_sizes = vec![100, 1000]; // Smaller datasets for quick test
    config.benchmark_iterations = 10;
    config.warmup_iterations = 2;
    
    let results = state.benchmarks.run_full_benchmark_suite(config).await
        .map_err(|e| format!("Quick benchmark failed: {}", e))?;
    
    tracing::info!("Quick benchmark completed");
    
    Ok(serde_json::json!({
        "results": results,
        "summary": {
            "total_tests": results.len(),
            "avg_execution_time_ms": results.iter().map(|r| r.execution_time_ms).sum::<u128>() / results.len() as u128,
            "avg_throughput": results.iter().map(|r| r.throughput_ops_per_sec).sum::<f64>() / results.len() as f64
        }
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Initialize database
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap())
        .join("MetaMind");
    
    // Ensure data directory exists
    if let Err(e) = tokio::fs::create_dir_all(&data_dir).await {
        tracing::error!("Failed to create data directory: {}", e);
    }
    
    let database = Database::new(data_dir.join("metamind.db"))
        .await
        .expect("Failed to initialize database");

    // Load configuration from disk
    let config = match load_config_from_disk().await {
        Ok(config) => {
            tracing::info!("Loaded configuration from disk");
            config
        }
        Err(e) => {
            tracing::warn!("Failed to load configuration from disk: {}, using defaults", e);
            AppConfig::default()
        }
    };

    // Initialize AI processor with loaded configuration
    let ai_processor = AIProcessor::new(
        config.ai.ollama_url.clone(),
        config.ai.model.clone(),
    );

    // Initialize vector search components
    let vector_storage = VectorStorageManager::new(database.pool.clone());
    
    // Initialize vector storage schema
    if let Err(e) = vector_storage.initialize().await {
        tracing::error!("Failed to initialize vector storage: {}", e);
    } else {
        tracing::info!("Vector storage initialized successfully");
    }

    let semantic_search_engine = SemanticSearchEngine::new(
        vector_storage.clone(),
        ai_processor.clone(),
    );

    let folder_vectorizer = FolderVectorizer::new(
        vector_storage.clone(),
        ai_processor.clone(),
    );

    // Initialize vector cache
    let cache_config = VectorCacheConfig::default();
    let vector_cache = Arc::new(VectorCache::new(cache_config));
    
    // Start cache manager
    let cache_manager = CacheManager::new(Arc::clone(&vector_cache), 300); // 5 minute cleanup interval
    cache_manager.start().await;

    // Initialize benchmarks
    let benchmarks = VectorBenchmarks::new(
        vector_storage.clone(),
        semantic_search_engine.clone(),
        Arc::clone(&vector_cache),
    );

    // Initialize processing queue with AI processor
    let processing_queue = ProcessingQueue::new(
        database.clone(),
        ai_processor.clone(),
        4, // max concurrent jobs
    );
    let processing_queue = Arc::new(tokio::sync::Mutex::new(processing_queue));

    // Initialize file monitor with processing queue
    let file_monitor = FileMonitor::new(database.clone())
        .with_processing_queue(processing_queue.clone());

    // Start the processing queue
    {
        let queue_guard = processing_queue.lock().await;
        if let Err(e) = queue_guard.start_processing().await {
            tracing::error!("Failed to start processing queue: {}", e);
        }
    }

    // Initialize updater
    let updater_config = crate::updater::UpdaterConfig::default();
    let updater = Updater::new(updater_config);
    let updater = Arc::new(Mutex::new(updater));

    // Initialize error reporter
    let error_config = crate::error_reporting::ErrorReportingConfig::default();
    let error_reporter = ErrorReporter::new(error_config);
    let error_reporter = Arc::new(Mutex::new(error_reporter));

    let app_state = AppState {
        config: Arc::new(RwLock::new(config)),
        database,
        file_monitor,
        ai_processor,
        processing_queue,
        updater,
        error_reporter,
        vector_storage,
        semantic_search: semantic_search_engine,
        folder_vectorizer,
        vector_cache,
        benchmarks,
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            start_file_monitoring,
            search_files,
            get_processing_status,
            get_processing_insights,
            get_config,
            update_config,
            reset_config_to_defaults,
            export_config,
            import_config,
            get_system_capabilities,
            start_system_monitoring,
            stop_system_monitoring,
            get_search_suggestions,
            get_available_models,
            check_ai_availability,
            semantic_search,
            scan_directory,
            process_single_file,
            reset_database,
            create_collection,
            get_collections,
            get_collection_by_id,
            update_collection,
            delete_collection,
            add_file_to_collection,
            remove_file_from_collection,
            get_files_in_collection,
            get_location_stats,
            get_file_errors,
            get_insights_data,
            reprocess_error_files,
            check_for_updates,
            install_update,
            get_error_reports,
            submit_error_report,
            generate_file_vectors,
            process_folder_vectors,
            get_vector_statistics,
            hybrid_search,
            get_cache_statistics,
            clear_cache,
            run_vector_benchmarks,
            run_quick_benchmark
        ])
        .setup(|_app| {
            tracing::info!("MetaMind is starting up!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}