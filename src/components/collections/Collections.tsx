import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { safeInvoke, isTauriApp } from "../../utils/tauri";
import { open } from "@tauri-apps/api/dialog";

interface MonitoredLocation {
  id: string;
  path: string;
  type: 'folder' | 'file';
  name: string;
  addedAt: string;
  status: 'active' | 'paused' | 'error';
  filesCount: number;
  processedCount: number;
  pendingCount: number;
  errorCount: number;
  lastScan?: string;
}

export function Collections() {
  const { onboardingState, updateOnboardingState } = useAppStore();
  const [monitoredLocations, setMonitoredLocations] = useState<MonitoredLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Load monitored locations on component mount
  useEffect(() => {
    loadMonitoredLocations();
  }, []);

  const loadMonitoredLocations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Convert onboarding selected folders to monitored locations
      const locations: MonitoredLocation[] = onboardingState.selectedFolders.map((folder, index) => {
        const pathParts = folder.path.split('/');
        const name = pathParts[pathParts.length - 1] || folder.path;
        
        return {
          id: `location-${index}`,
          path: folder.path,
          type: folder.type,
          name,
          addedAt: new Date().toISOString(),
          status: 'active' as const,
          filesCount: Math.floor(Math.random() * 100), // Mock data for now
          processedCount: Math.floor(Math.random() * 80),
          pendingCount: Math.floor(Math.random() * 20),
          errorCount: Math.floor(Math.random() * 5),
          lastScan: new Date().toISOString(),
        };
      });
      
      setMonitoredLocations(locations);
    } catch (error) {
      console.error('Failed to load monitored locations:', error);
      setError('Failed to load monitored locations');
    } finally {
      setIsLoading(false);
    }
  };

  const addNewLocation = async () => {
    try {
      if (isTauriApp()) {
        const selected = await open({
          directory: true,
          multiple: true,
          title: "Select folders to monitor"
        });
        
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          const newFolders = paths.map(path => ({ path, type: 'folder' as const }));
          
          // Update app store
          updateOnboardingState({
            selectedFolders: [...onboardingState.selectedFolders, ...newFolders]
          });
          
          // Start monitoring
          for (const folder of newFolders) {
            await safeInvoke('start_file_monitoring', { paths: [folder.path] });
          }
          
          // Reload locations
          loadMonitoredLocations();
        }
      } else {
        // Web mode - simulate adding a folder
        const mockFolder = {
          path: `/Users/Documents/New Folder ${Date.now()}`,
          type: 'folder' as const
        };
        
        updateOnboardingState({
          selectedFolders: [...onboardingState.selectedFolders, mockFolder]
        });
        
        loadMonitoredLocations();
      }
    } catch (error) {
      console.error('Error adding location:', error);
      setError('Failed to add location');
    }
  };

  const removeLocation = async (locationId: string) => {
    if (confirm("Stop monitoring this location? Files already processed will remain in the database.")) {
      const location = monitoredLocations.find(l => l.id === locationId);
      if (location) {
        // Remove from app store
        const updatedFolders = onboardingState.selectedFolders.filter(f => f.path !== location.path);
        updateOnboardingState({ selectedFolders: updatedFolders });
        
        // TODO: Stop monitoring in backend
        
        // Reload locations
        loadMonitoredLocations();
      }
    }
  };

  const toggleLocationStatus = async (locationId: string) => {
    const location = monitoredLocations.find(l => l.id === locationId);
    if (location) {
      const newStatus = location.status === 'active' ? 'paused' : 'active';
      
      setMonitoredLocations(prev => 
        prev.map(l => l.id === locationId ? { ...l, status: newStatus } : l)
      );
      
      // TODO: Implement pause/resume monitoring in backend
    }
  };

  const rescanLocation = async (locationId: string) => {
    const location = monitoredLocations.find(l => l.id === locationId);
    if (location) {
      try {
        await safeInvoke('scan_directory', { path: location.path });
        loadMonitoredLocations(); // Refresh the data
      } catch (error) {
        console.error('Failed to rescan location:', error);
        setError('Failed to rescan location');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 dark:text-green-400';
      case 'paused': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/20';
      case 'paused': return 'bg-yellow-100 dark:bg-yellow-900/20';
      case 'error': return 'bg-red-100 dark:bg-red-900/20';
      default: return 'bg-gray-100 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monitored Locations</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Manage folders and files being monitored for AI processing
            </p>
          </div>
          
          <Button 
            onClick={addNewLocation}
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Location</span>
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-apple-lg"
          >
            <div className="flex items-center justify-between">
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}


        {/* Monitored Locations Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading monitored locations...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {monitoredLocations.map((location, index) => (
              <motion.div
                key={location.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card-notion p-6 transition-all ${getStatusBg(location.status)}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-white/20">
                      {location.type === 'folder' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{location.name}</h3>
                      <p className="text-sm opacity-75 truncate">{location.path}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(location.status)} ${getStatusBg(location.status)}`}>
                          {location.status.charAt(0).toUpperCase() + location.status.slice(1)}
                        </span>
                        <span className="text-xs opacity-60">
                          Added {new Date(location.addedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <button className="p-1 rounded hover:bg-white/20 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-apple shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        onClick={() => toggleLocationStatus(location.id)}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {location.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => rescanLocation(location.id)}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Rescan
                      </button>
                      <button
                        onClick={() => removeLocation(location.id)}
                        className="w-full px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Files</div>
                    <div className="text-lg font-semibold">{location.filesCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Processed</div>
                    <div className="text-lg font-semibold text-green-600">{location.processedCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pending</div>
                    <div className="text-lg font-semibold text-yellow-600">{location.pendingCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Errors</div>
                    <div className="text-lg font-semibold text-red-600">{location.errorCount}</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Processing Progress</span>
                    <span>{Math.round((location.processedCount / location.filesCount) * 100)}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(location.processedCount / location.filesCount) * 100}%` }}
                    />
                  </div>
                  {location.lastScan && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Last scan: {new Date(location.lastScan).toLocaleString()}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && monitoredLocations.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-apple-xl flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Locations Being Monitored
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Add folders or files to start monitoring and AI processing
            </p>
            <Button onClick={addNewLocation}>
              Add Location
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}