use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, 
    SystemTrayMenu, SystemTrayMenuItem, SystemTraySubmenu,
};
use anyhow::Result;
use serde_json::json;

/// System tray manager for MetaMind
pub struct SystemTrayManager {
    app_handle: Option<AppHandle>,
}

impl SystemTrayManager {
    pub fn new() -> Self {
        Self {
            app_handle: None,
        }
    }

    /// Initialize the system tray with menu items
    pub fn create_system_tray() -> SystemTray {
        // Quick action items
        let quick_search = CustomMenuItem::new("quick_search".to_string(), "Quick Search");
        let scan_folder = CustomMenuItem::new("scan_folder".to_string(), "Scan Folder");
        let recent_files = CustomMenuItem::new("recent_files".to_string(), "Recent Files");

        // AI processing submenu
        let process_pending = CustomMenuItem::new("process_pending".to_string(), "Process Pending Files");
        let pause_processing = CustomMenuItem::new("pause_processing".to_string(), "Pause Processing");
        let ai_status = CustomMenuItem::new("ai_status".to_string(), "AI Status");
        let ai_submenu = SystemTraySubmenu::new(
            "AI Processing",
            SystemTrayMenu::new()
                .add_item(ai_status)
                .add_native_item(SystemTrayMenuItem::Separator)
                .add_item(process_pending)
                .add_item(pause_processing)
        );

        // Settings submenu
        let preferences = CustomMenuItem::new("preferences".to_string(), "Preferences");
        let performance = CustomMenuItem::new("performance".to_string(), "Performance Settings");
        let privacy = CustomMenuItem::new("privacy".to_string(), "Privacy & Security");
        let settings_submenu = SystemTraySubmenu::new(
            "Settings",
            SystemTrayMenu::new()
                .add_item(preferences)
                .add_item(performance)
                .add_item(privacy)
        );

        // Help and info
        let about = CustomMenuItem::new("about".to_string(), "About MetaMind");
        let check_updates = CustomMenuItem::new("check_updates".to_string(), "Check for Updates");
        let documentation = CustomMenuItem::new("documentation".to_string(), "Documentation");

        // Main actions
        let show_app = CustomMenuItem::new("show_app".to_string(), "Show MetaMind");
        let hide_app = CustomMenuItem::new("hide_app".to_string(), "Hide MetaMind");
        let quit = CustomMenuItem::new("quit".to_string(), "Quit");

        let tray_menu = SystemTrayMenu::new()
            .add_item(show_app)
            .add_item(hide_app)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(quick_search)
            .add_item(scan_folder)
            .add_item(recent_files)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_submenu(ai_submenu)
            .add_submenu(settings_submenu)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(about)
            .add_item(check_updates)
            .add_item(documentation)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(quit);

        SystemTray::new().with_menu(tray_menu)
    }

    /// Set the app handle for system tray interactions
    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Handle system tray events
    pub async fn handle_system_tray_event(
        app_handle: &AppHandle,
        event: SystemTrayEvent,
    ) -> Result<()> {
        match event {
            SystemTrayEvent::LeftClick {
                position: _,
                size: _,
                ..
            } => {
                Self::show_main_window(app_handle).await?;
            }
            SystemTrayEvent::RightClick {
                position: _,
                size: _,
                ..
            } => {
                // Right-click shows the context menu (handled by Tauri)
            }
            SystemTrayEvent::DoubleClick {
                position: _,
                size: _,
                ..
            } => {
                Self::show_main_window(app_handle).await?;
            }
            SystemTrayEvent::MenuItemClick { id, .. } => {
                Self::handle_menu_item_click(app_handle, &id).await?;
            }
            _ => {}
        }
        Ok(())
    }

    /// Handle menu item clicks
    async fn handle_menu_item_click(app_handle: &AppHandle, menu_id: &str) -> Result<()> {
        match menu_id {
            "show_app" => {
                Self::show_main_window(app_handle).await?;
            }
            "hide_app" => {
                Self::hide_main_window(app_handle).await?;
            }
            "quick_search" => {
                Self::open_quick_search(app_handle).await?;
            }
            "scan_folder" => {
                Self::open_folder_scanner(app_handle).await?;
            }
            "recent_files" => {
                Self::show_recent_files(app_handle).await?;
            }
            "process_pending" => {
                Self::start_processing_pending(app_handle).await?;
            }
            "pause_processing" => {
                Self::pause_ai_processing(app_handle).await?;
            }
            "ai_status" => {
                Self::show_ai_status(app_handle).await?;
            }
            "preferences" => {
                Self::open_preferences(app_handle).await?;
            }
            "performance" => {
                Self::open_performance_settings(app_handle).await?;
            }
            "privacy" => {
                Self::open_privacy_settings(app_handle).await?;
            }
            "about" => {
                Self::show_about_dialog(app_handle).await?;
            }
            "check_updates" => {
                Self::check_for_updates(app_handle).await?;
            }
            "documentation" => {
                Self::open_documentation(app_handle).await?;
            }
            "quit" => {
                Self::quit_application(app_handle).await?;
            }
            _ => {
                tracing::warn!("Unknown menu item clicked: {}", menu_id);
            }
        }
        Ok(())
    }

    /// Show the main application window
    async fn show_main_window(app_handle: &AppHandle) -> Result<()> {
        if let Some(window) = app_handle.get_window("main") {
            window.show()?;
            window.set_focus()?;
            window.unminimize()?;
        }
        tracing::info!("Main window shown via system tray");
        Ok(())
    }

    /// Hide the main application window
    async fn hide_main_window(app_handle: &AppHandle) -> Result<()> {
        if let Some(window) = app_handle.get_window("main") {
            window.hide()?;
        }
        tracing::info!("Main window hidden via system tray");
        Ok(())
    }

    /// Open quick search dialog
    async fn open_quick_search(app_handle: &AppHandle) -> Result<()> {
        // Emit event to frontend to open quick search
        app_handle.emit_all("system-tray-quick-search", json!({}))?;
        Self::show_main_window(app_handle).await?;
        tracing::info!("Quick search opened via system tray");
        Ok(())
    }

    /// Open folder scanner
    async fn open_folder_scanner(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-scan-folder", json!({}))?;
        Self::show_main_window(app_handle).await?;
        tracing::info!("Folder scanner opened via system tray");
        Ok(())
    }

    /// Show recent files
    async fn show_recent_files(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-recent-files", json!({}))?;
        Self::show_main_window(app_handle).await?;
        tracing::info!("Recent files shown via system tray");
        Ok(())
    }

    /// Start processing pending files
    async fn start_processing_pending(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-process-pending", json!({}))?;
        
        // Update tray tooltip to show processing status
        let tray_handle = app_handle.tray_handle();
        tray_handle.set_tooltip("MetaMind - Processing files...")?;
        
        tracing::info!("Started processing pending files via system tray");
        Ok(())
    }

    /// Pause AI processing
    async fn pause_ai_processing(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-pause-processing", json!({}))?;
        
        // Update tray tooltip
        let tray_handle = app_handle.tray_handle();
        tray_handle.set_tooltip("MetaMind - Processing paused")?;
        
        tracing::info!("Paused AI processing via system tray");
        Ok(())
    }

    /// Show AI status
    async fn show_ai_status(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-ai-status", json!({}))?;
        Self::show_main_window(app_handle).await?;
        tracing::info!("AI status shown via system tray");
        Ok(())
    }

    /// Open preferences
    async fn open_preferences(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-preferences", json!({
            "section": "general"
        }))?;
        Self::show_main_window(app_handle).await?;
        tracing::info!("Preferences opened via system tray");
        Ok(())
    }

    /// Open performance settings
    async fn open_performance_settings(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-preferences", json!({
            "section": "performance"
        }))?;
        Self::show_main_window(app_handle).await?;
        tracing::info!("Performance settings opened via system tray");
        Ok(())
    }

    /// Open privacy settings
    async fn open_privacy_settings(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-preferences", json!({
            "section": "privacy"
        }))?;
        Self::show_main_window(app_handle).await?;
        tracing::info!("Privacy settings opened via system tray");
        Ok(())
    }

    /// Show about dialog
    async fn show_about_dialog(app_handle: &AppHandle) -> Result<()> {
        use tauri::api::dialog;
        
        let version = env!("CARGO_PKG_VERSION");
        let message = format!(
            "MetaMind v{}\n\nAI-Powered File Intelligence System\n\nBuilt with Tauri + Rust + React",
            version
        );
        
        dialog::message(
            app_handle.get_window("main").as_ref(),
            "About MetaMind",
            &message,
        );
        
        tracing::info!("About dialog shown via system tray");
        Ok(())
    }

    /// Check for updates
    async fn check_for_updates(app_handle: &AppHandle) -> Result<()> {
        app_handle.emit_all("system-tray-check-updates", json!({}))?;
        tracing::info!("Update check initiated via system tray");
        Ok(())
    }

    /// Open documentation
    async fn open_documentation(app_handle: &AppHandle) -> Result<()> {
        use tauri::api::shell;
        
        let docs_url = "https://docs.metamind.ai"; // Replace with actual docs URL
        shell::open(&app_handle.shell_scope(), docs_url, None)?;
        
        tracing::info!("Documentation opened via system tray");
        Ok(())
    }

    /// Quit the application
    async fn quit_application(app_handle: &AppHandle) -> Result<()> {
        app_handle.exit(0);
        Ok(())
    }

    /// Update system tray tooltip based on application state
    pub async fn update_tray_tooltip(
        app_handle: &AppHandle,
        status: &TrayStatus,
    ) -> Result<()> {
        let tray_handle = app_handle.tray_handle();
        
        let tooltip = match status {
            TrayStatus::Idle => "MetaMind - Ready",
            TrayStatus::Processing { files_remaining } => {
                format!("MetaMind - Processing ({} files remaining)", files_remaining)
            }
            TrayStatus::Searching => "MetaMind - Searching...",
            TrayStatus::Error { message } => {
                format!("MetaMind - Error: {}", message)
            }
            TrayStatus::Paused => "MetaMind - Paused",
        };
        
        tray_handle.set_tooltip(&tooltip)?;
        Ok(())
    }

    /// Update system tray icon based on application state
    pub async fn update_tray_icon(
        app_handle: &AppHandle,
        icon_state: &TrayIconState,
    ) -> Result<()> {
        let tray_handle = app_handle.tray_handle();
        
        let icon_path = match icon_state {
            TrayIconState::Normal => include_bytes!("../icons/icon.ico"),
            TrayIconState::Processing => include_bytes!("../icons/icon-processing.ico"),
            TrayIconState::Error => include_bytes!("../icons/icon-error.ico"),
            TrayIconState::Paused => include_bytes!("../icons/icon-paused.ico"),
        };
        
        // Note: You'll need to create these icon variants
        tray_handle.set_icon(tauri::Icon::Raw(icon_path.to_vec()))?;
        Ok(())
    }

    /// Show system tray notification
    pub async fn show_notification(
        app_handle: &AppHandle,
        title: &str,
        body: &str,
        notification_type: NotificationType,
    ) -> Result<()> {
        use tauri::api::notification::Notification;
        
        let icon = match notification_type {
            NotificationType::Info => tauri::api::notification::NotificationIcon::Info,
            NotificationType::Success => tauri::api::notification::NotificationIcon::Info,
            NotificationType::Warning => tauri::api::notification::NotificationIcon::Warning,
            NotificationType::Error => tauri::api::notification::NotificationIcon::Error,
        };
        
        Notification::new(&app_handle.config().tauri.bundle.identifier)
            .title(title)
            .body(body)
            .icon(icon)
            .show()?;
        
        tracing::info!("System tray notification shown: {}", title);
        Ok(())
    }
}

/// System tray status for tooltip updates
#[derive(Debug, Clone)]
pub enum TrayStatus {
    Idle,
    Processing { files_remaining: usize },
    Searching,
    Error { message: String },
    Paused,
}

/// System tray icon states
#[derive(Debug, Clone)]
pub enum TrayIconState {
    Normal,
    Processing,
    Error,
    Paused,
}

/// Notification types for system tray notifications
#[derive(Debug, Clone)]
pub enum NotificationType {
    Info,
    Success,
    Warning,
    Error,
}

/// System tray menu builder for dynamic menu updates
pub struct TrayMenuBuilder {
    processing_paused: bool,
    ai_available: bool,
    files_processing: usize,
}

impl TrayMenuBuilder {
    pub fn new() -> Self {
        Self {
            processing_paused: false,
            ai_available: true,
            files_processing: 0,
        }
    }

    pub fn with_processing_state(mut self, paused: bool, files_count: usize) -> Self {
        self.processing_paused = paused;
        self.files_processing = files_count;
        self
    }

    pub fn with_ai_availability(mut self, available: bool) -> Self {
        self.ai_available = available;
        self
    }

    /// Build dynamic menu based on current state
    pub fn build_menu(&self) -> SystemTrayMenu {
        let mut menu = SystemTrayMenu::new();
        
        // Show/Hide app
        menu = menu
            .add_item(CustomMenuItem::new("show_app".to_string(), "Show MetaMind"))
            .add_item(CustomMenuItem::new("hide_app".to_string(), "Hide MetaMind"))
            .add_native_item(SystemTrayMenuItem::Separator);
        
        // Quick actions
        menu = menu
            .add_item(CustomMenuItem::new("quick_search".to_string(), "Quick Search"))
            .add_item(CustomMenuItem::new("scan_folder".to_string(), "Scan Folder"))
            .add_item(CustomMenuItem::new("recent_files".to_string(), "Recent Files"))
            .add_native_item(SystemTrayMenuItem::Separator);
        
        // AI Processing submenu (dynamic based on state)
        let ai_status_text = if self.ai_available {
            if self.files_processing > 0 {
                format!("AI Status (Processing {} files)", self.files_processing)
            } else {
                "AI Status (Ready)".to_string()
            }
        } else {
            "AI Status (Unavailable)".to_string()
        };
        
        let process_text = if self.processing_paused {
            "Resume Processing"
        } else {
            "Pause Processing"
        };
        
        let ai_submenu = SystemTraySubmenu::new(
            "AI Processing",
            SystemTrayMenu::new()
                .add_item(CustomMenuItem::new("ai_status".to_string(), ai_status_text))
                .add_native_item(SystemTrayMenuItem::Separator)
                .add_item(CustomMenuItem::new("process_pending".to_string(), "Process Pending Files"))
                .add_item(CustomMenuItem::new("pause_processing".to_string(), process_text))
        );
        
        menu = menu.add_submenu(ai_submenu).add_native_item(SystemTrayMenuItem::Separator);
        
        // Settings and actions
        let settings_submenu = SystemTraySubmenu::new(
            "Settings",
            SystemTrayMenu::new()
                .add_item(CustomMenuItem::new("preferences".to_string(), "Preferences"))
                .add_item(CustomMenuItem::new("performance".to_string(), "Performance Settings"))
                .add_item(CustomMenuItem::new("privacy".to_string(), "Privacy & Security"))
        );
        
        menu = menu
            .add_submenu(settings_submenu)
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(CustomMenuItem::new("about".to_string(), "About MetaMind"))
            .add_item(CustomMenuItem::new("check_updates".to_string(), "Check for Updates"))
            .add_item(CustomMenuItem::new("documentation".to_string(), "Documentation"))
            .add_native_item(SystemTrayMenuItem::Separator)
            .add_item(CustomMenuItem::new("quit".to_string(), "Quit"));
        
        menu
    }

    /// Update the system tray menu
    pub async fn update_tray_menu(&self, app_handle: &AppHandle) -> Result<()> {
        let new_menu = self.build_menu();
        let tray_handle = app_handle.tray_handle();
        tray_handle.set_menu(new_menu)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_menu_builder() {
        let builder = TrayMenuBuilder::new()
            .with_processing_state(false, 5)
            .with_ai_availability(true);
        
        let menu = builder.build_menu();
        // Test menu structure - this would require more complex testing setup
        assert!(true); // Placeholder test
    }

    #[test]
    fn test_tray_status() {
        let status = TrayStatus::Processing { files_remaining: 10 };
        match status {
            TrayStatus::Processing { files_remaining } => {
                assert_eq!(files_remaining, 10);
            }
            _ => panic!("Expected processing status"),
        }
    }
}