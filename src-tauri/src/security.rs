use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Comprehensive security manager for MetaMind
pub struct SecurityManager {
    config: Arc<RwLock<SecurityConfig>>,
    encryption: Arc<RwLock<EncryptionManager>>,
    access_control: Arc<RwLock<AccessControlManager>>,
    audit_log: Arc<RwLock<AuditLogger>>,
    key_manager: Arc<RwLock<SecureKeyManager>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub encryption_enabled: bool,
    pub audit_logging_enabled: bool,
    pub access_control_enabled: bool,
    pub secure_key_storage: bool,
    pub data_retention_days: u32,
    pub protected_directories: Vec<PathBuf>,
    pub encryption_algorithm: String,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            encryption_enabled: true,
            audit_logging_enabled: true,
            access_control_enabled: true,
            secure_key_storage: true,
            data_retention_days: 365,
            protected_directories: Vec::new(),
            encryption_algorithm: "AES-256-GCM".to_string(),
        }
    }
}

/// Handles file encryption and decryption
pub struct EncryptionManager {
    master_key: Option<[u8; 32]>,
    algorithm: EncryptionAlgorithm,
    encrypted_files: HashMap<PathBuf, EncryptionMetadata>,
}

#[derive(Debug, Clone)]
pub enum EncryptionAlgorithm {
    Aes256Gcm,
    ChaCha20Poly1305,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionMetadata {
    pub file_id: Uuid,
    pub algorithm: String,
    pub nonce: Vec<u8>,
    pub tag: Vec<u8>,
    pub encrypted_at: DateTime<Utc>,
}

impl EncryptionManager {
    pub fn new() -> Self {
        Self {
            master_key: None,
            algorithm: EncryptionAlgorithm::Aes256Gcm,
            encrypted_files: HashMap::new(),
        }
    }

    pub async fn initialize_encryption(&mut self, password: Option<&str>) -> Result<()> {
        // Generate or derive master key
        self.master_key = Some(self.derive_master_key(password).await?);
        tracing::info!("Encryption manager initialized");
        Ok(())
    }

    async fn derive_master_key(&self, password: Option<&str>) -> Result<[u8; 32]> {
        match password {
            Some(pwd) => {
                // Use PBKDF2 to derive key from password
                use pbkdf2::pbkdf2_hmac;
                use sha2::Sha256;
                
                let salt = b"metamind_salt_v1"; // In production, use random salt
                let mut key = [0u8; 32];
                pbkdf2_hmac::<Sha256>(pwd.as_bytes(), salt, 100_000, &mut key);
                Ok(key)
            }
            None => {
                // Generate random key
                use rand::RngCore;
                let mut key = [0u8; 32];
                rand::thread_rng().fill_bytes(&mut key);
                Ok(key)
            }
        }
    }

    pub async fn encrypt_file(&mut self, file_path: &Path) -> Result<PathBuf> {
        let master_key = self.master_key
            .ok_or_else(|| anyhow::anyhow!("Encryption not initialized"))?;

        let file_content = tokio::fs::read(file_path).await
            .context("Failed to read file for encryption")?;

        let encrypted_data = match self.algorithm {
            EncryptionAlgorithm::Aes256Gcm => {
                self.encrypt_aes256_gcm(&file_content, &master_key).await?
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                self.encrypt_chacha20_poly1305(&file_content, &master_key).await?
            }
        };

        let encrypted_path = file_path.with_extension("encrypted");
        tokio::fs::write(&encrypted_path, &encrypted_data.ciphertext).await
            .context("Failed to write encrypted file")?;

        // Store encryption metadata
        let metadata = EncryptionMetadata {
            file_id: Uuid::new_v4(),
            algorithm: format!("{:?}", self.algorithm),
            nonce: encrypted_data.nonce,
            tag: encrypted_data.tag,
            encrypted_at: Utc::now(),
        };

        self.encrypted_files.insert(file_path.to_path_buf(), metadata);

        tracing::info!("File encrypted successfully: {:?}", file_path);
        Ok(encrypted_path)
    }

    pub async fn decrypt_file(&self, encrypted_path: &Path) -> Result<Vec<u8>> {
        let master_key = self.master_key
            .ok_or_else(|| anyhow::anyhow!("Encryption not initialized"))?;

        let original_path = encrypted_path.with_file_name(
            encrypted_path.file_stem().unwrap_or_default()
        );

        let metadata = self.encrypted_files.get(&original_path)
            .ok_or_else(|| anyhow::anyhow!("No encryption metadata found"))?;

        let ciphertext = tokio::fs::read(encrypted_path).await
            .context("Failed to read encrypted file")?;

        let decrypted_data = match self.algorithm {
            EncryptionAlgorithm::Aes256Gcm => {
                self.decrypt_aes256_gcm(&ciphertext, &metadata.nonce, &metadata.tag, &master_key).await?
            }
            EncryptionAlgorithm::ChaCha20Poly1305 => {
                self.decrypt_chacha20_poly1305(&ciphertext, &metadata.nonce, &metadata.tag, &master_key).await?
            }
        };

        tracing::info!("File decrypted successfully: {:?}", encrypted_path);
        Ok(decrypted_data)
    }

    async fn encrypt_aes256_gcm(&self, data: &[u8], key: &[u8; 32]) -> Result<EncryptedData> {
        use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, NewAead}};
        use rand::RngCore;

        let cipher = Aes256Gcm::new(Key::from_slice(key));
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;

        Ok(EncryptedData {
            ciphertext,
            nonce: nonce_bytes.to_vec(),
            tag: Vec::new(), // Tag is included in ciphertext for AES-GCM
        })
    }

    async fn decrypt_aes256_gcm(&self, ciphertext: &[u8], nonce: &[u8], _tag: &[u8], key: &[u8; 32]) -> Result<Vec<u8>> {
        use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, NewAead}};

        let cipher = Aes256Gcm::new(Key::from_slice(key));
        let nonce = Nonce::from_slice(nonce);

        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {:?}", e))?;

        Ok(plaintext)
    }

    async fn encrypt_chacha20_poly1305(&self, data: &[u8], key: &[u8; 32]) -> Result<EncryptedData> {
        use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce, aead::{Aead, NewAead}};
        use rand::RngCore;

        let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;

        Ok(EncryptedData {
            ciphertext,
            nonce: nonce_bytes.to_vec(),
            tag: Vec::new(), // Tag is included in ciphertext
        })
    }

    async fn decrypt_chacha20_poly1305(&self, ciphertext: &[u8], nonce: &[u8], _tag: &[u8], key: &[u8; 32]) -> Result<Vec<u8>> {
        use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce, aead::{Aead, NewAead}};

        let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
        let nonce = Nonce::from_slice(nonce);

        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {:?}", e))?;

        Ok(plaintext)
    }
}

#[derive(Debug)]
struct EncryptedData {
    ciphertext: Vec<u8>,
    nonce: Vec<u8>,
    tag: Vec<u8>,
}

/// Manages access control for protected directories and files
pub struct AccessControlManager {
    protected_paths: HashMap<PathBuf, AccessPolicy>,
    user_permissions: HashMap<String, Vec<Permission>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessPolicy {
    pub path: PathBuf,
    pub required_permissions: Vec<Permission>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Permission {
    Read,
    Write,
    Execute,
    Delete,
    Encrypt,
    Decrypt,
}

impl AccessControlManager {
    pub fn new() -> Self {
        Self {
            protected_paths: HashMap::new(),
            user_permissions: HashMap::new(),
        }
    }

    pub async fn add_protected_path(&mut self, path: PathBuf, permissions: Vec<Permission>) -> Result<()> {
        let policy = AccessPolicy {
            path: path.clone(),
            required_permissions: permissions,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.protected_paths.insert(path.clone(), policy);
        tracing::info!("Added protected path: {:?}", path);
        Ok(())
    }

    pub async fn check_access(&self, user: &str, path: &Path, permission: &Permission) -> Result<bool> {
        // Check if path is protected
        let is_protected = self.protected_paths.keys()
            .any(|protected_path| path.starts_with(protected_path));

        if !is_protected {
            return Ok(true); // Allow access to unprotected paths
        }

        // Check user permissions
        let user_permissions = self.user_permissions.get(user).unwrap_or(&Vec::new());
        let has_permission = user_permissions.contains(permission);

        tracing::debug!("Access check for user '{}' on path '{:?}': {}", user, path, has_permission);
        Ok(has_permission)
    }

    pub async fn grant_permission(&mut self, user: String, permission: Permission) -> Result<()> {
        self.user_permissions.entry(user.clone()).or_insert_with(Vec::new).push(permission.clone());
        tracing::info!("Granted permission '{:?}' to user '{}'", permission, user);
        Ok(())
    }
}

/// Comprehensive audit logging system
pub struct AuditLogger {
    logs: Vec<AuditLogEntry>,
    max_entries: usize,
    log_file: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub event_type: AuditEventType,
    pub user: Option<String>,
    pub resource: String,
    pub action: String,
    pub result: AuditResult,
    pub details: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditEventType {
    FileAccess,
    FileModification,
    Encryption,
    Decryption,
    AIProcessing,
    SearchQuery,
    ConfigurationChange,
    Authentication,
    Authorization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditResult {
    Success,
    Failure,
    Denied,
}

impl AuditLogger {
    pub fn new(log_file: Option<PathBuf>) -> Self {
        Self {
            logs: Vec::new(),
            max_entries: 10_000,
            log_file,
        }
    }

    pub async fn log_event(
        &mut self,
        event_type: AuditEventType,
        user: Option<String>,
        resource: String,
        action: String,
        result: AuditResult,
        details: HashMap<String, String>,
    ) -> Result<()> {
        let entry = AuditLogEntry {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            event_type,
            user,
            resource,
            action,
            result,
            details,
        };

        self.logs.push(entry.clone());

        // Rotate logs if needed
        if self.logs.len() > self.max_entries {
            self.logs.remove(0);
        }

        // Write to file if configured
        if let Some(log_file) = &self.log_file {
            self.write_log_entry_to_file(log_file, &entry).await?;
        }

        tracing::info!("Audit log entry created: {:?}", entry.event_type);
        Ok(())
    }

    async fn write_log_entry_to_file(&self, log_file: &Path, entry: &AuditLogEntry) -> Result<()> {
        use tokio::io::AsyncWriteExt;

        let log_line = serde_json::to_string(entry)?;
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file)
            .await?;

        file.write_all(log_line.as_bytes()).await?;
        file.write_all(b"\n").await?;
        file.flush().await?;

        Ok(())
    }

    pub async fn get_logs(&self, limit: Option<usize>) -> Vec<AuditLogEntry> {
        let limit = limit.unwrap_or(100);
        self.logs.iter().rev().take(limit).cloned().collect()
    }

    pub async fn search_logs(&self, query: &str) -> Vec<AuditLogEntry> {
        self.logs
            .iter()
            .filter(|log| {
                log.resource.contains(query) ||
                log.action.contains(query) ||
                log.user.as_ref().map_or(false, |u| u.contains(query))
            })
            .cloned()
            .collect()
    }
}

/// Secure key management with keychain integration
pub struct SecureKeyManager {
    keys: HashMap<String, SecureKey>,
    keychain_service: String,
}

#[derive(Debug, Clone)]
pub struct SecureKey {
    pub id: String,
    pub key_type: KeyType,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub enum KeyType {
    ApiKey,
    EncryptionKey,
    SigningKey,
    AuthToken,
}

impl SecureKeyManager {
    pub fn new() -> Self {
        Self {
            keys: HashMap::new(),
            keychain_service: "com.metamind.keychain".to_string(),
        }
    }

    pub async fn store_key(&mut self, key_id: String, key_value: &str, key_type: KeyType) -> Result<()> {
        // Store in system keychain
        #[cfg(target_os = "macos")]
        self.store_key_macos(&key_id, key_value).await?;

        #[cfg(target_os = "windows")]
        self.store_key_windows(&key_id, key_value).await?;

        #[cfg(target_os = "linux")]
        self.store_key_linux(&key_id, key_value).await?;

        let secure_key = SecureKey {
            id: key_id.clone(),
            key_type,
            created_at: Utc::now(),
            last_used: None,
        };

        self.keys.insert(key_id, secure_key);
        tracing::info!("Secure key stored successfully");
        Ok(())
    }

    pub async fn retrieve_key(&mut self, key_id: &str) -> Result<String> {
        // Retrieve from system keychain
        let key_value = {
            #[cfg(target_os = "macos")]
            { self.retrieve_key_macos(key_id).await? }

            #[cfg(target_os = "windows")]
            { self.retrieve_key_windows(key_id).await? }

            #[cfg(target_os = "linux")]
            { self.retrieve_key_linux(key_id).await? }
        };

        // Update last used timestamp
        if let Some(key) = self.keys.get_mut(key_id) {
            key.last_used = Some(Utc::now());
        }

        tracing::info!("Secure key retrieved successfully");
        Ok(key_value)
    }

    #[cfg(target_os = "macos")]
    async fn store_key_macos(&self, key_id: &str, key_value: &str) -> Result<()> {
        use keyring::Entry;
        let entry = Entry::new(&self.keychain_service, key_id)?;
        entry.set_password(key_value)?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn retrieve_key_macos(&self, key_id: &str) -> Result<String> {
        use keyring::Entry;
        let entry = Entry::new(&self.keychain_service, key_id)?;
        let password = entry.get_password()?;
        Ok(password)
    }

    #[cfg(target_os = "windows")]
    async fn store_key_windows(&self, key_id: &str, key_value: &str) -> Result<()> {
        use keyring::Entry;
        let entry = Entry::new(&self.keychain_service, key_id)?;
        entry.set_password(key_value)?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    async fn retrieve_key_windows(&self, key_id: &str) -> Result<String> {
        use keyring::Entry;
        let entry = Entry::new(&self.keychain_service, key_id)?;
        let password = entry.get_password()?;
        Ok(password)
    }

    #[cfg(target_os = "linux")]
    async fn store_key_linux(&self, key_id: &str, key_value: &str) -> Result<()> {
        use keyring::Entry;
        let entry = Entry::new(&self.keychain_service, key_id)?;
        entry.set_password(key_value)?;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn retrieve_key_linux(&self, key_id: &str) -> Result<String> {
        use keyring::Entry;
        let entry = Entry::new(&self.keychain_service, key_id)?;
        let password = entry.get_password()?;
        Ok(password)
    }
}

impl SecurityManager {
    pub async fn new(config: SecurityConfig) -> Result<Self> {
        let config = Arc::new(RwLock::new(config));
        let encryption = Arc::new(RwLock::new(EncryptionManager::new()));
        let access_control = Arc::new(RwLock::new(AccessControlManager::new()));
        
        let audit_log_file = dirs::data_dir()
            .map(|dir| dir.join("MetaMind").join("audit.log"));
        let audit_log = Arc::new(RwLock::new(AuditLogger::new(audit_log_file)));
        
        let key_manager = Arc::new(RwLock::new(SecureKeyManager::new()));

        Ok(Self {
            config,
            encryption,
            access_control,
            audit_log,
            key_manager,
        })
    }

    pub async fn initialize(&self, encryption_password: Option<&str>) -> Result<()> {
        // Initialize encryption if enabled
        if self.config.read().await.encryption_enabled {
            self.encryption.write().await.initialize_encryption(encryption_password).await?;
        }

        // Set up protected directories
        let config = self.config.read().await;
        for path in &config.protected_directories {
            self.access_control.write().await
                .add_protected_path(path.clone(), vec![Permission::Read, Permission::Write])
                .await?;
        }

        tracing::info!("Security manager initialized successfully");
        Ok(())
    }

    pub async fn encrypt_sensitive_file(&self, file_path: &Path) -> Result<PathBuf> {
        if !self.config.read().await.encryption_enabled {
            return Err(anyhow::anyhow!("Encryption is disabled"));
        }

        let encrypted_path = self.encryption.write().await.encrypt_file(file_path).await?;

        // Log the encryption event
        let mut details = HashMap::new();
        details.insert("original_path".to_string(), file_path.to_string_lossy().to_string());
        details.insert("encrypted_path".to_string(), encrypted_path.to_string_lossy().to_string());

        self.audit_log.write().await.log_event(
            AuditEventType::Encryption,
            Some("system".to_string()),
            file_path.to_string_lossy().to_string(),
            "encrypt_file".to_string(),
            AuditResult::Success,
            details,
        ).await?;

        Ok(encrypted_path)
    }

    pub async fn check_file_access(&self, user: &str, file_path: &Path, permission: Permission) -> Result<bool> {
        let has_access = self.access_control.read().await.check_access(user, file_path, &permission).await?;

        // Log the access check
        let mut details = HashMap::new();
        details.insert("permission".to_string(), format!("{:?}", permission));
        details.insert("granted".to_string(), has_access.to_string());

        self.audit_log.write().await.log_event(
            AuditEventType::Authorization,
            Some(user.to_string()),
            file_path.to_string_lossy().to_string(),
            "check_access".to_string(),
            if has_access { AuditResult::Success } else { AuditResult::Denied },
            details,
        ).await?;

        Ok(has_access)
    }

    pub async fn get_audit_logs(&self, limit: Option<usize>) -> Result<Vec<AuditLogEntry>> {
        Ok(self.audit_log.read().await.get_logs(limit).await)
    }

    pub async fn store_api_key(&self, service: &str, api_key: &str) -> Result<()> {
        self.key_manager.write().await
            .store_key(service.to_string(), api_key, KeyType::ApiKey)
            .await?;

        // Log the key storage event (without the actual key)
        let mut details = HashMap::new();
        details.insert("service".to_string(), service.to_string());

        self.audit_log.write().await.log_event(
            AuditEventType::ConfigurationChange,
            Some("system".to_string()),
            "api_keys".to_string(),
            "store_key".to_string(),
            AuditResult::Success,
            details,
        ).await?;

        Ok(())
    }

    pub async fn retrieve_api_key(&self, service: &str) -> Result<String> {
        let key = self.key_manager.write().await.retrieve_key(service).await?;

        // Log the key retrieval event
        let mut details = HashMap::new();
        details.insert("service".to_string(), service.to_string());

        self.audit_log.write().await.log_event(
            AuditEventType::Authentication,
            Some("system".to_string()),
            "api_keys".to_string(),
            "retrieve_key".to_string(),
            AuditResult::Success,
            details,
        ).await?;

        Ok(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_encryption_manager() {
        let mut manager = EncryptionManager::new();
        manager.initialize_encryption(Some("test_password")).await.unwrap();

        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.txt");
        tokio::fs::write(&test_file, b"Hello, World!").await.unwrap();

        let encrypted_path = manager.encrypt_file(&test_file).await.unwrap();
        assert!(encrypted_path.exists());

        let decrypted_data = manager.decrypt_file(&encrypted_path).await.unwrap();
        assert_eq!(decrypted_data, b"Hello, World!");
    }

    #[tokio::test]
    async fn test_access_control() {
        let mut manager = AccessControlManager::new();
        let test_path = PathBuf::from("/protected/test.txt");
        
        manager.add_protected_path(test_path.clone(), vec![Permission::Read]).await.unwrap();
        manager.grant_permission("user1".to_string(), Permission::Read).await.unwrap();

        let has_access = manager.check_access("user1", &test_path, &Permission::Read).await.unwrap();
        assert!(has_access);

        let no_access = manager.check_access("user1", &test_path, &Permission::Write).await.unwrap();
        assert!(!no_access);
    }

    #[tokio::test]
    async fn test_audit_logger() {
        let mut logger = AuditLogger::new(None);
        let mut details = HashMap::new();
        details.insert("test".to_string(), "value".to_string());

        logger.log_event(
            AuditEventType::FileAccess,
            Some("test_user".to_string()),
            "/test/file.txt".to_string(),
            "read".to_string(),
            AuditResult::Success,
            details,
        ).await.unwrap();

        let logs = logger.get_logs(Some(10)).await;
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].user, Some("test_user".to_string()));
    }
}