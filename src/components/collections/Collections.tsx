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
  const [autoRefresh, setAutoRefresh] = useState(false); // Temporarily disable auto-refresh


  // Load monitored locations on component mount
  useEffect(() => {
    loadMonitoredLocations();
  }, []);

  // Set up auto-refresh when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Check if there are any pending or processing files
      const hasActiveProcessing = monitoredLocations.some(location => 
        location.pendingCount > 0 || location.status === 'active'
      );
      
      if (hasActiveProcessing || monitoredLocations.length === 0) {
        loadMonitoredLocations();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, monitoredLocations]);

  const loadMonitoredLocations = async () => {
    try {
      console.log('Loading monitored locations...');
      setIsLoading(true);
      setError(null);
      
      console.log('Onboarding state:', onboardingState);
      
      // Check if selectedFolders exists and is an array
      if (!onboardingState.selectedFolders || !Array.isArray(onboardingState.selectedFolders)) {
        console.log('No selected folders found');
        setMonitoredLocations([]);
        setIsLoading(false);
        return;
      }
      
      // Convert onboarding selected folders to monitored locations
      const locations: MonitoredLocation[] = await Promise.all(
        onboardingState.selectedFolders.map(async (folder, index) => {
          // Handle both string paths (legacy) and objects with path/type
          const folderPath = typeof folder === 'string' ? folder : folder.path;
          const folderType = typeof folder === 'string' ? 'folder' : folder.type;
          
          const pathParts = folderPath.split('/');
          const name = pathParts[pathParts.length - 1] || folderPath;
          
          // Get real processing statistics for this specific location
          let filesCount = 0;
          let processedCount = 0;
          let pendingCount = 0;
          let errorCount = 0;
          let status: 'active' | 'paused' | 'error' = 'active';
          
          try {
            if (isTauriApp()) {
              // Get location-specific statistics from backend
              const locationStats = await safeInvoke('get_location_stats', { path: folderPath });
              if (locationStats) {
                filesCount = locationStats.total_files || 0;
                processedCount = locationStats.processed_files || 0;
                pendingCount = locationStats.pending_files || 0;
                errorCount = locationStats.error_files || 0;
              }
              
              // Set status based on whether there are any errors
              if (errorCount > 0) {
                status = 'error';
              } else {
                status = 'active';
              }
            } else {
              // Web mode - use some realistic mock data
              filesCount = Math.floor(Math.random() * 50) + 10;
              processedCount = Math.floor(filesCount * 0.7);
              pendingCount = filesCount - processedCount - Math.floor(Math.random() * 3);
              errorCount = Math.max(0, filesCount - processedCount - pendingCount);
            }
          } catch (error) {
            console.error('Error getting location statistics:', error);
            status = 'error';
            errorCount = 1;
          }
          
          return {
            id: `location-${index}`,
            path: folderPath,
            type: folderType,
            name,
            addedAt: new Date().toISOString(),
            status,
            filesCount,
            processedCount,
            pendingCount,
            errorCount,
            lastScan: new Date().toISOString(),
          };
        })
      );
      
      console.log('Found locations:', locations);
      setMonitoredLocations(locations);
    } catch (error) {
      console.error('Failed to load monitored locations:', error);
      console.error('Error details:', error);
      setError(`Failed to load monitored locations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMonitoredLocations([]); // Set empty array on error
    } finally {
      console.log('Finished loading, setting isLoading to false');
      setIsLoading(false);
    }
  };

  const addNewFolder = async () => {
    try {
      setError(null);
      
      if (isTauriApp()) {
        const selected = await open({
          directory: true,
          multiple: true,
          title: "Select folders to monitor"
        });
        
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          const newFolders = paths.map(path => ({ path, type: 'folder' as const }));
          
          // Update app store first
          const updatedFolders = [...onboardingState.selectedFolders, ...newFolders];
          updateOnboardingState({
            selectedFolders: updatedFolders
          });
          
          // Immediately update UI with new locations (optimistic update)
          const newLocations = newFolders.map((folder, index) => {
            const pathParts = folder.path.split('/');
            const name = pathParts[pathParts.length - 1] || folder.path;
            return {
              id: `location-new-${Date.now()}-${index}`,
              path: folder.path,
              type: folder.type,
              name,
              addedAt: new Date().toISOString(),
              status: 'active' as const,
              filesCount: 0,
              processedCount: 0,
              pendingCount: 0,
              errorCount: 0,
              lastScan: new Date().toISOString(),
            };
          });
          
          setMonitoredLocations(prev => [...prev, ...newLocations]);
          
          // Start monitoring in background
          for (const folder of newFolders) {
            try {
              await safeInvoke('start_file_monitoring', { paths: [folder.path] });
              console.log('Started monitoring:', folder.path);
              
              // Trigger initial scan
              await safeInvoke('scan_directory', { path: folder.path });
              console.log('Initial scan completed for:', folder.path);
            } catch (monitorError) {
              console.error('Failed to start monitoring:', monitorError);
              setError(`Failed to start monitoring ${folder.path}`);
            }
          }
          
          // Reload to get real statistics after a short delay
          setTimeout(() => {
            loadMonitoredLocations();
          }, 3000);
        }
      } else {
        // Web mode - simulate adding a folder
        const mockFolder = {
          path: `/Users/Documents/New Folder ${Date.now()}`,
          type: 'folder' as const
        };
        
        const updatedFolders = [...onboardingState.selectedFolders, mockFolder];
        updateOnboardingState({
          selectedFolders: updatedFolders
        });
        
        // Immediately show the new location
        const pathParts = mockFolder.path.split('/');
        const name = pathParts[pathParts.length - 1] || mockFolder.path;
        const newLocation = {
          id: `location-new-${Date.now()}`,
          path: mockFolder.path,
          type: mockFolder.type,
          name,
          addedAt: new Date().toISOString(),
          status: 'active' as const,
          filesCount: Math.floor(Math.random() * 30) + 5,
          processedCount: 0,
          pendingCount: Math.floor(Math.random() * 10),
          errorCount: 0,
          lastScan: new Date().toISOString(),
        };
        
        setMonitoredLocations(prev => [...prev, newLocation]);
      }
    } catch (error) {
      console.error('Error adding location:', error);
      setError('Failed to add location');
    }
  };

  const addNewFile = async () => {
    try {
      setError(null);
      
      if (isTauriApp()) {
        const selected = await open({
          directory: false,
          multiple: true,
          title: "Select files to monitor"
        });
        
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          const newFiles = paths.map(path => ({ path, type: 'file' as const }));
          
          // Update app store first
          const updatedFolders = [...onboardingState.selectedFolders, ...newFiles];
          updateOnboardingState({
            selectedFolders: updatedFolders
          });
          
          // Immediately update UI with new locations (optimistic update)
          const newLocations = newFiles.map((file, index) => {
            const pathParts = file.path.split('/');
            const name = pathParts[pathParts.length - 1] || file.path;
            return {
              id: `location-new-${Date.now()}-${index}`,
              path: file.path,
              type: file.type,
              name,
              addedAt: new Date().toISOString(),
              status: 'active' as const,
              filesCount: 1, // Single file
              processedCount: 0,
              pendingCount: 1,
              errorCount: 0,
              lastScan: new Date().toISOString(),
            };
          });
          
          setMonitoredLocations(prev => [...prev, ...newLocations]);
          
          // Start monitoring individual files
          for (const file of newFiles) {
            try {
              // For individual files, we don't need to start file monitoring,
              // just trigger processing directly
              console.log('Processing file:', file.path);
              await safeInvoke('scan_directory', { path: file.path });
              console.log('Successfully processed file:', file.path);
            } catch (monitorError) {
              console.error('Failed to process file:', file.path, monitorError);
              
              // Provide more specific error message based on the error
              let errorMessage = `Failed to process file: ${file.path}`;
              if (typeof monitorError === 'string') {
                if (monitorError.includes('does not exist')) {
                  errorMessage = `File not found: ${file.path}`;
                } else if (monitorError.includes('permission denied')) {
                  errorMessage = `Permission denied: ${file.path}`;
                } else if (monitorError.includes('already exists')) {
                  errorMessage = `File already being monitored: ${file.path}`;
                } else {
                  errorMessage = `Error processing ${file.path}: ${monitorError}`;
                }
              }
              
              setError(errorMessage);
              // Don't break the loop, continue with other files
            }
          }
          
          // Reload to get real statistics after a short delay
          setTimeout(() => {
            loadMonitoredLocations();
          }, 3000);
        }
      } else {
        // Web mode - simulate adding a file
        const mockFile = {
          path: `/Users/Documents/sample-file-${Date.now()}.pdf`,
          type: 'file' as const
        };
        
        const updatedFolders = [...onboardingState.selectedFolders, mockFile];
        updateOnboardingState({
          selectedFolders: updatedFolders
        });
        
        // Immediately show the new location
        const pathParts = mockFile.path.split('/');
        const name = pathParts[pathParts.length - 1] || mockFile.path;
        const newLocation = {
          id: `location-new-${Date.now()}`,
          path: mockFile.path,
          type: mockFile.type,
          name,
          addedAt: new Date().toISOString(),
          status: 'active' as const,
          filesCount: 1,
          processedCount: 0,
          pendingCount: 1,
          errorCount: 0,
          lastScan: new Date().toISOString(),
        };
        
        setMonitoredLocations(prev => [...prev, newLocation]);
      }
    } catch (error) {
      console.error('Error adding file:', error);
      setError('Failed to add file');
    }
  };

  const removeLocation = async (locationId: string) => {
    const location = monitoredLocations.find(l => l.id === locationId);
    if (!location) return;
    
    const confirmed = confirm(
      `Stop monitoring "${location.name}"?\n\nFiles already processed will remain in the database, but no new files will be monitored from this location.`
    );
    
    if (confirmed) {
      try {
        setError(null);
        
        // Remove from UI immediately
        setMonitoredLocations(prev => prev.filter(l => l.id !== locationId));
        
        // Remove from app store
        const updatedFolders = onboardingState.selectedFolders.filter(folder => {
          const folderPath = typeof folder === 'string' ? folder : folder.path;
          return folderPath !== location.path;
        });
        updateOnboardingState({ selectedFolders: updatedFolders });
        
        // TODO: Stop monitoring in backend when that functionality is implemented
        if (isTauriApp()) {
          console.log('Stopped monitoring location:', location.path);
          // await safeInvoke('stop_monitoring', { path: location.path });
        }
        
        console.log(`Removed monitoring for: ${location.path}`);
      } catch (error) {
        console.error('Failed to remove location:', error);
        setError('Failed to remove location');
        // Reload to restore state
        loadMonitoredLocations();
      }
    }
  };

  const toggleLocationStatus = async (locationId: string) => {
    const location = monitoredLocations.find(l => l.id === locationId);
    if (!location) return;
    
    try {
      const newStatus = location.status === 'active' ? 'paused' : 'active';
      
      // Update UI immediately for responsiveness
      setMonitoredLocations(prev => 
        prev.map(l => l.id === locationId ? { ...l, status: newStatus } : l)
      );
      
      // TODO: Implement pause/resume monitoring in backend
      // For now, just simulate the action
      console.log(`${newStatus === 'paused' ? 'Paused' : 'Resumed'} monitoring for:`, location.path);
      
      if (isTauriApp()) {
        // In the future, implement backend pause/resume calls
        // await safeInvoke(newStatus === 'paused' ? 'pause_monitoring' : 'resume_monitoring', { path: location.path });
      }
    } catch (error) {
      console.error('Failed to toggle location status:', error);
      setError('Failed to change monitoring status');
      // Revert the status change on error
      loadMonitoredLocations();
    }
  };

  const rescanLocation = async (locationId: string) => {
    const location = monitoredLocations.find(l => l.id === locationId);
    if (!location) return;
    
    try {
      setError(null);
      
      // Update status to show it's rescanning
      setMonitoredLocations(prev => 
        prev.map(l => l.id === locationId ? { ...l, status: 'active' as const, lastScan: new Date().toISOString() } : l)
      );
      
      if (isTauriApp()) {
        console.log('Rescanning location:', location.path);
        await safeInvoke('scan_directory', { path: location.path });
        
        // Refresh the data to get updated counts
        setTimeout(() => {
          loadMonitoredLocations();
        }, 1000); // Give backend time to process
      } else {
        // Web mode - simulate rescan with new random data
        setTimeout(() => {
          setMonitoredLocations(prev => 
            prev.map(l => l.id === locationId ? { 
              ...l, 
              filesCount: Math.floor(Math.random() * 50) + 10,
              processedCount: Math.floor(Math.random() * 40) + 5,
              pendingCount: Math.floor(Math.random() * 15),
              errorCount: Math.floor(Math.random() * 3),
              lastScan: new Date().toISOString()
            } : l)
          );
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to rescan location:', error);
      setError(`Failed to rescan: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Set status to error
      setMonitoredLocations(prev => 
        prev.map(l => l.id === locationId ? { ...l, status: 'error' as const } : l)
      );
    }
  };

  const showErrorDetails = async (locationPath: string) => {
    try {
      if (isTauriApp()) {
        const errorDetails = await safeInvoke('get_file_errors', { path: locationPath });
        
        if (errorDetails.type === 'single_file') {
          // Single file error
          const errorMessage = errorDetails.error_message || 'Unknown processing error';
          alert(`Error processing file:\n\nPath: ${errorDetails.path}\nStatus: ${errorDetails.status}\nError: ${errorMessage}\nLast attempt: ${new Date(errorDetails.last_attempt).toLocaleString()}`);
        } else if (errorDetails.type === 'directory') {
          // Directory with multiple error files
          if (errorDetails.errors && errorDetails.errors.length > 0) {
            let message = `Found ${errorDetails.error_count} error(s) in directory:\n${errorDetails.path}\n\nError files:\n`;
            
            errorDetails.errors.slice(0, 5).forEach((error: any, index: number) => {
              message += `\n${index + 1}. ${error.name}\n   Error: ${error.error_message || 'Unknown error'}\n   Last attempt: ${new Date(error.last_attempt).toLocaleString()}\n`;
            });
            
            if (errorDetails.errors.length > 5) {
              message += `\n... and ${errorDetails.errors.length - 5} more error(s)`;
            }
            
            alert(message);
          } else {
            alert(`No error files found in: ${errorDetails.path}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get error details:', error);
      alert('Failed to get error details: ' + (error instanceof Error ? error.message : 'Unknown error'));
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

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10V9a2 2 0 012-2h2a2 2 0 012 2v1.586a1 1 0 01-.293.707L12 14l-2.707-2.707A1 1 0 019 10.586V10z" />
          </svg>
        );
      case 'paused':
        return (
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
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
          
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => loadMonitoredLocations()}
              variant="outline"
              className="flex items-center space-x-2"
              disabled={isLoading}
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </Button>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
              title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
            </button>
            
            <Button 
              onClick={addNewFolder}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Add Folder</span>
            </Button>
            
            <Button 
              onClick={addNewFile}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Add File</span>
            </Button>
          </div>
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
                className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-apple-lg transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                      {location.type === 'folder' ? (
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">{location.name}</h3>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {getStatusIcon(location.status)}
                          <div className={`w-2 h-2 rounded-full ${getStatusDot(location.status)}`}></div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{location.path}</p>
                      <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`font-medium ${getStatusColor(location.status)}`}>
                          {location.status.charAt(0).toUpperCase() + location.status.slice(1)}
                        </span>
                        <span>
                          Added {new Date(location.addedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative group flex-shrink-0">
                    <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-10 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-apple-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                      <div className="p-1">
                        <button
                          onClick={() => toggleLocationStatus(location.id)}
                          className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          {location.status === 'active' ? '⏸️ Pause' : '▶️ Resume'}
                        </button>
                        <button
                          onClick={() => rescanLocation(location.id)}
                          className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          🔄 Rescan
                        </button>
                        {location.status === 'error' && (
                          <button
                            onClick={() => showErrorDetails(location.path)}
                            className="w-full px-3 py-2 text-sm text-left text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                          >
                            ⚠️ View Error
                          </button>
                        )}
                        <button
                          onClick={() => removeLocation(location.id)}
                          className="w-full px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{location.filesCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Done</div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">{location.processedCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Queue</div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{location.pendingCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Errors</div>
                    <div className="text-lg font-semibold text-red-600 dark:text-red-400">{location.errorCount}</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Processing Progress</span>
                    <span className="font-medium">
                      {location.filesCount > 0 ? Math.round((location.processedCount / location.filesCount) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${location.filesCount > 0 ? (location.processedCount / location.filesCount) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      Last scan: {new Date(location.lastScan).toLocaleString()}
                    </span>
                    {location.status === 'active' && location.pendingCount > 0 && (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        🔄 Processing...
                      </span>
                    )}
                  </div>
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
            <div className="flex items-center justify-center space-x-3">
              <Button onClick={addNewFolder}>
                Add Folder
              </Button>
              <Button onClick={addNewFile} variant="outline">
                Add File
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}