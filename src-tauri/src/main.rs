// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::State;
use tokio::sync::{RwLock, Mutex};
use serde_json;
use sysinfo::{System, SystemExt, CpuExt, DiskExt};

mod database;
mod file_monitor;
mod content_extractor;
// mod ai_processor; // Temporarily disabled for initial compilation
mod processing_queue;

use database::Database;
use file_monitor::FileMonitor;
// use ai_processor::AIProcessor; // Temporarily disabled
use processing_queue::ProcessingQueue;

#[derive(Debug)]
pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub database: Database,
    pub file_monitor: FileMonitor,
    pub processing_queue: Arc<Mutex<ProcessingQueue>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub ai: AIConfig,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AIConfig {
    pub ollama_url: String,
    pub model: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            ai: AIConfig {
                ollama_url: "http://localhost:11434".to_string(),
                model: "llama3.1:8b".to_string(),
            },
        }
    }
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
        *config = new_config;
    }
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
async fn get_available_models() -> Result<serde_json::Value, String> {
    // Check if Ollama is running and get available models
    let client = reqwest::Client::new();
    
    match client.get("http://localhost:11434/api/tags").send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => Ok(data),
                    Err(_) => {
                        // Return empty models list if parsing fails
                        Ok(serde_json::json!({"models": []}))
                    }
                }
            } else {
                // Ollama not running or error
                Ok(serde_json::json!({"models": []}))
            }
        }
        Err(_) => {
            // Network error or Ollama not available
            Ok(serde_json::json!({"models": []}))
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

    // Initialize processing queue (without AI processor for initial version)
    let processing_queue = ProcessingQueue::new(
        database.clone(),
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

    let app_state = AppState {
        config: Arc::new(RwLock::new(AppConfig::default())),
        database,
        file_monitor,
        processing_queue,
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            start_file_monitoring,
            search_files,
            get_processing_status,
            get_config,
            update_config,
            get_system_capabilities,
            start_system_monitoring,
            stop_system_monitoring,
            get_search_suggestions,
            get_available_models,
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
            reprocess_error_files
        ])
        .setup(|_app| {
            tracing::info!("MetaMind is starting up!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}