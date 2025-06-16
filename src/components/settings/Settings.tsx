import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { invoke } from "@tauri-apps/api/tauri";

export function Settings() {
  const { theme, setTheme, config } = useAppStore();
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  
  const [settings, setSettings] = useState({
    theme: theme,
    notifications: true,
    autoAnalysis: true,
    maxCpuUsage: 50,
    maxMemoryUsage: 2048,
    processingThreads: 4,
    enableGpu: true,
    thermalThrottling: true,
    backgroundProcessing: true,
    monitoredFolders: [],
    excludePatterns: [".git", "node_modules", ".DS_Store"],
    maxFileSize: 100,
    aiModel: "llama3.1:8b",
    enableTelemetry: false,
    dataRetention: 30,
    enableEncryption: false,
  });

  const tabs = [
    { id: "general", name: "General", icon: "⚙️" },
    { id: "performance", name: "Performance", icon: "⚡" },
    { id: "monitoring", name: "Monitoring", icon: "👁️" },
    { id: "ai", name: "AI Model", icon: "🤖" },
    { id: "privacy", name: "Privacy", icon: "🔒" },
  ];

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // Update theme immediately
      setTheme(settings.theme);
      
      // Save other settings to backend
      await invoke("update_config", {
        configUpdate: {
          performance: {
            max_cpu_usage: settings.maxCpuUsage,
            max_memory_usage_mb: settings.maxMemoryUsage,
            processing_threads: settings.processingThreads,
            enable_gpu_acceleration: settings.enableGpu,
            thermal_throttling: settings.thermalThrottling,
            enable_background_processing: settings.backgroundProcessing,
          },
          monitoring: {
            excluded_patterns: settings.excludePatterns,
            max_file_size_mb: settings.maxFileSize,
          },
          ai: {
            model: settings.aiModel,
          },
          privacy: {
            enable_telemetry: settings.enableTelemetry,
            data_retention_days: settings.dataRetention,
            encrypt_sensitive_data: settings.enableEncryption,
          }
        }
      });
      
      // Show success notification (you could implement this)
      console.log("Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Appearance
        </label>
        <select
          value={settings.theme}
          onChange={(e) => setSettings({ ...settings, theme: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">System</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Notifications
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Get notified about analysis completion and system events
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.notifications}
          onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Auto Analysis
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Automatically analyze new files when detected
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.autoAnalysis}
          onChange={(e) => setSettings({ ...settings, autoAnalysis: e.target.checked })}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>
    </div>
  );

  const renderPerformanceSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          CPU Usage Limit: {settings.maxCpuUsage}%
        </label>
        <input
          type="range"
          min="10"
          max="90"
          value={settings.maxCpuUsage}
          onChange={(e) => setSettings({ ...settings, maxCpuUsage: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Memory Limit: {(settings.maxMemoryUsage / 1024).toFixed(1)} GB
        </label>
        <input
          type="range"
          min="512"
          max="8192"
          step="512"
          value={settings.maxMemoryUsage}
          onChange={(e) => setSettings({ ...settings, maxMemoryUsage: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Processing Threads: {settings.processingThreads}
        </label>
        <input
          type="range"
          min="1"
          max="16"
          value={settings.processingThreads}
          onChange={(e) => setSettings({ ...settings, processingThreads: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            GPU Acceleration
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use GPU for faster AI processing (if available)
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.enableGpu}
          onChange={(e) => setSettings({ ...settings, enableGpu: e.target.checked })}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Thermal Throttling
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Reduce processing when system gets hot
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.thermalThrottling}
          onChange={(e) => setSettings({ ...settings, thermalThrottling: e.target.checked })}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>
    </div>
  );

  const renderMonitoringSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Exclude Patterns
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          File patterns to exclude from monitoring (one per line)
        </p>
        <textarea
          value={settings.excludePatterns.join('\n')}
          onChange={(e) => setSettings({ 
            ...settings, 
            excludePatterns: e.target.value.split('\n').filter(p => p.trim()) 
          })}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder=".git&#10;node_modules&#10;.DS_Store"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Maximum File Size: {settings.maxFileSize} MB
        </label>
        <input
          type="range"
          min="1"
          max="1000"
          value={settings.maxFileSize}
          onChange={(e) => setSettings({ ...settings, maxFileSize: Number(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  );

  const renderAISettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          AI Model
        </label>
        <select
          value={settings.aiModel}
          onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="llama3.1:8b">Llama 3.1 8B (Recommended)</option>
          <option value="llama3.1:13b">Llama 3.1 13B</option>
          <option value="mistral:7b">Mistral 7B</option>
          <option value="codellama:13b">Code Llama 13B</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Changing models requires restart and re-analysis of files
        </p>
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Telemetry
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Send anonymous usage data to help improve MetaMind
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.enableTelemetry}
          onChange={(e) => setSettings({ ...settings, enableTelemetry: e.target.checked })}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Data Retention: {settings.dataRetention} days
        </label>
        <input
          type="range"
          min="7"
          max="365"
          value={settings.dataRetention}
          onChange={(e) => setSettings({ ...settings, dataRetention: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Encrypt Sensitive Data
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Encrypt AI analysis results and metadata
          </p>
        </div>
        <input
          type="checkbox"
          checked={settings.enableEncryption}
          onChange={(e) => setSettings({ ...settings, enableEncryption: e.target.checked })}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "general": return renderGeneralSettings();
      case "performance": return renderPerformanceSettings();
      case "monitoring": return renderMonitoringSettings();
      case "ai": return renderAISettings();
      case "privacy": return renderPrivacySettings();
      default: return renderGeneralSettings();
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configure MetaMind to work best for your needs
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-apple text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="card-notion p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {tabs.find(tab => tab.id === activeTab)?.name} Settings
              </h2>
              
              {renderTabContent()}

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button variant="secondary">
                  Reset to Defaults
                </Button>
                <Button onClick={handleSaveSettings} loading={isLoading}>
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}