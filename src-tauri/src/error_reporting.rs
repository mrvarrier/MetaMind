use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, warn, info, debug};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorReport {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub error_type: ErrorType,
    pub message: String,
    pub stack_trace: Option<String>,
    pub context: HashMap<String, String>,
    pub system_info: SystemInfo,
    pub user_description: Option<String>,
    pub severity: ErrorSeverity,
    pub tags: Vec<String>,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorType {
    Crash,
    Exception,
    DatabaseError,
    NetworkError,
    FileSystemError,
    AIProcessingError,
    SearchError,
    UIError,
    ConfigurationError,
    SecurityError,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub architecture: String,
    pub app_version: String,
    pub memory_usage: u64,
    pub cpu_usage: f32,
    pub disk_space: u64,
    pub uptime: u64,
}

#[derive(Debug, Clone)]
pub struct ErrorReportingConfig {
    pub enabled: bool,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub max_reports_per_session: usize,
    pub auto_submit: bool,
    pub include_system_info: bool,
    pub include_logs: bool,
    pub local_storage_path: PathBuf,
    pub retention_days: u32,
}

impl Default for ErrorReportingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            endpoint: None, // Set to your error reporting service
            api_key: None,
            max_reports_per_session: 50,
            auto_submit: false, // Require user consent
            include_system_info: true,
            include_logs: false, // Privacy-conscious default
            local_storage_path: dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("metamind")
                .join("error_reports"),
            retention_days: 30,
        }
    }
}

pub struct ErrorReporter {
    config: Arc<RwLock<ErrorReportingConfig>>,
    session_id: String,
    reports: Arc<RwLock<Vec<ErrorReport>>>,
    client: reqwest::Client,
    system_monitor: Arc<RwLock<SystemInfo>>,
}

impl ErrorReporter {
    pub fn new(config: ErrorReportingConfig) -> Self {
        let session_id = Uuid::new_v4().to_string();
        
        Self {
            config: Arc::new(RwLock::new(config)),
            session_id,
            reports: Arc::new(RwLock::new(Vec::new())),
            client: reqwest::Client::new(),
            system_monitor: Arc::new(RwLock::new(Self::collect_system_info())),
        }
    }

    pub async fn initialize(&self) -> Result<()> {
        // Create storage directory
        let config = self.config.read().await;
        tokio::fs::create_dir_all(&config.local_storage_path).await?;
        
        // Load pending reports
        self.load_pending_reports().await?;
        
        // Start background tasks
        self.start_system_monitoring().await;
        self.start_cleanup_task().await;
        
        info!("Error reporting system initialized with session ID: {}", self.session_id);
        Ok(())
    }

    pub async fn report_error(
        &self,
        error_type: ErrorType,
        message: String,
        stack_trace: Option<String>,
        context: Option<HashMap<String, String>>,
        user_description: Option<String>,
    ) -> Result<String> {
        let config = self.config.read().await;
        
        if !config.enabled {
            return Err(anyhow!("Error reporting is disabled"));
        }

        // Check rate limiting
        let reports = self.reports.read().await;
        if reports.len() >= config.max_reports_per_session {
            warn!("Maximum error reports per session reached, dropping report");
            return Err(anyhow!("Rate limit exceeded"));
        }
        drop(reports);

        let report = ErrorReport {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            error_type: error_type.clone(),
            message: message.clone(),
            stack_trace,
            context: context.unwrap_or_default(),
            system_info: if config.include_system_info {
                self.system_monitor.read().await.clone()
            } else {
                SystemInfo {
                    os: "redacted".to_string(),
                    os_version: "redacted".to_string(),
                    architecture: "redacted".to_string(),
                    app_version: env!("CARGO_PKG_VERSION").to_string(),
                    memory_usage: 0,
                    cpu_usage: 0.0,
                    disk_space: 0,
                    uptime: 0,
                }
            },
            user_description,
            severity: Self::determine_severity(&error_type, &message),
            tags: Self::generate_tags(&error_type, &message),
            session_id: self.session_id.clone(),
        };

        let report_id = report.id.clone();

        // Store report locally
        self.store_report_locally(&report).await?;

        // Add to in-memory collection
        let mut reports = self.reports.write().await;
        reports.push(report.clone());
        drop(reports);

        error!(
            "Error reported [{}]: {} - {}",
            report_id,
            error_type_to_string(&error_type),
            message
        );

        // Auto-submit if enabled
        if config.auto_submit {
            if let Err(e) = self.submit_report(&report).await {
                warn!("Failed to auto-submit error report: {}", e);
            }
        }

        Ok(report_id)
    }

    pub async fn submit_report(&self, report: &ErrorReport) -> Result<()> {
        let config = self.config.read().await;
        
        let endpoint = config.endpoint.as_ref()
            .ok_or_else(|| anyhow!("No error reporting endpoint configured"))?;

        let payload = serde_json::to_value(report)?;

        let mut request = self.client.post(endpoint)
            .json(&payload)
            .header("Content-Type", "application/json")
            .header("User-Agent", format!("MetaMind/{}", env!("CARGO_PKG_VERSION")));

        if let Some(api_key) = &config.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }

        let response = request.send().await?;

        if response.status().is_success() {
            info!("Successfully submitted error report: {}", report.id);
            
            // Mark as submitted
            self.mark_report_as_submitted(&report.id).await?;
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to submit error report: {} - {}", status, body));
        }

        Ok(())
    }

    pub async fn submit_all_pending(&self) -> Result<usize> {
        let reports = self.reports.read().await;
        let pending_reports: Vec<ErrorReport> = reports.clone();
        drop(reports);

        let mut submitted = 0;

        for report in pending_reports {
            if let Err(e) = self.submit_report(&report).await {
                warn!("Failed to submit report {}: {}", report.id, e);
            } else {
                submitted += 1;
            }
        }

        info!("Submitted {} error reports", submitted);
        Ok(submitted)
    }

    pub async fn get_pending_reports(&self) -> Vec<ErrorReport> {
        self.reports.read().await.clone()
    }

    pub async fn delete_report(&self, report_id: &str) -> Result<()> {
        let mut reports = self.reports.write().await;
        reports.retain(|r| r.id != report_id);
        drop(reports);

        // Delete from local storage
        let config = self.config.read().await;
        let file_path = config.local_storage_path.join(format!("{}.json", report_id));
        
        if file_path.exists() {
            tokio::fs::remove_file(file_path).await?;
        }

        Ok(())
    }

    pub async fn clear_all_reports(&self) -> Result<()> {
        let mut reports = self.reports.write().await;
        let report_ids: Vec<String> = reports.iter().map(|r| r.id.clone()).collect();
        reports.clear();
        drop(reports);

        // Delete from local storage
        let config = self.config.read().await;
        for report_id in report_ids {
            let file_path = config.local_storage_path.join(format!("{}.json", report_id));
            if file_path.exists() {
                tokio::fs::remove_file(file_path).await.ok();
            }
        }

        Ok(())
    }

    async fn store_report_locally(&self, report: &ErrorReport) -> Result<()> {
        let config = self.config.read().await;
        let file_path = config.local_storage_path.join(format!("{}.json", report.id));
        
        let json = serde_json::to_string_pretty(report)?;
        tokio::fs::write(file_path, json).await?;
        
        Ok(())
    }

    async fn load_pending_reports(&self) -> Result<()> {
        let config = self.config.read().await;
        
        if !config.local_storage_path.exists() {
            return Ok(());
        }

        let mut dir = tokio::fs::read_dir(&config.local_storage_path).await?;
        let mut reports = self.reports.write().await;

        while let Some(entry) = dir.next_entry().await? {
            let path = entry.path();
            
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(content) = tokio::fs::read_to_string(&path).await {
                    if let Ok(report) = serde_json::from_str::<ErrorReport>(&content) {
                        reports.push(report);
                    } else {
                        warn!("Failed to parse error report: {}", path.display());
                    }
                }
            }
        }

        info!("Loaded {} pending error reports", reports.len());
        Ok(())
    }

    async fn mark_report_as_submitted(&self, report_id: &str) -> Result<()> {
        // Remove from local storage since it's been submitted
        let config = self.config.read().await;
        let file_path = config.local_storage_path.join(format!("{}.json", report_id));
        
        if file_path.exists() {
            tokio::fs::remove_file(file_path).await?;
        }

        // Remove from in-memory collection
        let mut reports = self.reports.write().await;
        reports.retain(|r| r.id != report_id);

        Ok(())
    }

    async fn start_system_monitoring(&self) {
        let system_monitor = self.system_monitor.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                
                let new_info = Self::collect_system_info();
                let mut system_info = system_monitor.write().await;
                *system_info = new_info;
            }
        });
    }

    async fn start_cleanup_task(&self) {
        let config = self.config.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(24 * 3600)); // Daily
            
            loop {
                interval.tick().await;
                
                let config_guard = config.read().await;
                let retention_days = config_guard.retention_days;
                let storage_path = config_guard.local_storage_path.clone();
                drop(config_guard);
                
                if let Err(e) = Self::cleanup_old_reports(&storage_path, retention_days).await {
                    warn!("Failed to cleanup old error reports: {}", e);
                }
            }
        });
    }

    async fn cleanup_old_reports(storage_path: &PathBuf, retention_days: u32) -> Result<()> {
        if !storage_path.exists() {
            return Ok(());
        }

        let cutoff_time = Utc::now() - chrono::Duration::days(retention_days as i64);
        let mut dir = tokio::fs::read_dir(storage_path).await?;
        let mut cleaned = 0;

        while let Some(entry) = dir.next_entry().await? {
            let path = entry.path();
            
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(metadata) = entry.metadata().await {
                    if let Ok(created) = metadata.created() {
                        let created_time: DateTime<Utc> = created.into();
                        
                        if created_time < cutoff_time {
                            if tokio::fs::remove_file(&path).await.is_ok() {
                                cleaned += 1;
                            }
                        }
                    }
                }
            }
        }

        if cleaned > 0 {
            info!("Cleaned up {} old error reports", cleaned);
        }

        Ok(())
    }

    fn collect_system_info() -> SystemInfo {
        use sysinfo::{System, SystemExt, CpuExt};
        
        let mut system = System::new_all();
        system.refresh_all();

        SystemInfo {
            os: std::env::consts::OS.to_string(),
            os_version: system.os_version().unwrap_or_default(),
            architecture: std::env::consts::ARCH.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            memory_usage: system.used_memory(),
            cpu_usage: system.global_cpu_info().cpu_usage(),
            disk_space: system.disks().iter().map(|d| d.available_space()).sum(),
            uptime: system.uptime(),
        }
    }

    fn determine_severity(error_type: &ErrorType, message: &str) -> ErrorSeverity {
        match error_type {
            ErrorType::Crash | ErrorType::SecurityError => ErrorSeverity::Critical,
            ErrorType::DatabaseError | ErrorType::FileSystemError => ErrorSeverity::High,
            ErrorType::NetworkError | ErrorType::AIProcessingError => ErrorSeverity::Medium,
            _ => {
                // Check message for severity indicators
                let message_lower = message.to_lowercase();
                if message_lower.contains("critical") || message_lower.contains("fatal") {
                    ErrorSeverity::Critical
                } else if message_lower.contains("error") || message_lower.contains("failed") {
                    ErrorSeverity::High
                } else {
                    ErrorSeverity::Medium
                }
            }
        }
    }

    fn generate_tags(error_type: &ErrorType, message: &str) -> Vec<String> {
        let mut tags = vec![error_type_to_string(error_type)];
        
        let message_lower = message.to_lowercase();
        
        // Add contextual tags
        if message_lower.contains("timeout") {
            tags.push("timeout".to_string());
        }
        if message_lower.contains("permission") {
            tags.push("permissions".to_string());
        }
        if message_lower.contains("network") {
            tags.push("network".to_string());
        }
        if message_lower.contains("database") {
            tags.push("database".to_string());
        }
        if message_lower.contains("memory") {
            tags.push("memory".to_string());
        }
        
        tags
    }

    pub async fn update_config(&self, new_config: ErrorReportingConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
    }

    pub async fn get_statistics(&self) -> HashMap<String, serde_json::Value> {
        let reports = self.reports.read().await;
        let total_reports = reports.len();
        
        let mut by_type = HashMap::new();
        let mut by_severity = HashMap::new();
        
        for report in reports.iter() {
            let type_key = error_type_to_string(&report.error_type);
            *by_type.entry(type_key).or_insert(0u32) += 1;
            
            let severity_key = format!("{:?}", report.severity);
            *by_severity.entry(severity_key).or_insert(0u32) += 1;
        }
        
        let mut stats = HashMap::new();
        stats.insert("total_reports".to_string(), serde_json::json!(total_reports));
        stats.insert("by_type".to_string(), serde_json::json!(by_type));
        stats.insert("by_severity".to_string(), serde_json::json!(by_severity));
        stats.insert("session_id".to_string(), serde_json::json!(self.session_id));
        
        stats
    }
}

fn error_type_to_string(error_type: &ErrorType) -> String {
    match error_type {
        ErrorType::Crash => "crash".to_string(),
        ErrorType::Exception => "exception".to_string(),
        ErrorType::DatabaseError => "database_error".to_string(),
        ErrorType::NetworkError => "network_error".to_string(),
        ErrorType::FileSystemError => "filesystem_error".to_string(),
        ErrorType::AIProcessingError => "ai_processing_error".to_string(),
        ErrorType::SearchError => "search_error".to_string(),
        ErrorType::UIError => "ui_error".to_string(),
        ErrorType::ConfigurationError => "configuration_error".to_string(),
        ErrorType::SecurityError => "security_error".to_string(),
    }
}

// Global panic handler setup
pub fn setup_panic_handler(error_reporter: Arc<ErrorReporter>) {
    std::panic::set_hook(Box::new(move |panic_info| {
        let message = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic".to_string()
        };

        let location = panic_info.location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "Unknown location".to_string());

        let stack_trace = Some(format!("Panic at {}: {}", location, message));

        let context = {
            let mut ctx = HashMap::new();
            ctx.insert("panic_location".to_string(), location);
            ctx.insert("thread".to_string(), std::thread::current().name().unwrap_or("unnamed").to_string());
            ctx
        };

        // Report the crash
        let reporter = error_reporter.clone();
        tokio::spawn(async move {
            if let Err(e) = reporter.report_error(
                ErrorType::Crash,
                message,
                stack_trace,
                Some(context),
                None,
            ).await {
                eprintln!("Failed to report panic: {}", e);
            }
        });
    }));
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_error_reporting() {
        let temp_dir = TempDir::new().unwrap();
        let config = ErrorReportingConfig {
            local_storage_path: temp_dir.path().to_path_buf(),
            ..Default::default()
        };

        let reporter = ErrorReporter::new(config);
        reporter.initialize().await.unwrap();

        let report_id = reporter.report_error(
            ErrorType::DatabaseError,
            "Test error".to_string(),
            Some("Test stack trace".to_string()),
            None,
            None,
        ).await.unwrap();

        assert!(!report_id.is_empty());

        let reports = reporter.get_pending_reports().await;
        assert_eq!(reports.len(), 1);
        assert_eq!(reports[0].message, "Test error");
    }

    #[test]
    fn test_severity_determination() {
        assert_eq!(
            ErrorReporter::determine_severity(&ErrorType::Crash, "test"),
            ErrorSeverity::Critical
        );
        
        assert_eq!(
            ErrorReporter::determine_severity(&ErrorType::NetworkError, "timeout error"),
            ErrorSeverity::Medium
        );
    }
}