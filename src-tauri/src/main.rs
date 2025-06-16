// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::RwLock;
use serde_json;

#[derive(Debug)]
pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
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
    let info = serde_json::json!({
        "cpu_usage": 25.0,
        "memory_usage": 40.0,
        "memory_total": 16000000000u64,
        "memory_used": 6400000000u64,
        "disk_usage": [],
        "thermal_state": "Normal",
        "performance_profile": "Balanced"
    });
    Ok(info)
}

#[tauri::command]
async fn start_file_monitoring(paths: Vec<String>) -> Result<(), String> {
    println!("Starting file monitoring for paths: {:?}", paths);
    Ok(())
}

#[tauri::command]
async fn search_files(query: String, filters: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    println!("Searching for: {}", query);
    let results = serde_json::json!({
        "results": [],
        "total": 0,
        "query": query,
        "execution_time_ms": 10
    });
    Ok(results)
}

#[tauri::command]
async fn get_processing_status() -> Result<serde_json::Value, String> {
    let status = serde_json::json!({
        "total_processed": 0,
        "queue_size": 0,
        "current_processing": 0,
        "errors": 0,
        "average_processing_time_ms": 0.0,
        "last_processed_at": serde_json::Value::Null
    });
    Ok(status)
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
    let capabilities = serde_json::json!({
        "cpu_cores": num_cpus::get(),
        "total_memory_gb": 16,
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

fn main() {
    tracing_subscriber::fmt::init();

    let app_state = AppState {
        config: Arc::new(RwLock::new(AppConfig::default())),
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
            get_search_suggestions
        ])
        .setup(|app| {
            println!("MetaMind is starting up!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}