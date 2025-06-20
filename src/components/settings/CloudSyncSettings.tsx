import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { invoke } from "@tauri-apps/api/tauri";

interface CloudSyncConfig {
  enabled: boolean;
  auto_sync: boolean;
  sync_interval_minutes: number;
  active_provider: string | null;
  providers: Record<string, ProviderConfig>;
  sync_settings: SyncSettings;
}

interface ProviderConfig {
  provider_type: string;
  credentials: Record<string, string>;
  settings: Record<string, string>;
  enabled: boolean;
}

interface SyncSettings {
  sync_database: boolean;
  sync_preferences: boolean;
  sync_plugins: boolean;
  sync_cache: boolean;
  conflict_resolution: string;
  bandwidth_limit_mbps: number | null;
  sync_only_on_wifi: boolean;
}

interface SyncStatus {
  enabled: boolean;
  provider: string | null;
  last_sync: string | null;
  sync_in_progress: boolean;
  files_synced: number;
  files_failed: number;
  total_files: number;
  bytes_transferred: number;
  pending_conflicts: number;
  errors: Array<{
    file_path: string;
    error_message: string;
    timestamp: string;
    retry_count: number;
  }>;
}

const PROVIDER_TYPES = [
  { value: "GoogleDrive", label: "Google Drive", icon: "☁️" },
  { value: "Dropbox", label: "Dropbox", icon: "📦" },
  { value: "OneDrive", label: "OneDrive", icon: "💾" },
  { value: "S3", label: "Amazon S3", icon: "🗄️" },
];

const CONFLICT_RESOLUTIONS = [
  { value: "AskUser", label: "Ask me each time" },
  { value: "PreferLocal", label: "Always prefer local version" },
  { value: "PreferRemote", label: "Always prefer remote version" },
  { value: "PreferNewer", label: "Prefer newer version" },
  { value: "PreferLarger", label: "Prefer larger file" },
];

export function CloudSyncSettings() {
  const [config, setConfig] = useState<CloudSyncConfig>({
    enabled: false,
    auto_sync: true,
    sync_interval_minutes: 30,
    active_provider: null,
    providers: {},
    sync_settings: {
      sync_database: true,
      sync_preferences: true,
      sync_plugins: false,
      sync_cache: false,
      conflict_resolution: "AskUser",
      bandwidth_limit_mbps: null,
      sync_only_on_wifi: true,
    },
  });

  const [status, setStatus] = useState<SyncStatus>({
    enabled: false,
    provider: null,
    last_sync: null,
    sync_in_progress: false,
    files_synced: 0,
    files_failed: 0,
    total_files: 0,
    bytes_transferred: 0,
    pending_conflicts: 0,
    errors: [],
  });

  const [loading, setLoading] = useState(true);
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [providerCredentials, setProviderCredentials] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCloudSyncConfig();
    loadSyncStatus();
  }, []);

  const loadCloudSyncConfig = async () => {
    try {
      const syncConfig = await invoke('get_cloud_sync_config');
      setConfig(syncConfig as CloudSyncConfig);
    } catch (error) {
      console.error('Failed to load cloud sync config:', error);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const syncStatus = await invoke('get_sync_status');
      setStatus(syncStatus as SyncStatus);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (newConfig: Partial<CloudSyncConfig>) => {
    try {
      const updatedConfig = { ...config, ...newConfig };
      await invoke('update_cloud_sync_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update cloud sync config:', error);
    }
  };

  const startSync = async () => {
    try {
      await invoke('start_cloud_sync');
      await loadSyncStatus();
    } catch (error) {
      console.error('Failed to start sync:', error);
    }
  };

  const setupProvider = async () => {
    if (!selectedProvider) return;

    try {
      const providerConfig: ProviderConfig = {
        provider_type: selectedProvider,
        credentials: providerCredentials,
        settings: {},
        enabled: true,
      };

      const newProviders = { ...config.providers };
      newProviders[selectedProvider] = providerConfig;

      await updateConfig({
        providers: newProviders,
        active_provider: selectedProvider,
      });

      setShowProviderSetup(false);
      setSelectedProvider("");
      setProviderCredentials({});
    } catch (error) {
      console.error('Failed to setup provider:', error);
    }
  };

  const removeProvider = async (providerName: string) => {
    if (!confirm(`Remove ${providerName} provider?`)) return;

    const newProviders = { ...config.providers };
    delete newProviders[providerName];

    await updateConfig({
      providers: newProviders,
      active_provider: config.active_provider === providerName ? null : config.active_provider,
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Cloud Sync
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Synchronize your data across devices
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateConfig({ enabled: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Enable Cloud Sync
            </span>
          </label>
        </div>
      </div>

      {config.enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-6"
        >
          {/* Sync Status */}
          <div className="bg-white dark:bg-gray-800 rounded-apple border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sync Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {status.files_synced}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Files Synced</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {status.files_failed}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatBytes(status.bytes_transferred)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Transferred</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {status.pending_conflicts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Conflicts</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Last sync: {formatTimestamp(status.last_sync)}
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={startSync}
                  disabled={status.sync_in_progress || !config.active_provider}
                  loading={status.sync_in_progress}
                  size="sm"
                >
                  {status.sync_in_progress ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </div>
          </div>

          {/* Provider Setup */}
          <div className="bg-white dark:bg-gray-800 rounded-apple border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cloud Providers
              </h3>
              <Button onClick={() => setShowProviderSetup(true)} size="sm">
                Add Provider
              </Button>
            </div>

            {Object.keys(config.providers).length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-apple flex items-center justify-center">
                  ☁️
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Cloud Providers
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Add a cloud provider to enable synchronization
                </p>
                <Button onClick={() => setShowProviderSetup(true)}>
                  Add Your First Provider
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(config.providers).map(([name, provider]) => (
                  <div
                    key={name}
                    className={`flex items-center justify-between p-3 rounded-apple border ${
                      config.active_provider === name
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {PROVIDER_TYPES.find(p => p.value === provider.provider_type)?.icon || '☁️'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {PROVIDER_TYPES.find(p => p.value === provider.provider_type)?.label || name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {provider.enabled ? 'Active' : 'Inactive'}
                          {config.active_provider === name && ' • Primary'}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => updateConfig({ active_provider: name })}
                        disabled={config.active_provider === name}
                        size="sm"
                        variant="outline"
                      >
                        Set Primary
                      </Button>
                      <Button
                        onClick={() => removeProvider(name)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sync Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-apple border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sync Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.auto_sync}
                    onChange={(e) => updateConfig({ auto_sync: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enable automatic sync
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sync Interval (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={config.sync_interval_minutes}
                  onChange={(e) => updateConfig({ sync_interval_minutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What to sync
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.sync_settings.sync_database}
                      onChange={(e) => updateConfig({
                        sync_settings: { ...config.sync_settings, sync_database: e.target.checked }
                      })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Database and file index
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.sync_settings.sync_preferences}
                      onChange={(e) => updateConfig({
                        sync_settings: { ...config.sync_settings, sync_preferences: e.target.checked }
                      })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Preferences and settings
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.sync_settings.sync_plugins}
                      onChange={(e) => updateConfig({
                        sync_settings: { ...config.sync_settings, sync_plugins: e.target.checked }
                      })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Plugins and extensions
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conflict Resolution
                </label>
                <select
                  value={config.sync_settings.conflict_resolution}
                  onChange={(e) => updateConfig({
                    sync_settings: { ...config.sync_settings, conflict_resolution: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {CONFLICT_RESOLUTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.sync_settings.sync_only_on_wifi}
                    onChange={(e) => updateConfig({
                      sync_settings: { ...config.sync_settings, sync_only_on_wifi: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Only sync on Wi-Fi
                  </span>
                </label>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Provider Setup Modal */}
      {showProviderSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-apple shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Cloud Provider
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider Type
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a provider</option>
                  {PROVIDER_TYPES.map(provider => (
                    <option key={provider.value} value={provider.value}>
                      {provider.icon} {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProvider && (
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-apple p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      You'll need to provide API credentials for {PROVIDER_TYPES.find(p => p.value === selectedProvider)?.label}.
                      Check the provider's documentation for setup instructions.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      API Key / Access Token
                    </label>
                    <input
                      type="password"
                      value={providerCredentials.api_key || ''}
                      onChange={(e) => setProviderCredentials({ ...providerCredentials, api_key: e.target.value })}
                      placeholder="Enter your API key"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowProviderSetup(false);
                    setSelectedProvider("");
                    setProviderCredentials({});
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={setupProvider}
                  disabled={!selectedProvider || !providerCredentials.api_key}
                  className="flex-1"
                >
                  Add Provider
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}