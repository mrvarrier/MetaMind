use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Plugin system for MetaMind extensibility
pub struct PluginSystem {
    plugins: Arc<RwLock<HashMap<String, Plugin>>>,
    hooks: Arc<RwLock<HashMap<HookType, Vec<String>>>>,
    config: Arc<RwLock<PluginSystemConfig>>,
    sandbox: Arc<RwLock<PluginSandbox>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSystemConfig {
    pub enabled: bool,
    pub plugin_directory: PathBuf,
    pub max_plugins: usize,
    pub sandbox_enabled: bool,
    pub auto_update: bool,
    pub allowed_permissions: Vec<PluginPermission>,
}

impl Default for PluginSystemConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            plugin_directory: dirs::data_dir()
                .unwrap_or_else(|| std::env::current_dir().unwrap())
                .join("MetaMind")
                .join("plugins"),
            max_plugins: 50,
            sandbox_enabled: true,
            auto_update: false,
            allowed_permissions: vec![
                PluginPermission::FileRead,
                PluginPermission::FileAnalysis,
                PluginPermission::UIRender,
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plugin {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub homepage: Option<String>,
    pub enabled: bool,
    pub installed_at: DateTime<Utc>,
    pub last_updated: Option<DateTime<Utc>>,
    pub manifest: PluginManifest,
    pub runtime_info: PluginRuntimeInfo,
    pub permissions: Vec<PluginPermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub license: String,
    pub main: String,
    pub hooks: Vec<HookDefinition>,
    pub permissions: Vec<PluginPermission>,
    pub dependencies: Vec<PluginDependency>,
    pub ui_components: Vec<UIComponent>,
    pub file_processors: Vec<FileProcessor>,
    pub ai_models: Vec<AIModelDefinition>,
    pub search_providers: Vec<SearchProvider>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRuntimeInfo {
    pub status: PluginStatus,
    pub memory_usage: Option<usize>,
    pub cpu_usage: Option<f64>,
    pub last_execution: Option<DateTime<Utc>>,
    pub execution_count: u64,
    pub error_count: u64,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginStatus {
    Loaded,
    Running,
    Stopped,
    Error(String),
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginPermission {
    FileRead,
    FileWrite,
    FileAnalysis,
    NetworkAccess,
    SystemInfo,
    UIRender,
    DatabaseRead,
    DatabaseWrite,
    AIAccess,
    NotificationSend,
    ConfigRead,
    ConfigWrite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookDefinition {
    pub hook_type: HookType,
    pub function_name: String,
    pub priority: i32,
    pub async_execution: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub enum HookType {
    FileProcessed,
    FileAdded,
    FileUpdated,
    FileDeleted,
    SearchStarted,
    SearchCompleted,
    UIRender,
    AppStartup,
    AppShutdown,
    SettingsChanged,
    AIAnalysisStarted,
    AIAnalysisCompleted,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDependency {
    pub name: String,
    pub version: String,
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIComponent {
    pub name: String,
    pub component_type: UIComponentType,
    pub placement: UIPlacement,
    pub props: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UIComponentType {
    Panel,
    Modal,
    Sidebar,
    StatusBar,
    ContextMenu,
    SearchFilter,
    FilePreview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UIPlacement {
    MainPanel,
    LeftSidebar,
    RightSidebar,
    TopBar,
    BottomBar,
    SearchArea,
    FileViewer,
    SettingsPage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileProcessor {
    pub name: String,
    pub supported_extensions: Vec<String>,
    pub mime_types: Vec<String>,
    pub processor_type: ProcessorType,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessorType {
    ContentExtractor,
    MetadataExtractor,
    ThumbnailGenerator,
    ContentAnalyzer,
    Classifier,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIModelDefinition {
    pub name: String,
    pub model_type: AIModelType,
    pub supported_tasks: Vec<AITask>,
    pub requirements: ModelRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AIModelType {
    TextAnalysis,
    ImageAnalysis,
    AudioAnalysis,
    VideoAnalysis,
    Embedding,
    Classification,
    Generation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AITask {
    TextSummarization,
    ImageDescription,
    ObjectDetection,
    SentimentAnalysis,
    ContentClassification,
    SimilaritySearch,
    LanguageDetection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRequirements {
    pub min_memory_mb: usize,
    pub gpu_required: bool,
    pub min_cpu_cores: usize,
    pub supported_platforms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchProvider {
    pub name: String,
    pub provider_type: SearchProviderType,
    pub capabilities: Vec<SearchCapability>,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchProviderType {
    Local,
    Remote,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchCapability {
    TextSearch,
    SemanticSearch,
    ImageSearch,
    MetadataSearch,
    SimilaritySearch,
    FacetedSearch,
}

/// Plugin sandbox for secure execution
pub struct PluginSandbox {
    allowed_paths: Vec<PathBuf>,
    network_access: bool,
    max_memory: usize,
    max_cpu_time: std::time::Duration,
    active_plugins: HashMap<String, SandboxedPlugin>,
}

#[derive(Debug)]
pub struct SandboxedPlugin {
    pub id: String,
    pub start_time: std::time::Instant,
    pub memory_usage: usize,
    pub permissions: Vec<PluginPermission>,
}

/// Plugin API interface for communication with the main application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginAPI {
    pub version: String,
    pub available_functions: Vec<APIFunction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APIFunction {
    pub name: String,
    pub description: String,
    pub parameters: Vec<APIParameter>,
    pub return_type: String,
    pub required_permission: PluginPermission,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APIParameter {
    pub name: String,
    pub parameter_type: String,
    pub description: String,
    pub required: bool,
    pub default_value: Option<serde_json::Value>,
}

/// Plugin execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginContext {
    pub plugin_id: String,
    pub execution_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub data: HashMap<String, serde_json::Value>,
    pub permissions: Vec<PluginPermission>,
}

/// Plugin execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time: std::time::Duration,
    pub memory_usage: Option<usize>,
}

impl PluginSystem {
    pub async fn new(config: PluginSystemConfig) -> Result<Self> {
        // Ensure plugin directory exists
        tokio::fs::create_dir_all(&config.plugin_directory).await?;

        let sandbox = PluginSandbox {
            allowed_paths: vec![config.plugin_directory.clone()],
            network_access: false,
            max_memory: 100 * 1024 * 1024, // 100MB
            max_cpu_time: std::time::Duration::from_secs(30),
            active_plugins: HashMap::new(),
        };

        Ok(Self {
            plugins: Arc::new(RwLock::new(HashMap::new())),
            hooks: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(config)),
            sandbox: Arc::new(RwLock::new(sandbox)),
        })
    }

    /// Load plugins from the plugin directory
    pub async fn load_plugins(&self) -> Result<()> {
        let config = self.config.read().await;
        if !config.enabled {
            return Ok(());
        }

        let plugin_dir = &config.plugin_directory;
        if !plugin_dir.exists() {
            return Ok(());
        }

        let mut dir_entries = tokio::fs::read_dir(plugin_dir).await?;
        while let Some(entry) = dir_entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                if let Err(e) = self.load_plugin(&entry.path()).await {
                    tracing::error!("Failed to load plugin from {:?}: {}", entry.path(), e);
                }
            }
        }

        tracing::info!("Loaded {} plugins", self.plugins.read().await.len());
        Ok(())
    }

    /// Load a single plugin from a directory
    async fn load_plugin(&self, plugin_path: &Path) -> Result<()> {
        let manifest_path = plugin_path.join("plugin.json");
        if !manifest_path.exists() {
            return Err(anyhow::anyhow!("Plugin manifest not found"));
        }

        let manifest_content = tokio::fs::read_to_string(&manifest_path).await?;
        let manifest: PluginManifest = serde_json::from_str(&manifest_content)?;

        // Validate manifest
        self.validate_manifest(&manifest).await?;

        let plugin = Plugin {
            id: format!("{}_{}", manifest.name, manifest.version),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            author: manifest.author.clone(),
            homepage: None,
            enabled: true,
            installed_at: Utc::now(),
            last_updated: None,
            manifest,
            runtime_info: PluginRuntimeInfo {
                status: PluginStatus::Loaded,
                memory_usage: None,
                cpu_usage: None,
                last_execution: None,
                execution_count: 0,
                error_count: 0,
                last_error: None,
            },
            permissions: vec![], // Set during validation
        };

        // Register hooks
        self.register_plugin_hooks(&plugin).await?;

        self.plugins.write().await.insert(plugin.id.clone(), plugin);
        tracing::info!("Loaded plugin: {}", plugin_path.display());
        Ok(())
    }

    /// Validate plugin manifest
    async fn validate_manifest(&self, manifest: &PluginManifest) -> Result<()> {
        // Check version compatibility
        if manifest.name.is_empty() || manifest.version.is_empty() {
            return Err(anyhow::anyhow!("Plugin name and version are required"));
        }

        // Validate permissions
        let config = self.config.read().await;
        for permission in &manifest.permissions {
            if !config.allowed_permissions.contains(permission) {
                return Err(anyhow::anyhow!("Permission {:?} not allowed", permission));
            }
        }

        // Check plugin count limit
        if self.plugins.read().await.len() >= config.max_plugins {
            return Err(anyhow::anyhow!("Maximum number of plugins reached"));
        }

        Ok(())
    }

    /// Register plugin hooks
    async fn register_plugin_hooks(&self, plugin: &Plugin) -> Result<()> {
        let mut hooks = self.hooks.write().await;

        for hook_def in &plugin.manifest.hooks {
            let hook_list = hooks.entry(hook_def.hook_type.clone()).or_insert_with(Vec::new);
            hook_list.push(plugin.id.clone());
            
            // Sort by priority
            hook_list.sort_by(|a, b| {
                let plugin_a = self.plugins.blocking_read().get(a).map(|p| p.manifest.hooks.iter()
                    .find(|h| h.hook_type == hook_def.hook_type)
                    .map(|h| h.priority)
                    .unwrap_or(0)
                ).unwrap_or(0);
                
                let plugin_b = self.plugins.blocking_read().get(b).map(|p| p.manifest.hooks.iter()
                    .find(|h| h.hook_type == hook_def.hook_type)
                    .map(|h| h.priority)
                    .unwrap_or(0)
                ).unwrap_or(0);
                
                plugin_b.cmp(&plugin_a) // Higher priority first
            });
        }

        Ok(())
    }

    /// Execute hooks for a specific event
    pub async fn execute_hooks(&self, hook_type: HookType, data: serde_json::Value) -> Result<Vec<PluginResult>> {
        let hooks = self.hooks.read().await;
        let plugin_ids = hooks.get(&hook_type).cloned().unwrap_or_default();
        drop(hooks);

        let mut results = Vec::new();

        for plugin_id in plugin_ids {
            if let Some(plugin) = self.plugins.read().await.get(&plugin_id).cloned() {
                if !plugin.enabled {
                    continue;
                }

                match self.execute_plugin_hook(&plugin, &hook_type, data.clone()).await {
                    Ok(result) => results.push(result),
                    Err(e) => {
                        tracing::error!("Plugin {} hook execution failed: {}", plugin_id, e);
                        results.push(PluginResult {
                            success: false,
                            data: None,
                            error: Some(e.to_string()),
                            execution_time: std::time::Duration::from_millis(0),
                            memory_usage: None,
                        });
                    }
                }
            }
        }

        Ok(results)
    }

    /// Execute a specific plugin hook
    async fn execute_plugin_hook(
        &self,
        plugin: &Plugin,
        hook_type: &HookType,
        data: serde_json::Value,
    ) -> Result<PluginResult> {
        let start_time = std::time::Instant::now();

        // Create execution context
        let context = PluginContext {
            plugin_id: plugin.id.clone(),
            execution_id: Uuid::new_v4(),
            start_time: Utc::now(),
            data: {
                let mut map = HashMap::new();
                map.insert("hook_data".to_string(), data);
                map
            },
            permissions: plugin.permissions.clone(),
        };

        // Check sandbox constraints
        if self.config.read().await.sandbox_enabled {
            self.validate_sandbox_constraints(&plugin.id).await?;
        }

        // Execute plugin (this would be implemented based on the plugin runtime)
        let result = self.execute_plugin_function(plugin, hook_type, context).await?;

        let execution_time = start_time.elapsed();

        // Update plugin runtime info
        self.update_plugin_runtime_info(&plugin.id, &result, execution_time).await?;

        Ok(PluginResult {
            success: result.is_some(),
            data: result,
            error: None,
            execution_time,
            memory_usage: None, // Would be measured by sandbox
        })
    }

    /// Execute plugin function (placeholder for actual plugin runtime)
    async fn execute_plugin_function(
        &self,
        plugin: &Plugin,
        hook_type: &HookType,
        context: PluginContext,
    ) -> Result<Option<serde_json::Value>> {
        // This is a placeholder. In a real implementation, this would:
        // 1. Load the plugin's JavaScript/WebAssembly/Python code
        // 2. Create a sandboxed execution environment
        // 3. Call the appropriate function based on hook_type
        // 4. Return the result

        tracing::debug!("Executing plugin {} for hook {:?}", plugin.id, hook_type);
        
        // Simulate plugin execution
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        
        Ok(Some(serde_json::json!({
            "plugin_id": plugin.id,
            "hook_type": format!("{:?}", hook_type),
            "execution_id": context.execution_id,
            "message": "Plugin executed successfully"
        })))
    }

    /// Validate sandbox constraints
    async fn validate_sandbox_constraints(&self, plugin_id: &str) -> Result<()> {
        let sandbox = self.sandbox.read().await;
        
        if let Some(sandboxed_plugin) = sandbox.active_plugins.get(plugin_id) {
            // Check execution time
            if sandboxed_plugin.start_time.elapsed() > sandbox.max_cpu_time {
                return Err(anyhow::anyhow!("Plugin execution time exceeded"));
            }

            // Check memory usage
            if sandboxed_plugin.memory_usage > sandbox.max_memory {
                return Err(anyhow::anyhow!("Plugin memory usage exceeded"));
            }
        }

        Ok(())
    }

    /// Update plugin runtime information
    async fn update_plugin_runtime_info(
        &self,
        plugin_id: &str,
        result: &Option<serde_json::Value>,
        execution_time: std::time::Duration,
    ) -> Result<()> {
        let mut plugins = self.plugins.write().await;
        
        if let Some(plugin) = plugins.get_mut(plugin_id) {
            plugin.runtime_info.last_execution = Some(Utc::now());
            plugin.runtime_info.execution_count += 1;
            
            if result.is_none() {
                plugin.runtime_info.error_count += 1;
            }
        }

        Ok(())
    }

    /// Install a new plugin
    pub async fn install_plugin(&self, plugin_path: &Path) -> Result<String> {
        // Validate plugin package
        self.validate_plugin_package(plugin_path).await?;

        // Extract plugin to plugins directory
        let config = self.config.read().await;
        let plugin_id = self.extract_plugin(plugin_path, &config.plugin_directory).await?;

        // Load the plugin
        let plugin_dir = config.plugin_directory.join(&plugin_id);
        self.load_plugin(&plugin_dir).await?;

        tracing::info!("Plugin {} installed successfully", plugin_id);
        Ok(plugin_id)
    }

    /// Validate plugin package
    async fn validate_plugin_package(&self, plugin_path: &Path) -> Result<()> {
        // Check file exists and is readable
        if !plugin_path.exists() {
            return Err(anyhow::anyhow!("Plugin package not found"));
        }

        // TODO: Validate plugin signature, check for malicious code, etc.
        Ok(())
    }

    /// Extract plugin package
    async fn extract_plugin(&self, plugin_path: &Path, plugins_dir: &Path) -> Result<String> {
        // This is a simplified extraction - in reality you'd handle ZIP files, etc.
        let plugin_id = plugin_path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        let target_dir = plugins_dir.join(&plugin_id);
        tokio::fs::create_dir_all(&target_dir).await?;

        // Copy files (simplified - in reality you'd extract from archive)
        if plugin_path.is_dir() {
            self.copy_dir_recursive(plugin_path, &target_dir).await?;
        }

        Ok(plugin_id)
    }

    /// Recursively copy directory
    async fn copy_dir_recursive(&self, src: &Path, dst: &Path) -> Result<()> {
        tokio::fs::create_dir_all(dst).await?;
        
        let mut dir = tokio::fs::read_dir(src).await?;
        while let Some(entry) = dir.next_entry().await? {
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            
            if src_path.is_dir() {
                self.copy_dir_recursive(&src_path, &dst_path).await?;
            } else {
                tokio::fs::copy(&src_path, &dst_path).await?;
            }
        }
        
        Ok(())
    }

    /// Uninstall a plugin
    pub async fn uninstall_plugin(&self, plugin_id: &str) -> Result<()> {
        // Remove from memory
        self.plugins.write().await.remove(plugin_id);

        // Remove hooks
        let mut hooks = self.hooks.write().await;
        for hook_list in hooks.values_mut() {
            hook_list.retain(|id| id != plugin_id);
        }

        // Remove from filesystem
        let config = self.config.read().await;
        let plugin_dir = config.plugin_directory.join(plugin_id);
        if plugin_dir.exists() {
            tokio::fs::remove_dir_all(&plugin_dir).await?;
        }

        tracing::info!("Plugin {} uninstalled successfully", plugin_id);
        Ok(())
    }

    /// Enable/disable a plugin
    pub async fn set_plugin_enabled(&self, plugin_id: &str, enabled: bool) -> Result<()> {
        let mut plugins = self.plugins.write().await;
        
        if let Some(plugin) = plugins.get_mut(plugin_id) {
            plugin.enabled = enabled;
            plugin.runtime_info.status = if enabled {
                PluginStatus::Loaded
            } else {
                PluginStatus::Disabled
            };
            
            tracing::info!("Plugin {} {}", plugin_id, if enabled { "enabled" } else { "disabled" });
        } else {
            return Err(anyhow::anyhow!("Plugin not found: {}", plugin_id));
        }

        Ok(())
    }

    /// Get list of all plugins
    pub async fn get_plugins(&self) -> Vec<Plugin> {
        self.plugins.read().await.values().cloned().collect()
    }

    /// Get plugin by ID
    pub async fn get_plugin(&self, plugin_id: &str) -> Option<Plugin> {
        self.plugins.read().await.get(plugin_id).cloned()
    }

    /// Get plugin API interface
    pub async fn get_plugin_api(&self) -> PluginAPI {
        PluginAPI {
            version: "1.0.0".to_string(),
            available_functions: vec![
                APIFunction {
                    name: "search_files".to_string(),
                    description: "Search for files in the database".to_string(),
                    parameters: vec![
                        APIParameter {
                            name: "query".to_string(),
                            parameter_type: "string".to_string(),
                            description: "Search query".to_string(),
                            required: true,
                            default_value: None,
                        },
                    ],
                    return_type: "Array<File>".to_string(),
                    required_permission: PluginPermission::DatabaseRead,
                },
                APIFunction {
                    name: "analyze_file".to_string(),
                    description: "Analyze a file with AI".to_string(),
                    parameters: vec![
                        APIParameter {
                            name: "file_path".to_string(),
                            parameter_type: "string".to_string(),
                            description: "Path to the file".to_string(),
                            required: true,
                            default_value: None,
                        },
                    ],
                    return_type: "AnalysisResult".to_string(),
                    required_permission: PluginPermission::AIAccess,
                },
                APIFunction {
                    name: "show_notification".to_string(),
                    description: "Show a notification to the user".to_string(),
                    parameters: vec![
                        APIParameter {
                            name: "title".to_string(),
                            parameter_type: "string".to_string(),
                            description: "Notification title".to_string(),
                            required: true,
                            default_value: None,
                        },
                        APIParameter {
                            name: "message".to_string(),
                            parameter_type: "string".to_string(),
                            description: "Notification message".to_string(),
                            required: true,
                            default_value: None,
                        },
                    ],
                    return_type: "void".to_string(),
                    required_permission: PluginPermission::NotificationSend,
                },
            ],
        }
    }
}

// Utility function for plugins to use (would be exposed via API)
impl PluginSystem {
    /// Plugin utility: Search files
    pub async fn plugin_search_files(&self, _query: &str, _context: &PluginContext) -> Result<Vec<serde_json::Value>> {
        // Implementation would call the actual search system
        Ok(vec![])
    }

    /// Plugin utility: Show notification
    pub async fn plugin_show_notification(&self, _title: &str, _message: &str, _context: &PluginContext) -> Result<()> {
        // Implementation would call the notification system
        Ok(())
    }

    /// Plugin utility: Analyze file
    pub async fn plugin_analyze_file(&self, _file_path: &str, _context: &PluginContext) -> Result<serde_json::Value> {
        // Implementation would call the AI analysis system
        Ok(serde_json::json!({}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_plugin_system_creation() {
        let temp_dir = TempDir::new().unwrap();
        let config = PluginSystemConfig {
            plugin_directory: temp_dir.path().to_path_buf(),
            ..Default::default()
        };

        let plugin_system = PluginSystem::new(config).await.unwrap();
        assert!(plugin_system.plugins.read().await.is_empty());
    }

    #[tokio::test]
    async fn test_hook_execution() {
        let temp_dir = TempDir::new().unwrap();
        let config = PluginSystemConfig {
            plugin_directory: temp_dir.path().to_path_buf(),
            ..Default::default()
        };

        let plugin_system = PluginSystem::new(config).await.unwrap();
        
        let hook_data = serde_json::json!({"test": "data"});
        let results = plugin_system.execute_hooks(HookType::FileProcessed, hook_data).await.unwrap();
        
        // Should be empty since no plugins are loaded
        assert!(results.is_empty());
    }

    #[test]
    fn test_plugin_manifest_serialization() {
        let manifest = PluginManifest {
            name: "test-plugin".to_string(),
            version: "1.0.0".to_string(),
            description: "Test plugin".to_string(),
            author: "Test Author".to_string(),
            license: "MIT".to_string(),
            main: "index.js".to_string(),
            hooks: vec![],
            permissions: vec![PluginPermission::FileRead],
            dependencies: vec![],
            ui_components: vec![],
            file_processors: vec![],
            ai_models: vec![],
            search_providers: vec![],
        };

        let serialized = serde_json::to_string(&manifest).unwrap();
        let deserialized: PluginManifest = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(manifest.name, deserialized.name);
        assert_eq!(manifest.version, deserialized.version);
    }
}