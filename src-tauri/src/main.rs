// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod file_processor;
mod ai_integration;
mod search_engine;
mod system_monitor;
mod database;
mod config;
mod error;

use file_processor::FileProcessor;
use ai_integration::AIManager;
use search_engine::SearchEngine;
use system_monitor::SystemMonitor;
use database::Database;
use config::AppConfig;
use error::AppResult;

use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct AppState {
    pub config: Arc<RwLock<AppConfig>>,
    pub database: Arc<Database>,
    pub file_processor: Arc<FileProcessor>,
    pub ai_manager: Arc<AIManager>,
    pub search_engine: Arc<SearchEngine>,
    pub system_monitor: Arc<SystemMonitor>,
}

#[tauri::command]
async fn get_system_info(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let system_info = state.system_monitor.get_system_info().await;
    Ok(system_info)
}

#[tauri::command]
async fn start_file_monitoring(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> AppResult<()> {
    state.file_processor.start_monitoring(paths).await?;
    Ok(())
}

#[tauri::command]
async fn search_files(
    state: State<'_, AppState>,
    query: String,
    filters: Option<serde_json::Value>,
) -> AppResult<serde_json::Value> {
    let results = state.search_engine.search(&query, filters).await?;
    Ok(results)
}

#[tauri::command]
async fn get_processing_status(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let status = state.file_processor.get_status().await;
    Ok(status)
}

#[tauri::command]
async fn update_config(
    state: State<'_, AppState>,
    config_update: serde_json::Value,
) -> AppResult<()> {
    let mut config = state.config.write().await;
    config.update_from_json(config_update)?;
    config.save().await?;
    Ok(())
}

#[tauri::command]
async fn get_config(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let config = state.config.read().await;
    Ok(serde_json::to_value(&*config)?)
}

#[tauri::command]
async fn get_system_capabilities(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    let capabilities = state.system_monitor.get_system_capabilities().await;
    Ok(capabilities)
}

#[tauri::command]
async fn start_system_monitoring(state: State<'_, AppState>) -> AppResult<()> {
    state.system_monitor.start_monitoring().await?;
    Ok(())
}

#[tauri::command]
async fn stop_system_monitoring(state: State<'_, AppState>) -> AppResult<()> {
    state.system_monitor.stop_monitoring().await?;
    Ok(())
}

#[tauri::command]
async fn get_search_suggestions(
    state: State<'_, AppState>,
    partial_query: String,
) -> AppResult<Vec<String>> {
    let suggestions = state.search_engine.get_suggestions(&partial_query).await?;
    Ok(suggestions)
}

#[tokio::main]
async fn main() -> AppResult<()> {
    tracing_subscriber::fmt::init();

    // Initialize configuration
    let config = Arc::new(RwLock::new(AppConfig::load().await?));
    
    // Initialize database
    let database = Arc::new(Database::new().await?);
    
    // Initialize system monitor
    let system_monitor = Arc::new(SystemMonitor::new());
    
    // Initialize AI manager
    let ai_manager = Arc::new(AIManager::new(config.clone()).await?);
    
    // Initialize search engine
    let search_engine = Arc::new(SearchEngine::new(database.clone()).await?);
    
    // Initialize file processor
    let file_processor = Arc::new(
        FileProcessor::new(
            database.clone(),
            ai_manager.clone(),
            search_engine.clone(),
            system_monitor.clone(),
        ).await?
    );

    let app_state = AppState {
        config,
        database,
        file_processor,
        ai_manager,
        search_engine,
        system_monitor,
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            start_file_monitoring,
            search_files,
            get_processing_status,
            update_config,
            get_config,
            get_system_capabilities,
            start_system_monitoring,
            stop_system_monitoring,
            get_search_suggestions
        ])
        .setup(|app| {
            let app_handle = app.handle();
            
            // Setup system tray (commented out for now)
            // #[cfg(desktop)]
            // {
            //     use tauri::{SystemTray, SystemTrayMenu, CustomMenuItem, SystemTrayEvent};
            //     
            //     let quit = CustomMenuItem::new("quit".to_string(), "Quit");
            //     let hide = CustomMenuItem::new("hide".to_string(), "Hide");
            //     let tray_menu = SystemTrayMenu::new()
            //         .add_item(hide)
            //         .add_native_item(tauri::SystemTrayMenuItem::Separator)
            //         .add_item(quit);
            //
            //     let system_tray = SystemTray::new().with_menu(tray_menu);
            //     app.handle().plugin(tauri_plugin_system_tray::init(system_tray, |app, event| {
            //         match event {
            //             SystemTrayEvent::MenuItemClick { id, .. } => {
            //                 match id.as_str() {
            //                     "quit" => {
            //                         std::process::exit(0);
            //                     }
            //                     "hide" => {
            //                         let window = app.get_window("main").unwrap();
            //                         window.hide().unwrap();
            //                     }
            //                     _ => {}
            //                 }
            //             }
            //             _ => {}
            //         }
            //     }))?;
            // }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}