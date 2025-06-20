import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../common/Button";
import { invoke } from "@tauri-apps/api/tauri";

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  installed_at: string;
  last_updated?: string;
  runtime_info: {
    status: string;
    execution_count: number;
    error_count: number;
    last_error?: string;
  };
  permissions: string[];
}

export function PluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [installFile, setInstallFile] = useState<File | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      const pluginList = await invoke('get_plugins');
      setPlugins(pluginList as Plugin[]);
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      await invoke('set_plugin_enabled', { pluginId, enabled });
      await loadPlugins();
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) {
      return;
    }

    try {
      await invoke('uninstall_plugin', { pluginId });
      await loadPlugins();
      setSelectedPlugin(null);
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    }
  };

  const handleInstallPlugin = async () => {
    if (!installFile) return;

    setIsInstalling(true);
    try {
      // For now, we'll just simulate installation
      // In a real implementation, you'd upload the file to the backend
      console.log('Installing plugin:', installFile.name);
      
      // Reset dialog
      setInstallFile(null);
      setShowInstallDialog(false);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to install plugin:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'loaded':
      case 'running':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'error':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      case 'disabled':
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
      default:
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Plugin Manager
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Manage MetaMind plugins to extend functionality
            </p>
          </div>
          <Button onClick={() => setShowInstallDialog(true)}>
            📦 Install Plugin
          </Button>
        </div>

        {/* Plugin Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plugin List */}
          <div className="lg:col-span-2">
            {plugins.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-apple-xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Plugins Installed
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Install plugins to extend MetaMind's functionality
                </p>
                <Button onClick={() => setShowInstallDialog(true)}>
                  Install Your First Plugin
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {plugins.map((plugin) => (
                  <motion.div
                    key={plugin.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 bg-white dark:bg-gray-800 rounded-apple border border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-lg ${
                      selectedPlugin?.id === plugin.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                    onClick={() => setSelectedPlugin(plugin)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {plugin.name}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded-apple text-xs font-medium ${getStatusColor(plugin.runtime_info.status)}`}
                          >
                            {plugin.runtime_info.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {plugin.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>v{plugin.version}</span>
                          <span>by {plugin.author}</span>
                          <span>{plugin.runtime_info.execution_count} executions</span>
                          {plugin.runtime_info.error_count > 0 && (
                            <span className="text-red-500">
                              {plugin.runtime_info.error_count} errors
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlugin(plugin.id, !plugin.enabled);
                          }}
                          className={`w-10 h-6 rounded-apple relative transition-colors ${
                            plugin.enabled
                              ? 'bg-primary-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                              plugin.enabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Plugin Details */}
          <div className="lg:col-span-1">
            {selectedPlugin ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-apple border border-gray-200 dark:border-gray-700 p-6 sticky top-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Plugin Details
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <p className="text-gray-900 dark:text-white">{selectedPlugin.name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Version
                    </label>
                    <p className="text-gray-900 dark:text-white">{selectedPlugin.version}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Author
                    </label>
                    <p className="text-gray-900 dark:text-white">{selectedPlugin.author}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <span
                      className={`inline-block px-2 py-1 rounded-apple text-xs font-medium ${getStatusColor(selectedPlugin.runtime_info.status)}`}
                    >
                      {selectedPlugin.runtime_info.status}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Permissions
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {selectedPlugin.permissions.map((permission, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-apple"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Statistics
                    </label>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Executions: {selectedPlugin.runtime_info.execution_count}</div>
                      <div>Errors: {selectedPlugin.runtime_info.error_count}</div>
                      <div>Installed: {new Date(selectedPlugin.installed_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {selectedPlugin.runtime_info.last_error && (
                    <div>
                      <label className="block text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                        Last Error
                      </label>
                      <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-apple">
                        {selectedPlugin.runtime_info.last_error}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <Button
                      variant="outline"
                      onClick={() => togglePlugin(selectedPlugin.id, !selectedPlugin.enabled)}
                      className="w-full"
                    >
                      {selectedPlugin.enabled ? 'Disable' : 'Enable'} Plugin
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => uninstallPlugin(selectedPlugin.id)}
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Uninstall Plugin
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-apple border border-gray-200 dark:border-gray-700 p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-apple flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  Select a plugin to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Install Plugin Dialog */}
      <AnimatePresence>
        {showInstallDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowInstallDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-900 rounded-apple shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Install Plugin
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Plugin File
                  </label>
                  <input
                    type="file"
                    accept=".zip,.tar.gz,.plugin"
                    onChange={(e) => setInstallFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Supported formats: .zip, .tar.gz, .plugin
                  </p>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-apple p-3">
                  <div className="flex">
                    <svg className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        Security Warning
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        Only install plugins from trusted sources. Plugins have access to your files and system.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowInstallDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInstallPlugin}
                    disabled={!installFile || isInstalling}
                    loading={isInstalling}
                    className="flex-1"
                  >
                    Install
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}