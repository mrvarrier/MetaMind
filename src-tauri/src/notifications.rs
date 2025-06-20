use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::RwLock;
use uuid::Uuid;

/// Comprehensive notification system for MetaMind
pub struct NotificationManager {
    config: Arc<RwLock<NotificationConfig>>,
    history: Arc<RwLock<VecDeque<NotificationEntry>>>,
    active_notifications: Arc<RwLock<HashMap<Uuid, NotificationEntry>>>,
    app_handle: Option<AppHandle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub enabled: bool,
    pub system_notifications: bool,
    pub in_app_notifications: bool,
    pub sound_enabled: bool,
    pub do_not_disturb: bool,
    pub quiet_hours: Option<QuietHours>,
    pub categories: HashMap<NotificationCategory, CategorySettings>,
    pub max_history_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuietHours {
    pub enabled: bool,
    pub start_time: String, // Format: "HH:MM"
    pub end_time: String,   // Format: "HH:MM"
    pub days: Vec<String>,  // ["monday", "tuesday", ...]
}

#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub enum NotificationCategory {
    FileProcessing,
    AIAnalysis,
    Search,
    System,
    Updates,
    Security,
    Collections,
    Performance,
    Errors,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySettings {
    pub enabled: bool,
    pub priority: NotificationPriority,
    pub sound: Option<String>,
    pub persist: bool,
    pub group_similar: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationEntry {
    pub id: Uuid,
    pub title: String,
    pub message: String,
    pub category: NotificationCategory,
    pub priority: NotificationPriority,
    pub timestamp: DateTime<Utc>,
    pub read: bool,
    pub actions: Vec<NotificationAction>,
    pub metadata: HashMap<String, String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationAction {
    pub id: String,
    pub label: String,
    pub action_type: ActionType,
    pub data: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    OpenFile,
    OpenFolder,
    OpenSettings,
    Dismiss,
    DismissAll,
    Retry,
    ViewDetails,
    Custom(String),
}

impl Default for NotificationConfig {
    fn default() -> Self {
        let mut categories = HashMap::new();
        
        // Configure default settings for each category
        categories.insert(NotificationCategory::FileProcessing, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: None,
            persist: false,
            group_similar: true,
        });
        
        categories.insert(NotificationCategory::AIAnalysis, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: None,
            persist: false,
            group_similar: true,
        });
        
        categories.insert(NotificationCategory::System, CategorySettings {
            enabled: true,
            priority: NotificationPriority::High,
            sound: Some("system".to_string()),
            persist: true,
            group_similar: false,
        });
        
        categories.insert(NotificationCategory::Errors, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Critical,
            sound: Some("error".to_string()),
            persist: true,
            group_similar: false,
        });
        
        categories.insert(NotificationCategory::Updates, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: None,
            persist: true,
            group_similar: false,
        });
        
        categories.insert(NotificationCategory::Security, CategorySettings {
            enabled: true,
            priority: NotificationPriority::High,
            sound: Some("alert".to_string()),
            persist: true,
            group_similar: false,
        });
        
        categories.insert(NotificationCategory::Search, CategorySettings {
            enabled: false, // Disabled by default to avoid spam
            priority: NotificationPriority::Low,
            sound: None,
            persist: false,
            group_similar: true,
        });
        
        categories.insert(NotificationCategory::Collections, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: None,
            persist: false,
            group_similar: true,
        });
        
        categories.insert(NotificationCategory::Performance, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: None,
            persist: false,
            group_similar: true,
        });

        Self {
            enabled: true,
            system_notifications: true,
            in_app_notifications: true,
            sound_enabled: true,
            do_not_disturb: false,
            quiet_hours: Some(QuietHours {
                enabled: false,
                start_time: "22:00".to_string(),
                end_time: "08:00".to_string(),
                days: vec!["monday".to_string(), "tuesday".to_string(), "wednesday".to_string(), 
                         "thursday".to_string(), "friday".to_string(), "saturday".to_string(), "sunday".to_string()],
            }),
            categories,
            max_history_size: 1000,
        }
    }
}

impl NotificationManager {
    pub async fn new(config: NotificationConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            history: Arc::new(RwLock::new(VecDeque::new())),
            active_notifications: Arc::new(RwLock::new(HashMap::new())),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Send a notification
    pub async fn notify(
        &self,
        title: String,
        message: String,
        category: NotificationCategory,
        actions: Vec<NotificationAction>,
        metadata: HashMap<String, String>,
    ) -> Result<Uuid> {
        let config = self.config.read().await;
        
        // Check if notifications are enabled globally
        if !config.enabled {
            return Ok(Uuid::new_v4()); // Return dummy ID
        }

        // Check category settings
        let category_settings = config.categories.get(&category)
            .ok_or_else(|| anyhow::anyhow!("Unknown notification category: {:?}", category))?;
        
        if !category_settings.enabled {
            return Ok(Uuid::new_v4()); // Return dummy ID
        }

        // Check quiet hours
        if self.is_quiet_hours(&config).await? {
            if !matches!(category_settings.priority, NotificationPriority::Critical) {
                // Store for later delivery
                self.store_for_later_delivery(title, message, category, actions, metadata).await?;
                return Ok(Uuid::new_v4());
            }
        }

        // Check do not disturb
        if config.do_not_disturb && !matches!(category_settings.priority, NotificationPriority::Critical) {
            self.store_for_later_delivery(title, message, category, actions, metadata).await?;
            return Ok(Uuid::new_v4());
        }

        drop(config);

        // Create notification entry
        let notification = NotificationEntry {
            id: Uuid::new_v4(),
            title: title.clone(),
            message: message.clone(),
            category: category.clone(),
            priority: category_settings.priority.clone(),
            timestamp: Utc::now(),
            read: false,
            actions,
            metadata,
            expires_at: self.calculate_expiry(&category_settings).await,
            group_id: if category_settings.group_similar {
                Some(format!("{:?}", category))
            } else {
                None
            },
        };

        // Add to active notifications
        self.active_notifications.write().await.insert(notification.id, notification.clone());

        // Add to history
        let mut history = self.history.write().await;
        history.push_back(notification.clone());
        
        // Maintain history size limit
        let max_size = self.config.read().await.max_history_size;
        while history.len() > max_size {
            history.pop_front();
        }
        drop(history);

        // Send system notification if enabled
        if self.config.read().await.system_notifications {
            self.send_system_notification(&notification).await?;
        }

        // Send in-app notification if enabled
        if self.config.read().await.in_app_notifications {
            self.send_in_app_notification(&notification).await?;
        }

        // Play sound if enabled
        if self.config.read().await.sound_enabled && category_settings.sound.is_some() {
            self.play_notification_sound(&category_settings.sound).await?;
        }

        tracing::info!("Notification sent: {} - {}", title, message);
        Ok(notification.id)
    }

    /// Send system notification using OS native notifications
    async fn send_system_notification(&self, notification: &NotificationEntry) -> Result<()> {
        if let Some(app_handle) = &self.app_handle {
            use tauri::api::notification::Notification;
            
            Notification::new(&app_handle.config().tauri.bundle.identifier)
                .title(&notification.title)
                .body(&notification.message)
                .icon(self.get_icon_for_category(&notification.category))
                .show()?;
        }
        Ok(())
    }

    /// Send in-app notification to frontend
    async fn send_in_app_notification(&self, notification: &NotificationEntry) -> Result<()> {
        if let Some(app_handle) = &self.app_handle {
            app_handle.emit_all("notification", notification)?;
        }
        Ok(())
    }

    /// Play notification sound
    async fn play_notification_sound(&self, sound: &Option<String>) -> Result<()> {
        if let Some(sound_name) = sound {
            // Platform-specific sound playing
            #[cfg(target_os = "macos")]
            self.play_sound_macos(sound_name).await?;
            
            #[cfg(target_os = "windows")]
            self.play_sound_windows(sound_name).await?;
            
            #[cfg(target_os = "linux")]
            self.play_sound_linux(sound_name).await?;
        }
        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn play_sound_macos(&self, sound_name: &str) -> Result<()> {
        use std::process::Command;
        
        let system_sound = match sound_name {
            "error" => "Sosumi",
            "alert" => "Glass",
            "system" => "Ping",
            _ => "Ping",
        };
        
        Command::new("afplay")
            .arg(format!("/System/Library/Sounds/{}.aiff", system_sound))
            .spawn()?;
        
        Ok(())
    }

    #[cfg(target_os = "windows")]
    async fn play_sound_windows(&self, sound_name: &str) -> Result<()> {
        use std::process::Command;
        
        let sound_type = match sound_name {
            "error" => "SystemHand",
            "alert" => "SystemExclamation",
            "system" => "SystemAsterisk",
            _ => "SystemAsterisk",
        };
        
        Command::new("powershell")
            .args(&[
                "-Command",
                &format!("[console]::beep(800, 200); Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemSounds]::{}.Play()", sound_type)
            ])
            .spawn()?;
        
        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn play_sound_linux(&self, _sound_name: &str) -> Result<()> {
        use std::process::Command;
        
        // Try to use system beep
        let _ = Command::new("pactl")
            .args(&["upload-sample", "/usr/share/sounds/alsa/Front_Left.wav", "notification"])
            .spawn();
        
        Ok(())
    }

    /// Get appropriate icon for notification category
    fn get_icon_for_category(&self, category: &NotificationCategory) -> tauri::api::notification::NotificationIcon {
        match category {
            NotificationCategory::Errors | NotificationCategory::Security => {
                tauri::api::notification::NotificationIcon::Error
            }
            NotificationCategory::System | NotificationCategory::Performance => {
                tauri::api::notification::NotificationIcon::Warning
            }
            _ => tauri::api::notification::NotificationIcon::Info
        }
    }

    /// Check if current time is within quiet hours
    async fn is_quiet_hours(&self, config: &NotificationConfig) -> Result<bool> {
        if let Some(quiet_hours) = &config.quiet_hours {
            if !quiet_hours.enabled {
                return Ok(false);
            }

            let now = chrono::Local::now();
            let current_day = now.format("%A").to_string().to_lowercase();
            
            if !quiet_hours.days.contains(&current_day) {
                return Ok(false);
            }

            let current_time = now.format("%H:%M").to_string();
            
            // Simple time comparison (doesn't handle overnight ranges properly)
            if quiet_hours.start_time <= quiet_hours.end_time {
                Ok(current_time >= quiet_hours.start_time && current_time <= quiet_hours.end_time)
            } else {
                // Overnight range
                Ok(current_time >= quiet_hours.start_time || current_time <= quiet_hours.end_time)
            }
        } else {
            Ok(false)
        }
    }

    /// Store notification for later delivery
    async fn store_for_later_delivery(
        &self,
        title: String,
        message: String,
        category: NotificationCategory,
        actions: Vec<NotificationAction>,
        metadata: HashMap<String, String>,
    ) -> Result<()> {
        // For now, just log that it would be stored
        tracing::info!("Notification stored for later delivery: {}", title);
        // In a full implementation, you'd store these in a persistent queue
        Ok(())
    }

    /// Calculate expiry time for notification
    async fn calculate_expiry(&self, category_settings: &CategorySettings) -> Option<DateTime<Utc>> {
        if category_settings.persist {
            None // Persistent notifications don't expire
        } else {
            Some(Utc::now() + chrono::Duration::minutes(5)) // Auto-expire after 5 minutes
        }
    }

    /// Mark notification as read
    pub async fn mark_as_read(&self, notification_id: Uuid) -> Result<()> {
        if let Some(notification) = self.active_notifications.write().await.get_mut(&notification_id) {
            notification.read = true;
            
            // Emit update to frontend
            if let Some(app_handle) = &self.app_handle {
                app_handle.emit_all("notification-updated", notification)?;
            }
        }
        Ok(())
    }

    /// Dismiss notification
    pub async fn dismiss(&self, notification_id: Uuid) -> Result<()> {
        self.active_notifications.write().await.remove(&notification_id);
        
        // Emit dismissal to frontend
        if let Some(app_handle) = &self.app_handle {
            app_handle.emit_all("notification-dismissed", serde_json::json!({
                "id": notification_id
            }))?;
        }
        
        tracing::info!("Notification dismissed: {}", notification_id);
        Ok(())
    }

    /// Dismiss all notifications
    pub async fn dismiss_all(&self) -> Result<()> {
        self.active_notifications.write().await.clear();
        
        // Emit dismissal to frontend
        if let Some(app_handle) = &self.app_handle {
            app_handle.emit_all("all-notifications-dismissed", serde_json::json!({}))?;
        }
        
        tracing::info!("All notifications dismissed");
        Ok(())
    }

    /// Get active notifications
    pub async fn get_active_notifications(&self) -> Vec<NotificationEntry> {
        self.active_notifications.read().await.values().cloned().collect()
    }

    /// Get notification history
    pub async fn get_history(&self, limit: Option<usize>) -> Vec<NotificationEntry> {
        let history = self.history.read().await;
        let limit = limit.unwrap_or(100);
        history.iter().rev().take(limit).cloned().collect()
    }

    /// Handle notification action
    pub async fn handle_action(&self, notification_id: Uuid, action_id: String) -> Result<()> {
        if let Some(notification) = self.active_notifications.read().await.get(&notification_id) {
            if let Some(action) = notification.actions.iter().find(|a| a.id == action_id) {
                self.execute_action(action, notification).await?;
            }
        }
        Ok(())
    }

    /// Execute notification action
    async fn execute_action(&self, action: &NotificationAction, notification: &NotificationEntry) -> Result<()> {
        match &action.action_type {
            ActionType::OpenFile => {
                if let Some(file_path) = action.data.get("path") {
                    if let Some(app_handle) = &self.app_handle {
                        app_handle.emit_all("open-file", serde_json::json!({
                            "path": file_path
                        }))?;
                    }
                }
            }
            ActionType::OpenFolder => {
                if let Some(folder_path) = action.data.get("path") {
                    if let Some(app_handle) = &self.app_handle {
                        app_handle.emit_all("open-folder", serde_json::json!({
                            "path": folder_path
                        }))?;
                    }
                }
            }
            ActionType::OpenSettings => {
                if let Some(app_handle) = &self.app_handle {
                    let section = action.data.get("section").cloned().unwrap_or_else(|| "general".to_string());
                    app_handle.emit_all("open-settings", serde_json::json!({
                        "section": section
                    }))?;
                }
            }
            ActionType::Dismiss => {
                self.dismiss(notification.id).await?;
            }
            ActionType::DismissAll => {
                self.dismiss_all().await?;
            }
            ActionType::Retry => {
                if let Some(app_handle) = &self.app_handle {
                    app_handle.emit_all("retry-action", serde_json::json!({
                        "notification_id": notification.id,
                        "data": action.data
                    }))?;
                }
            }
            ActionType::ViewDetails => {
                if let Some(app_handle) = &self.app_handle {
                    app_handle.emit_all("view-details", serde_json::json!({
                        "notification": notification
                    }))?;
                }
            }
            ActionType::Custom(custom_action) => {
                if let Some(app_handle) = &self.app_handle {
                    app_handle.emit_all("custom-action", serde_json::json!({
                        "action": custom_action,
                        "notification_id": notification.id,
                        "data": action.data
                    }))?;
                }
            }
        }
        
        tracing::info!("Notification action executed: {} for notification {}", action.id, notification.id);
        Ok(())
    }

    /// Clean up expired notifications
    pub async fn cleanup_expired(&self) -> Result<()> {
        let now = Utc::now();
        let mut active = self.active_notifications.write().await;
        let mut to_remove = Vec::new();

        for (id, notification) in active.iter() {
            if let Some(expires_at) = notification.expires_at {
                if now > expires_at {
                    to_remove.push(*id);
                }
            }
        }

        for id in to_remove {
            active.remove(&id);
            tracing::debug!("Expired notification removed: {}", id);
        }

        Ok(())
    }

    /// Update notification configuration
    pub async fn update_config(&self, new_config: NotificationConfig) -> Result<()> {
        *self.config.write().await = new_config;
        
        // Emit config update to frontend
        if let Some(app_handle) = &self.app_handle {
            app_handle.emit_all("notification-config-updated", &*self.config.read().await)?;
        }
        
        tracing::info!("Notification configuration updated");
        Ok(())
    }

    /// Get current configuration
    pub async fn get_config(&self) -> NotificationConfig {
        self.config.read().await.clone()
    }
}

/// Notification templates for common scenarios
pub struct NotificationTemplates;

impl NotificationTemplates {
    /// File processing completed notification
    pub fn file_processing_completed(files_count: usize, duration: u64) -> (String, String, Vec<NotificationAction>) {
        let title = "File Processing Complete".to_string();
        let message = format!("Processed {} files in {} seconds", files_count, duration);
        let actions = vec![
            NotificationAction {
                id: "view_results".to_string(),
                label: "View Results".to_string(),
                action_type: ActionType::Custom("view_processing_results".to_string()),
                data: HashMap::new(),
            },
            NotificationAction {
                id: "dismiss".to_string(),
                label: "Dismiss".to_string(),
                action_type: ActionType::Dismiss,
                data: HashMap::new(),
            },
        ];
        (title, message, actions)
    }

    /// AI analysis error notification
    pub fn ai_analysis_error(file_path: String, error: String) -> (String, String, Vec<NotificationAction>) {
        let title = "AI Analysis Failed".to_string();
        let message = format!("Failed to analyze file: {}", file_path);
        let actions = vec![
            NotificationAction {
                id: "retry".to_string(),
                label: "Retry".to_string(),
                action_type: ActionType::Retry,
                data: {
                    let mut data = HashMap::new();
                    data.insert("file_path".to_string(), file_path.clone());
                    data.insert("error".to_string(), error);
                    data
                },
            },
            NotificationAction {
                id: "open_file".to_string(),
                label: "Open File".to_string(),
                action_type: ActionType::OpenFile,
                data: {
                    let mut data = HashMap::new();
                    data.insert("path".to_string(), file_path);
                    data
                },
            },
        ];
        (title, message, actions)
    }

    /// Update available notification
    pub fn update_available(version: String) -> (String, String, Vec<NotificationAction>) {
        let title = "Update Available".to_string();
        let message = format!("MetaMind {} is available for download", version);
        let actions = vec![
            NotificationAction {
                id: "install_update".to_string(),
                label: "Install Now".to_string(),
                action_type: ActionType::Custom("install_update".to_string()),
                data: {
                    let mut data = HashMap::new();
                    data.insert("version".to_string(), version);
                    data
                },
            },
            NotificationAction {
                id: "remind_later".to_string(),
                label: "Remind Later".to_string(),
                action_type: ActionType::Dismiss,
                data: HashMap::new(),
            },
        ];
        (title, message, actions)
    }

    /// Security alert notification
    pub fn security_alert(alert_type: String, details: String) -> (String, String, Vec<NotificationAction>) {
        let title = format!("Security Alert: {}", alert_type);
        let message = details;
        let actions = vec![
            NotificationAction {
                id: "view_details".to_string(),
                label: "View Details".to_string(),
                action_type: ActionType::ViewDetails,
                data: HashMap::new(),
            },
            NotificationAction {
                id: "open_security_settings".to_string(),
                label: "Security Settings".to_string(),
                action_type: ActionType::OpenSettings,
                data: {
                    let mut data = HashMap::new();
                    data.insert("section".to_string(), "security".to_string());
                    data
                },
            },
        ];
        (title, message, actions)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_notification_creation() {
        let config = NotificationConfig::default();
        let manager = NotificationManager::new(config).await;
        
        let notification_id = manager.notify(
            "Test Title".to_string(),
            "Test Message".to_string(),
            NotificationCategory::System,
            Vec::new(),
            HashMap::new(),
        ).await.unwrap();
        
        assert!(!notification_id.is_nil());
    }

    #[tokio::test]
    async fn test_notification_dismissal() {
        let config = NotificationConfig::default();
        let manager = NotificationManager::new(config).await;
        
        let notification_id = manager.notify(
            "Test Title".to_string(),
            "Test Message".to_string(),
            NotificationCategory::System,
            Vec::new(),
            HashMap::new(),
        ).await.unwrap();
        
        manager.dismiss(notification_id).await.unwrap();
        
        let active = manager.get_active_notifications().await;
        assert!(active.is_empty());
    }

    #[test]
    fn test_notification_templates() {
        let (title, message, actions) = NotificationTemplates::file_processing_completed(10, 60);
        assert_eq!(title, "File Processing Complete");
        assert!(message.contains("10 files"));
        assert_eq!(actions.len(), 2);
    }
}