import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { invoke } from "@tauri-apps/api/tauri";

interface AdvancedSettingsProps {
  onClose: () => void;
}

export function AdvancedSettings({ onClose }: AdvancedSettingsProps) {
  const [settings, setSettings] = useState({
    // Security settings
    encryption: {
      enabled: false,
      algorithm: "AES-256-GCM",
      encryptSensitiveFiles: true,
      encryptAnalysisResults: false,
    },
    
    // Access control
    accessControl: {
      enabled: false,
      protectedDirectories: [] as string[],
      requireAuthentication: false,
    },
    
    // Audit logging
    auditLogging: {
      enabled: true,
      logLevel: "INFO",
      retentionDays: 90,
      logLocation: "",
    },
    
    // API key management
    apiKeys: {
      openaiKey: "",
      anthropicKey: "",
      storeSecurely: true,
    },
    
    // System tray
    systemTray: {
      enabled: true,
      minimizeToTray: true,
      showNotifications: true,
      quickActionsEnabled: true,
    },
    
    // Notifications
    notifications: {
      enabled: true,
      systemNotifications: true,
      inAppNotifications: true,
      soundEnabled: true,
      doNotDisturb: false,
      quietHours: {
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      },
      categories: {
        fileProcessing: { enabled: true, priority: "normal" },
        aiAnalysis: { enabled: true, priority: "normal" },
        system: { enabled: true, priority: "high" },
        errors: { enabled: true, priority: "critical" },
        updates: { enabled: true, priority: "normal" },
        security: { enabled: true, priority: "high" },
      }
    },
    
    // Advanced performance
    performance: {
      enableGpuAcceleration: false,
      gpuMemoryLimit: 2048,
      useMemoryMapping: true,
      enableLazyLoading: true,
      cacheStrategy: "aggressive",
      backgroundProcessingPriority: "low",
    },
    
    // Platform optimizations
    platform: {
      enableNativeIntegrations: true,
      spotlightIntegration: true,
      fileExplorerIntegration: true,
      contextMenuIntegration: false,
    },
    
    // Debug and developer
    debug: {
      enableVerboseLogging: false,
      showDebugInfo: false,
      enableMetrics: false,
      exportDiagnostics: false,
    }
  });

  const [activeSection, setActiveSection] = useState("security");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAdvancedSettings();
  }, []);

  const loadAdvancedSettings = async () => {
    try {
      const response = await invoke("get_advanced_config");
      if (response) {
        setSettings(prev => ({ ...prev, ...response }));
      }
    } catch (error) {
      console.error("Failed to load advanced settings:", error);
    }
  };

  const saveAdvancedSettings = async () => {
    setIsLoading(true);
    try {
      await invoke("update_advanced_config", { config: settings });
      console.log("Advanced settings saved successfully");
    } catch (error) {
      console.error("Failed to save advanced settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sections = [
    { id: "security", name: "Security & Privacy", icon: "🔒" },
    { id: "systemTray", name: "System Tray", icon: "📱" },
    { id: "notifications", name: "Notifications", icon: "🔔" },
    { id: "performance", name: "Advanced Performance", icon: "⚡" },
    { id: "platform", name: "Platform Integration", icon: "🖥️" },
    { id: "debug", name: "Debug & Developer", icon: "🔧" },
  ];

  const renderSecuritySettings = () => (
    <div className="space-y-8">
      {/* Encryption Settings */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Data Encryption
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Encryption
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Encrypt sensitive files and analysis results
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.encryption.enabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                encryption: { ...prev.encryption, enabled: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          {settings.encryption.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Encryption Algorithm
                </label>
                <select
                  value={settings.encryption.algorithm}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    encryption: { ...prev.encryption, algorithm: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="AES-256-GCM">AES-256-GCM (Recommended)</option>
                  <option value="ChaCha20-Poly1305">ChaCha20-Poly1305</option>
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Encrypt sensitive files
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.encryption.encryptSensitiveFiles}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      encryption: { ...prev.encryption, encryptSensitiveFiles: e.target.checked }
                    }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Encrypt analysis results
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.encryption.encryptAnalysisResults}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      encryption: { ...prev.encryption, encryptAnalysisResults: e.target.checked }
                    }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Access Control Settings */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Access Control
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Access Control
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Protect specific directories from analysis
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.accessControl.enabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                accessControl: { ...prev.accessControl, enabled: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          {settings.accessControl.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Protected Directories
                </label>
                <textarea
                  value={settings.accessControl.protectedDirectories.join('\n')}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    accessControl: {
                      ...prev.accessControl,
                      protectedDirectories: e.target.value.split('\n').filter(p => p.trim())
                    }
                  }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="/Users/username/Private&#10;/Users/username/Documents/Sensitive"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Audit Logging */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Audit Logging
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Audit Logging
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Log all file access and AI processing activities
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.auditLogging.enabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                auditLogging: { ...prev.auditLogging, enabled: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          {settings.auditLogging.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Log Level
                </label>
                <select
                  value={settings.auditLogging.logLevel}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    auditLogging: { ...prev.auditLogging, logLevel: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="ERROR">Error Only</option>
                  <option value="WARN">Warning & Error</option>
                  <option value="INFO">Info, Warning & Error</option>
                  <option value="DEBUG">All (Debug)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retention Period: {settings.auditLogging.retentionDays} days
                </label>
                <input
                  type="range"
                  min="7"
                  max="365"
                  value={settings.auditLogging.retentionDays}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    auditLogging: { ...prev.auditLogging, retentionDays: Number(e.target.value) }
                  }))}
                  className="w-full"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSystemTraySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable System Tray
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Show MetaMind icon in system tray for quick access
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.systemTray.enabled}
          onChange={(e) => setSettings(prev => ({
            ...prev,
            systemTray: { ...prev.systemTray, enabled: e.target.checked }
          }))}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>

      {settings.systemTray.enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800"
        >
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Minimize to tray instead of taskbar
            </label>
            <input
              type="checkbox"
              checked={settings.systemTray.minimizeToTray}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                systemTray: { ...prev.systemTray, minimizeToTray: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Show tray notifications
            </label>
            <input
              type="checkbox"
              checked={settings.systemTray.showNotifications}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                systemTray: { ...prev.systemTray, showNotifications: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Enable quick actions menu
            </label>
            <input
              type="checkbox"
              checked={settings.systemTray.quickActionsEnabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                systemTray: { ...prev.systemTray, quickActionsEnabled: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderNotificationsSettings = () => (
    <div className="space-y-8">
      {/* General notification settings */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          General Notifications
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Notifications
            </label>
            <input
              type="checkbox"
              checked={settings.notifications.enabled}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, enabled: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          {settings.notifications.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800"
            >
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  System notifications
                </label>
                <input
                  type="checkbox"
                  checked={settings.notifications.systemNotifications}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, systemNotifications: e.target.checked }
                  }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  In-app notifications
                </label>
                <input
                  type="checkbox"
                  checked={settings.notifications.inAppNotifications}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, inAppNotifications: e.target.checked }
                  }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Notification sounds
                </label>
                <input
                  type="checkbox"
                  checked={settings.notifications.soundEnabled}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, soundEnabled: e.target.checked }
                  }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Quiet Hours
        </h3>
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Quiet Hours
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Suppress non-critical notifications during specified hours
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifications.quietHours.enabled}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              notifications: {
                ...prev.notifications,
                quietHours: { ...prev.notifications.quietHours, enabled: e.target.checked }
              }
            }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
        </div>

        {settings.notifications.quietHours.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={settings.notifications.quietHours.startTime}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      quietHours: { ...prev.notifications.quietHours, startTime: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={settings.notifications.quietHours.endTime}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      quietHours: { ...prev.notifications.quietHours, endTime: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Notification Categories */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Notification Categories
        </h3>
        
        <div className="space-y-3">
          {Object.entries(settings.notifications.categories).map(([key, category]) => (
            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-apple">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Priority: {category.priority}
                </p>
              </div>
              <input
                type="checkbox"
                checked={category.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    categories: {
                      ...prev.notifications.categories,
                      [key]: { ...category, enabled: e.target.checked }
                    }
                  }
                }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPerformanceSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            GPU Acceleration
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use GPU for AI processing when available
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.performance.enableGpuAcceleration}
          onChange={(e) => setSettings(prev => ({
            ...prev,
            performance: { ...prev.performance, enableGpuAcceleration: e.target.checked }
          }))}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>

      {settings.performance.enableGpuAcceleration && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="pl-4 border-l-2 border-primary-200 dark:border-primary-800"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              GPU Memory Limit: {(settings.performance.gpuMemoryLimit / 1024).toFixed(1)} GB
            </label>
            <input
              type="range"
              min="512"
              max="8192"
              step="512"
              value={settings.performance.gpuMemoryLimit}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                performance: { ...prev.performance, gpuMemoryLimit: Number(e.target.value) }
              }))}
              className="w-full"
            />
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Memory Mapping
          </label>
          <input
            type="checkbox"
            checked={settings.performance.useMemoryMapping}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              performance: { ...prev.performance, useMemoryMapping: e.target.checked }
            }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Lazy Loading
          </label>
          <input
            type="checkbox"
            checked={settings.performance.enableLazyLoading}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              performance: { ...prev.performance, enableLazyLoading: e.target.checked }
            }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Cache Strategy
        </label>
        <select
          value={settings.performance.cacheStrategy}
          onChange={(e) => setSettings(prev => ({
            ...prev,
            performance: { ...prev.performance, cacheStrategy: e.target.value }
          }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="conservative">Conservative</option>
          <option value="balanced">Balanced</option>
          <option value="aggressive">Aggressive</option>
        </select>
      </div>
    </div>
  );

  const renderPlatformSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Native Integrations
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enable platform-specific features and optimizations
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.platform.enableNativeIntegrations}
          onChange={(e) => setSettings(prev => ({
            ...prev,
            platform: { ...prev.platform, enableNativeIntegrations: e.target.checked }
          }))}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>

      {settings.platform.enableNativeIntegrations && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4 pl-4 border-l-2 border-primary-200 dark:border-primary-800"
        >
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Spotlight Integration (macOS)
            </label>
            <input
              type="checkbox"
              checked={settings.platform.spotlightIntegration}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                platform: { ...prev.platform, spotlightIntegration: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              File Explorer Integration
            </label>
            <input
              type="checkbox"
              checked={settings.platform.fileExplorerIntegration}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                platform: { ...prev.platform, fileExplorerIntegration: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Context Menu Integration
            </label>
            <input
              type="checkbox"
              checked={settings.platform.contextMenuIntegration}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                platform: { ...prev.platform, contextMenuIntegration: e.target.checked }
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderDebugSettings = () => (
    <div className="space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-apple p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              ⚠️ Developer Settings
            </h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              These settings are intended for debugging and development. Enable only if you understand the implications.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Verbose Logging
          </label>
          <input
            type="checkbox"
            checked={settings.debug.enableVerboseLogging}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              debug: { ...prev.debug, enableVerboseLogging: e.target.checked }
            }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Show Debug Info
          </label>
          <input
            type="checkbox"
            checked={settings.debug.showDebugInfo}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              debug: { ...prev.debug, showDebugInfo: e.target.checked }
            }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Metrics Collection
          </label>
          <input
            type="checkbox"
            checked={settings.debug.enableMetrics}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              debug: { ...prev.debug, enableMetrics: e.target.checked }
            }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await invoke("export_diagnostics");
                console.log("Diagnostics exported successfully");
              } catch (error) {
                console.error("Failed to export diagnostics:", error);
              }
            }}
            className="w-full"
          >
            Export Diagnostics
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case "security": return renderSecuritySettings();
      case "systemTray": return renderSystemTraySettings();
      case "notifications": return renderNotificationsSettings();
      case "performance": return renderPerformanceSettings();
      case "platform": return renderPlatformSettings();
      case "debug": return renderDebugSettings();
      default: return renderSecuritySettings();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-white dark:bg-gray-900 rounded-apple shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Advanced Settings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure advanced features and system behavior
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-[calc(90vh-140px)]">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <div className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-apple text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg">{section.icon}</span>
                  <span className="font-medium text-sm">{section.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {sections.find(s => s.id === activeSection)?.name}
              </h3>
              
              {renderSectionContent()}
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={saveAdvancedSettings} loading={isLoading}>
            Save Advanced Settings
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}