use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::time;
use tracing::{info, warn, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: String,
    pub url: String,
    pub signature: String,
    pub size: Option<u64>,
    pub release_date: String,
    pub is_critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub download_progress: Option<f64>,
    pub status: UpdateStatusType,
    pub error: Option<String>,
    pub last_checked: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UpdateStatusType {
    Checking,
    Available,
    Downloading,
    Downloaded,
    Installing,
    Installed,
    UpToDate,
    Error,
}

#[derive(Debug, Clone)]
pub struct UpdaterConfig {
    pub check_interval_hours: u64,
    pub auto_download: bool,
    pub auto_install: bool,
    pub beta_channel: bool,
    pub update_endpoint: String,
}

impl Default for UpdaterConfig {
    fn default() -> Self {
        Self {
            check_interval_hours: 24,
            auto_download: true,
            auto_install: false,
            beta_channel: false,
            update_endpoint: "https://api.github.com/repos/metamind/metamind/releases".to_string(),
        }
    }
}

#[derive(Debug)]
pub struct Updater {
    config: UpdaterConfig,
    status: UpdateStatus,
    last_check: Option<Instant>,
    client: reqwest::Client,
}

impl Updater {
    pub fn new(config: UpdaterConfig) -> Self {
        let current_version = env!("CARGO_PKG_VERSION").to_string();
        
        Self {
            config,
            status: UpdateStatus {
                available: false,
                current_version: current_version.clone(),
                latest_version: None,
                download_progress: None,
                status: UpdateStatusType::UpToDate,
                error: None,
                last_checked: None,
            },
            last_check: None,
            client: reqwest::Client::new(),
        }
    }

    pub async fn start_background_checker(&mut self) -> Result<()> {
        let check_interval = Duration::from_secs(self.config.check_interval_hours * 3600);
        
        // Initial check
        if let Err(e) = self.check_for_updates().await {
            warn!("Initial update check failed: {}", e);
        }
        
        // Start periodic checking
        let mut interval = time::interval(check_interval);
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.check_for_updates().await {
                error!("Periodic update check failed: {}", e);
                self.status.status = UpdateStatusType::Error;
                self.status.error = Some(e.to_string());
            }
        }
    }

    pub async fn check_for_updates(&mut self) -> Result<bool> {
        info!("Checking for updates...");
        
        self.status.status = UpdateStatusType::Checking;
        self.status.error = None;
        self.last_check = Some(Instant::now());
        
        let update_info = self.fetch_latest_release().await?;
        
        if let Some(info) = update_info {
            let is_newer = self.is_version_newer(&info.version, &self.status.current_version)?;
            
            if is_newer {
                info!("Update available: {} -> {}", self.status.current_version, info.version);
                
                self.status.available = true;
                self.status.latest_version = Some(info.version.clone());
                self.status.status = UpdateStatusType::Available;
                
                // Auto-download if enabled
                if self.config.auto_download {
                    self.download_update(&info).await?;
                }
                
                return Ok(true);
            }
        }
        
        self.status.status = UpdateStatusType::UpToDate;
        self.status.available = false;
        info!("Application is up to date");
        
        Ok(false)
    }

    async fn fetch_latest_release(&self) -> Result<Option<UpdateInfo>> {
        let url = if self.config.beta_channel {
            format!("{}/latest", self.config.update_endpoint)
        } else {
            format!("{}/latest", self.config.update_endpoint)
        };
        
        debug!("Fetching release info from: {}", url);
        
        let response = self.client
            .get(&url)
            .header("User-Agent", format!("MetaMind/{}", env!("CARGO_PKG_VERSION")))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch release info: {}", response.status()));
        }
        
        let release_data: serde_json::Value = response.json().await?;
        
        // Parse GitHub release format
        if let Some(tag_name) = release_data["tag_name"].as_str() {
            let version = tag_name.trim_start_matches('v').to_string();
            let notes = release_data["body"].as_str().unwrap_or("").to_string();
            let release_date = release_data["published_at"].as_str().unwrap_or("").to_string();
            let is_prerelease = release_data["prerelease"].as_bool().unwrap_or(false);
            
            // Skip prereleases unless beta channel is enabled
            if is_prerelease && !self.config.beta_channel {
                return Ok(None);
            }
            
            // Find appropriate asset for current platform
            if let Some(assets) = release_data["assets"].as_array() {
                for asset in assets {
                    if let Some(asset_name) = asset["name"].as_str() {
                        if self.is_asset_for_current_platform(asset_name) {
                            let download_url = asset["browser_download_url"].as_str().unwrap_or("").to_string();
                            let size = asset["size"].as_u64();
                            
                            return Ok(Some(UpdateInfo {
                                version,
                                notes: notes.clone(),
                                url: download_url,
                                signature: "".to_string(), // TODO: Implement signature verification
                                size,
                                release_date,
                                is_critical: self.is_critical_update(&notes),
                            }));
                        }
                    }
                }
            }
        }
        
        Ok(None)
    }

    fn is_asset_for_current_platform(&self, asset_name: &str) -> bool {
        let os = std::env::consts::OS;
        let _arch = std::env::consts::ARCH;
        
        match os {
            "macos" => asset_name.contains("darwin") || asset_name.contains("macos"),
            "linux" => asset_name.contains("linux") && asset_name.contains("x86_64"),
            "windows" => asset_name.contains("windows") || asset_name.ends_with(".msi") || asset_name.ends_with(".exe"),
            _ => false,
        }
    }

    fn is_critical_update(&self, notes: &str) -> bool {
        let critical_keywords = ["critical", "security", "urgent", "hotfix", "vulnerability"];
        let notes_lower = notes.to_lowercase();
        
        critical_keywords.iter().any(|keyword| notes_lower.contains(keyword))
    }

    fn is_version_newer(&self, new_version: &str, current_version: &str) -> Result<bool> {
        let new_parts = self.parse_version(new_version)?;
        let current_parts = self.parse_version(current_version)?;
        
        for (new, current) in new_parts.iter().zip(current_parts.iter()) {
            if new > current {
                return Ok(true);
            } else if new < current {
                return Ok(false);
            }
        }
        
        // If all parts are equal, check if new version has more parts
        Ok(new_parts.len() > current_parts.len())
    }

    fn parse_version(&self, version: &str) -> Result<Vec<u64>> {
        version
            .split('.')
            .map(|part| {
                // Remove any non-numeric suffix (like "1.0.0-beta")
                let numeric_part = part.split('-').next().unwrap_or(part);
                numeric_part.parse::<u64>()
                    .map_err(|e| anyhow!("Invalid version format: {}", e))
            })
            .collect()
    }

    async fn download_update(&mut self, update_info: &UpdateInfo) -> Result<()> {
        info!("Downloading update: {}", update_info.version);
        
        self.status.status = UpdateStatusType::Downloading;
        self.status.download_progress = Some(0.0);
        
        let response = self.client
            .get(&update_info.url)
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Failed to download update: {}", response.status()));
        }
        
        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded = 0u64;
        let mut stream = response.bytes_stream();
        
        // Create download directory
        let download_dir = std::env::temp_dir().join("metamind_updates");
        tokio::fs::create_dir_all(&download_dir).await?;
        
        let file_name = update_info.url.split('/').last().unwrap_or("update");
        let file_path = download_dir.join(file_name);
        
        let mut file = tokio::fs::File::create(&file_path).await?;
        
        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;
        
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            
            downloaded += chunk.len() as u64;
            
            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64) * 100.0;
                self.status.download_progress = Some(progress);
                
                if downloaded % (1024 * 1024) == 0 {
                    debug!("Download progress: {:.1}%", progress);
                }
            }
        }
        
        file.flush().await?;
        
        self.status.status = UpdateStatusType::Downloaded;
        self.status.download_progress = Some(100.0);
        
        info!("Update downloaded successfully to: {}", file_path.display());
        
        // Auto-install if enabled
        if self.config.auto_install {
            self.install_update(&file_path).await?;
        }
        
        Ok(())
    }

    async fn install_update(&mut self, file_path: &std::path::Path) -> Result<()> {
        info!("Installing update from: {}", file_path.display());
        
        self.status.status = UpdateStatusType::Installing;
        
        // Platform-specific installation
        match std::env::consts::OS {
            "macos" => self.install_macos_update(file_path).await,
            "linux" => self.install_linux_update(file_path).await,
            "windows" => self.install_windows_update(file_path).await,
            _ => Err(anyhow!("Unsupported platform for auto-installation")),
        }?;
        
        self.status.status = UpdateStatusType::Installed;
        info!("Update installed successfully");
        
        Ok(())
    }

    async fn install_macos_update(&self, file_path: &std::path::Path) -> Result<()> {
        if file_path.extension().map_or(false, |ext| ext == "dmg") {
            // Mount DMG and copy application
            let output = tokio::process::Command::new("hdiutil")
                .args(["attach", "-quiet", "-nobrowse"])
                .arg(file_path)
                .output()
                .await?;
            
            if !output.status.success() {
                return Err(anyhow!("Failed to mount DMG"));
            }
            
            // Extract mount point from output
            let output_str = String::from_utf8_lossy(&output.stdout);
            let mount_point = output_str
                .lines()
                .last()
                .and_then(|line| line.split_whitespace().last())
                .ok_or_else(|| anyhow!("Could not determine mount point"))?;
            
            // Copy application to Applications folder
            let app_path = format!("{}/MetaMind.app", mount_point);
            
            tokio::process::Command::new("cp")
                .args(["-R", &app_path, "/Applications/"])
                .output()
                .await?;
            
            // Unmount DMG
            tokio::process::Command::new("hdiutil")
                .args(["detach", mount_point])
                .output()
                .await?;
        }
        
        Ok(())
    }

    async fn install_linux_update(&self, file_path: &std::path::Path) -> Result<()> {
        if file_path.extension().map_or(false, |ext| ext == "AppImage") {
            // Replace current AppImage
            let current_exe = std::env::current_exe()?;
            let backup_path = current_exe.with_extension("backup");
            
            // Create backup
            tokio::fs::copy(&current_exe, &backup_path).await?;
            
            // Replace with new version
            tokio::fs::copy(file_path, &current_exe).await?;
            
            // Make executable
            tokio::process::Command::new("chmod")
                .args(["+x"])
                .arg(&current_exe)
                .output()
                .await?;
        }
        
        Ok(())
    }

    async fn install_windows_update(&self, file_path: &std::path::Path) -> Result<()> {
        if file_path.extension().map_or(false, |ext| ext == "msi") {
            // Run MSI installer
            tokio::process::Command::new("msiexec")
                .args(["/i"])
                .arg(file_path)
                .args(["/quiet", "/norestart"])
                .output()
                .await?;
        }
        
        Ok(())
    }

    pub fn get_status(&self) -> &UpdateStatus {
        &self.status
    }

    pub async fn force_check(&mut self) -> Result<bool> {
        self.check_for_updates().await
    }

    pub fn should_check(&self) -> bool {
        if let Some(last_check) = self.last_check {
            let elapsed = last_check.elapsed();
            let check_interval = Duration::from_secs(self.config.check_interval_hours * 3600);
            elapsed >= check_interval
        } else {
            true
        }
    }

    pub fn update_config(&mut self, config: UpdaterConfig) {
        self.config = config;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparison() {
        let updater = Updater::new(UpdaterConfig::default());
        
        assert!(updater.is_version_newer("1.1.0", "1.0.0").unwrap());
        assert!(updater.is_version_newer("2.0.0", "1.9.9").unwrap());
        assert!(updater.is_version_newer("1.0.1", "1.0.0").unwrap());
        assert!(!updater.is_version_newer("1.0.0", "1.0.0").unwrap());
        assert!(!updater.is_version_newer("1.0.0", "1.0.1").unwrap());
    }

    #[test]
    fn test_parse_version() {
        let updater = Updater::new(UpdaterConfig::default());
        
        assert_eq!(updater.parse_version("1.0.0").unwrap(), vec![1, 0, 0]);
        assert_eq!(updater.parse_version("2.1.3").unwrap(), vec![2, 1, 3]);
        assert_eq!(updater.parse_version("1.0.0-beta").unwrap(), vec![1, 0, 0]);
    }

    #[test]
    fn test_critical_update_detection() {
        let updater = Updater::new(UpdaterConfig::default());
        
        assert!(updater.is_critical_update("This is a critical security fix"));
        assert!(updater.is_critical_update("URGENT: Fix vulnerability"));
        assert!(!updater.is_critical_update("Minor bug fixes and improvements"));
    }
}