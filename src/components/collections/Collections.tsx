import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { Logo } from "../common/Logo";
import { useAppStore } from "../../stores/useAppStore";
import { useCollectionsStore } from "../../stores/useCollectionsStore";
import { safeInvoke, isTauriApp } from "../../utils/tauri";
import { open } from "@tauri-apps/api/dialog";

// Type definitions for collections
interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  items: CollectionItem[];
  status: 'active' | 'paused';
  totalFiles: number;
  processedFiles: number;
  pendingFiles: number;
  errorFiles: number;
}

interface CollectionItem {
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

interface LocationStats {
  total_files?: number;
  processed_files?: number;
  pending_files?: number;
  error_files?: number;
}

interface FileErrorResponse {
  type: 'single_file' | 'directory';
  path?: string;
  status?: string;
  error_message?: string;
  last_attempt?: string;
  error_count?: number;
  errors?: Array<{
    name: string;
    error_message?: string;
    last_attempt: string;
  }>;
}

// Type guard functions
function isLocationStats(obj: unknown): obj is LocationStats {
  return typeof obj === 'object' && obj !== null;
}

function isFileErrorResponse(obj: unknown): obj is FileErrorResponse {
  return typeof obj === 'object' && obj !== null && 
         'type' in obj && (obj.type === 'single_file' || obj.type === 'directory');
}

// Collection colors and icons
const COLLECTION_COLORS = [
  { name: 'Blue', value: 'blue', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/20', text: 'text-blue-600', darkText: 'dark:text-blue-400' },
  { name: 'Green', value: 'green', bg: 'bg-green-100', darkBg: 'dark:bg-green-900/20', text: 'text-green-600', darkText: 'dark:text-green-400' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/20', text: 'text-purple-600', darkText: 'dark:text-purple-400' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/20', text: 'text-orange-600', darkText: 'dark:text-orange-400' },
  { name: 'Red', value: 'red', bg: 'bg-red-100', darkBg: 'dark:bg-red-900/20', text: 'text-red-600', darkText: 'dark:text-red-400' },
  { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-100', darkBg: 'dark:bg-indigo-900/20', text: 'text-indigo-600', darkText: 'dark:text-indigo-400' },
];

const COLLECTION_ICONS = [
  '📚', '📁', '🎯', '💼', '🔬', '🎨', '📊', '🚀', '🔧', '💡', '📝', '🎵', '🎬', '📷', '🌟', '⚡'
];

export function Collections() {
  const { onboardingState } = useAppStore();
  const { 
    createCollection: storeCreateCollection,
    deleteCollection: storeDeleteCollection,
  } = useCollectionsStore();
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '', color: 'blue', icon: '📚' });

  // Load collections on component mount
  useEffect(() => {
    loadCollections();
  }, []);

  // Initialize collections from existing onboarding data
  useEffect(() => {
    if (onboardingState.selectedFolders && onboardingState.selectedFolders.length > 0 && collections.length === 0) {
      migrateFromOnboardingData();
    }
  }, [onboardingState.selectedFolders, collections]);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load collections from localStorage for UI state
      const savedCollections = localStorage.getItem('metamind-collections');
      if (savedCollections) {
        const parsedCollections = JSON.parse(savedCollections);
        setCollections(parsedCollections);
      }
      
      // Update collection statistics
      await updateCollectionStats();
    } catch (error) {
      console.error('Failed to load collections:', error);
      setError('Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const migrateFromOnboardingData = async () => {
    if (!onboardingState.selectedFolders || onboardingState.selectedFolders.length === 0) return;
    
    const defaultCollection: Collection = {
      id: 'default-collection',
      name: 'Default Collection',
      description: 'Auto-migrated from your selected folders',
      color: 'blue',
      icon: '📚',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      status: 'active',
      totalFiles: 0,
      processedFiles: 0,
      pendingFiles: 0,
      errorFiles: 0,
    };
    
    // Convert selected folders to collection items
    const items = await Promise.all(
      onboardingState.selectedFolders.map(async (folder, index) => {
        const folderPath = typeof folder === 'string' ? folder : folder.path;
        const folderType = typeof folder === 'string' ? 'folder' : folder.type;
        const pathParts = folderPath.split('/');
        const name = pathParts[pathParts.length - 1] || folderPath;
        
        // Get stats for this item
        let filesCount = 0;
        let processedCount = 0;
        let pendingCount = 0;
        let errorCount = 0;
        let status: 'active' | 'paused' | 'error' = 'active';
        
        try {
          if (isTauriApp()) {
            const statsPromise = safeInvoke('get_location_stats', { path: folderPath });
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout')), 3000);
            });
            
            const locationStats = await Promise.race([statsPromise, timeoutPromise]);
            
            if (isLocationStats(locationStats)) {
              filesCount = locationStats.total_files || 0;
              processedCount = locationStats.processed_files || 0;
              pendingCount = locationStats.pending_files || 0;
              errorCount = locationStats.error_files || 0;
            }
            
            if (errorCount > 0) {
              status = 'error';
            }
          } else {
            // Mock data for web mode
            filesCount = Math.floor(Math.random() * 50) + 10;
            processedCount = Math.floor(filesCount * 0.7);
            pendingCount = filesCount - processedCount - Math.floor(Math.random() * 3);
            errorCount = Math.max(0, filesCount - processedCount - pendingCount);
          }
        } catch (error) {
          console.error('Error getting stats for', folderPath, ':', error);
          status = 'error';
          errorCount = 1;
          filesCount = 1;
          processedCount = 0;
          pendingCount = 0;
        }
        
        return {
          id: `item-${index}`,
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
    
    defaultCollection.items = items;
    defaultCollection.totalFiles = items.reduce((sum, item) => sum + item.filesCount, 0);
    defaultCollection.processedFiles = items.reduce((sum, item) => sum + item.processedCount, 0);
    defaultCollection.pendingFiles = items.reduce((sum, item) => sum + item.pendingCount, 0);
    defaultCollection.errorFiles = items.reduce((sum, item) => sum + item.errorCount, 0);
    
    setCollections([defaultCollection]);
    saveCollections([defaultCollection]);
  };

  const updateCollectionStats = async () => {
    // Update stats for all collections
    const updatedCollections = await Promise.all(
      collections.map(async (collection) => {
        const updatedItems = await Promise.all(
          collection.items.map(async (item) => {
            try {
              if (isTauriApp()) {
                const statsPromise = safeInvoke('get_location_stats', { path: item.path });
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Timeout')), 3000);
                });
                
                const locationStats = await Promise.race([statsPromise, timeoutPromise]);
                
                if (isLocationStats(locationStats)) {
                  return {
                    ...item,
                    filesCount: locationStats.total_files || 0,
                    processedCount: locationStats.processed_files || 0,
                    pendingCount: locationStats.pending_files || 0,
                    errorCount: locationStats.error_files || 0,
                    status: (locationStats.error_files || 0) > 0 ? 'error' as const : 'active' as const,
                    lastScan: new Date().toISOString(),
                  };
                }
              }
            } catch (error) {
              console.error('Error updating stats for', item.path, ':', error);
            }
            return item;
          })
        );
        
        return {
          ...collection,
          items: updatedItems,
          totalFiles: updatedItems.reduce((sum, item) => sum + item.filesCount, 0),
          processedFiles: updatedItems.reduce((sum, item) => sum + item.processedCount, 0),
          pendingFiles: updatedItems.reduce((sum, item) => sum + item.pendingCount, 0),
          errorFiles: updatedItems.reduce((sum, item) => sum + item.errorCount, 0),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    
    setCollections(updatedCollections);
    saveCollections(updatedCollections);
  };
  
  const saveCollections = (collectionsToSave: Collection[]) => {
    localStorage.setItem('metamind-collections', JSON.stringify(collectionsToSave));
  };
  
  const createCollection = async () => {
    if (!newCollection.name.trim()) {
      setError('Collection name is required');
      return;
    }
    
    const collection: Collection = {
      id: `collection-${Date.now()}`,
      name: newCollection.name.trim(),
      description: newCollection.description?.trim() || '',
      color: newCollection.color,
      icon: newCollection.icon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      status: 'active',
      totalFiles: 0,
      processedFiles: 0,
      pendingFiles: 0,
      errorFiles: 0,
    };
    
    // Update local state
    const updatedCollections = [...collections, collection];
    setCollections(updatedCollections);
    saveCollections(updatedCollections);
    
    // Also create in backend
    try {
      await storeCreateCollection(
        newCollection.name.trim(),
        newCollection.description?.trim() || undefined
      );
    } catch (error) {
      console.error('Failed to create collection in backend:', error);
      // Don't rollback local state - user can still see the collection
    }
    
    setShowCreateModal(false);
    setNewCollection({ name: '', description: '', color: 'blue', icon: '📚' });
  };
  
  const deleteCollection = async (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    
    const confirmed = confirm(
      `Delete "${collection.name}"?\n\nThis will remove the collection but files will remain in the system.`
    );
    
    if (confirmed) {
      // Update local state immediately for responsive UI
      const updatedCollections = collections.filter(c => c.id !== collectionId);
      setCollections(updatedCollections);
      saveCollections(updatedCollections);
      
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null);
      }
      
      // Also delete from backend
      try {
        await storeDeleteCollection(collectionId);
        console.log('Collection deleted from backend successfully');
      } catch (error) {
        console.error('Failed to delete collection from backend:', error);
        // The UI already updated, so user sees the delete worked
        // Could show a warning toast that sync failed
      }
    }
  };

  const addItemToCollection = async (collectionId: string, type: 'folder' | 'file') => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    
    try {
      setError(null);
      
      if (isTauriApp()) {
        const selected = await open({
          directory: type === 'folder',
          multiple: true,
          title: `Select ${type}s to add to ${collection.name}`
        });
        
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          const newItems: CollectionItem[] = [];
          
          for (const path of paths) {
            const pathParts = path.split('/');
            const name = pathParts[pathParts.length - 1] || path;
            
            const item: CollectionItem = {
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              path,
              type,
              name,
              addedAt: new Date().toISOString(),
              status: 'active',
              filesCount: type === 'file' ? 1 : 0,
              processedCount: 0,
              pendingCount: type === 'file' ? 1 : 0,
              errorCount: 0,
              lastScan: new Date().toISOString(),
            };
            
            newItems.push(item);
            
            // Start monitoring in background
            try {
              if (type === 'folder') {
                await safeInvoke('start_file_monitoring', { paths: [path] });
                await safeInvoke('scan_directory', { path });
              } else {
                await safeInvoke('scan_directory', { path });
              }
            } catch (monitorError) {
              console.error('Failed to start monitoring:', monitorError);
              setError(`Failed to start monitoring ${path}`);
            }
          }
          
          // Update collection with new items
          const updatedCollection = {
            ...collection,
            items: [...collection.items, ...newItems],
            updatedAt: new Date().toISOString(),
          };
          
          const updatedCollections = collections.map(c => 
            c.id === collectionId ? updatedCollection : c
          );
          
          setCollections(updatedCollections);
          saveCollections(updatedCollections);
          
          // Update selected collection if it's currently selected
          if (selectedCollection?.id === collectionId) {
            setSelectedCollection(updatedCollection);
          }
          
          // Update stats after a delay
          setTimeout(() => {
            updateCollectionStats();
          }, 3000);
        }
      } else {
        // Web mode - simulate adding item
        const mockPath = type === 'folder' 
          ? `/Users/Documents/New Folder ${Date.now()}`
          : `/Users/Documents/sample-file-${Date.now()}.pdf`;
        
        const pathParts = mockPath.split('/');
        const name = pathParts[pathParts.length - 1] || mockPath;
        
        const item: CollectionItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          path: mockPath,
          type,
          name,
          addedAt: new Date().toISOString(),
          status: 'active',
          filesCount: type === 'file' ? 1 : Math.floor(Math.random() * 30) + 5,
          processedCount: 0,
          pendingCount: type === 'file' ? 1 : Math.floor(Math.random() * 10),
          errorCount: 0,
          lastScan: new Date().toISOString(),
        };
        
        const updatedCollection = {
          ...collection,
          items: [...collection.items, item],
          updatedAt: new Date().toISOString(),
        };
        
        const updatedCollections = collections.map(c => 
          c.id === collectionId ? updatedCollection : c
        );
        
        setCollections(updatedCollections);
        saveCollections(updatedCollections);
        
        if (selectedCollection?.id === collectionId) {
          setSelectedCollection(updatedCollection);
        }
      }
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add item');
    }
  };

  const removeItemFromCollection = async (collectionId: string, itemId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    const item = collection?.items.find(i => i.id === itemId);
    if (!collection || !item) return;
    
    const confirmed = confirm(
      `Remove "${item.name}" from "${collection.name}"?\n\nFiles will remain in the system but won't be monitored through this collection.`
    );
    
    if (confirmed) {
      const updatedCollection = {
        ...collection,
        items: collection.items.filter(i => i.id !== itemId),
        updatedAt: new Date().toISOString(),
      };
      
      const updatedCollections = collections.map(c => 
        c.id === collectionId ? updatedCollection : c
      );
      
      setCollections(updatedCollections);
      saveCollections(updatedCollections);
      
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(updatedCollection);
      }
    }
  };

  const rescanItem = async (collectionId: string, itemId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    const item = collection?.items.find(i => i.id === itemId);
    if (!collection || !item) return;
    
    try {
      setError(null);
      
      // Update item status to show it's rescanning
      const updatedCollection = {
        ...collection,
        items: collection.items.map(i => 
          i.id === itemId ? { ...i, status: 'active' as const, lastScan: new Date().toISOString() } : i
        ),
        updatedAt: new Date().toISOString(),
      };
      
      const updatedCollections = collections.map(c => 
        c.id === collectionId ? updatedCollection : c
      );
      
      setCollections(updatedCollections);
      saveCollections(updatedCollections);
      
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(updatedCollection);
      }
      
      if (isTauriApp()) {
        console.log('Rescanning item:', item.path);
        await safeInvoke('scan_directory', { path: item.path });
        
        // Refresh the data to get updated counts
        setTimeout(() => {
          updateCollectionStats();
        }, 1000);
      } else {
        // Web mode - simulate rescan with new random data
        setTimeout(() => {
          const newUpdatedCollection = {
            ...updatedCollection,
            items: updatedCollection.items.map(i => 
              i.id === itemId ? { 
                ...i, 
                filesCount: i.type === 'file' ? 1 : Math.floor(Math.random() * 50) + 10,
                processedCount: Math.floor(Math.random() * 40) + 5,
                pendingCount: Math.floor(Math.random() * 15),
                errorCount: Math.floor(Math.random() * 3),
                lastScan: new Date().toISOString()
              } : i
            ),
          };
          
          const finalUpdatedCollections = collections.map(c => 
            c.id === collectionId ? newUpdatedCollection : c
          );
          
          setCollections(finalUpdatedCollections);
          saveCollections(finalUpdatedCollections);
          
          if (selectedCollection?.id === collectionId) {
            setSelectedCollection(newUpdatedCollection);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to rescan item:', error);
      setError(`Failed to rescan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const toggleCollectionStatus = async (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    
    try {
      const newStatus: 'active' | 'paused' = collection.status === 'active' ? 'paused' : 'active';
      
      const updatedCollection = {
        ...collection,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      
      const updatedCollections = collections.map(c => 
        c.id === collectionId ? updatedCollection : c
      );
      
      setCollections(updatedCollections);
      saveCollections(updatedCollections);
      
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(updatedCollection);
      }
      
      console.log(`${newStatus === 'paused' ? 'Paused' : 'Resumed'} collection:`, collection.name);
    } catch (error) {
      console.error('Failed to toggle collection status:', error);
      setError('Failed to change collection status');
    }
  };

  const getColorClasses = (color: string) => {
    const colorObj = COLLECTION_COLORS.find(c => c.value === color) || COLLECTION_COLORS[0];
    return colorObj;
  };

  // Show error details for items
  const showErrorDetails = async (itemPath: string) => {
    try {
      if (isTauriApp()) {
        const response = await safeInvoke('get_file_errors', { path: itemPath });
        
        if (!isFileErrorResponse(response)) {
          alert('Invalid error details response');
          return;
        }
        
        const errorDetails = response;
        
        if (errorDetails.type === 'single_file') {
          const errorMessage = errorDetails.error_message || 'Unknown processing error';
          const lastAttempt = errorDetails.last_attempt ? new Date(errorDetails.last_attempt).toLocaleString() : 'Unknown';
          alert(`Error processing file:\n\nPath: ${errorDetails.path}\nStatus: ${errorDetails.status}\nError: ${errorMessage}\nLast attempt: ${lastAttempt}`);
        } else if (errorDetails.type === 'directory') {
          if (errorDetails.errors && errorDetails.errors.length > 0) {
            let message = `Found ${errorDetails.error_count} error(s) in directory:\n${errorDetails.path}\n\nError files:\n`;
            
            errorDetails.errors.slice(0, 5).forEach((error, index: number) => {
              const lastAttempt = error.last_attempt ? new Date(error.last_attempt).toLocaleString() : 'Unknown';
              message += `\n${index + 1}. ${error.name}\n   Error: ${error.error_message || 'Unknown error'}\n   Last attempt: ${lastAttempt}\n`;
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

  const reprocessErrors = async () => {
    try {
      setError(null);
      
      if (isTauriApp()) {
        console.log('Reprocessing error files...');
        await safeInvoke('reprocess_error_files');
        alert('Started reprocessing error files. Check progress in a few moments.');
        
        setTimeout(() => {
          updateCollectionStats();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to reprocess error files:', error);
      setError(`Failed to reprocess error files: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Render Create Collection Modal
  const CreateCollectionModal = () => {
    if (!showCreateModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-apple-lg p-6 w-full max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Create New Collection
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Collection Name
              </label>
              <input
                type="text"
                value={newCollection.name}
                onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                placeholder="Enter collection name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={newCollection.description}
                onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                placeholder="Enter collection description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="flex space-x-2">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewCollection({ ...newCollection, color: color.value })}
                    className={`w-8 h-8 rounded-full ${color.bg} ${color.darkBg} border-2 ${
                      newCollection.color === color.value ? 'border-gray-400' : 'border-transparent'
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icon
              </label>
              <div className="grid grid-cols-8 gap-2">
                {COLLECTION_ICONS.map((icon, index) => (
                  <button
                    key={index}
                    onClick={() => setNewCollection({ ...newCollection, icon })}
                    className={`w-8 h-8 text-lg flex items-center justify-center rounded border-2 ${
                      newCollection.icon === icon ? 'border-gray-400' : 'border-transparent'
                    } hover:border-gray-300`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setNewCollection({ name: '', description: '', color: 'blue', icon: '📚' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={createCollection}>
              Create Collection
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 min-h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Logo size="lg" variant="icon" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Collections</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Organize your files and folders into knowledge bases for better management
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {selectedCollection && (
              <Button
                onClick={() => setSelectedCollection(null)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Collections</span>
              </Button>
            )}
            
            <Button 
              onClick={() => updateCollectionStats()}
              variant="outline"
              className="flex items-center space-x-2"
              disabled={isLoading}
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </Button>
            
            {selectedCollection ? (
              <>
                <Button 
                  onClick={() => addItemToCollection(selectedCollection.id, 'folder')}
                  className="flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Add Folder</span>
                </Button>
                
                <Button 
                  onClick={() => addItemToCollection(selectedCollection.id, 'file')}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Add File</span>
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>New Collection</span>
              </Button>
            )}
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

        {/* Collections or Collection Detail View */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading collections...</span>
          </div>
        ) : selectedCollection ? (
          /* Collection Detail View */
          <div>
            {/* Collection Header */}
            <div className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`w-16 h-16 ${getColorClasses(selectedCollection.color).bg} ${getColorClasses(selectedCollection.color).darkBg} rounded-apple-lg flex items-center justify-center`}>
                    <span className="text-2xl">{selectedCollection.icon}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCollection.name}</h2>
                    {selectedCollection.description && (
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{selectedCollection.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className={`font-medium ${getStatusColor(selectedCollection.status)}`}>
                        {selectedCollection.status.charAt(0).toUpperCase() + selectedCollection.status.slice(1)}
                      </span>
                      <span>Created {new Date(selectedCollection.createdAt).toLocaleDateString()}</span>
                      <span>{selectedCollection.items.length} items</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleCollectionStatus(selectedCollection.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={selectedCollection.status === 'active' ? 'Pause Collection' : 'Resume Collection'}
                  >
                    {selectedCollection.status === 'active' ? '⏸️' : '▶️'}
                  </button>
                  <button
                    onClick={() => deleteCollection(selectedCollection.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                    title="Delete Collection"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {/* Collection Stats */}
              <div className="grid grid-cols-4 gap-6 mt-6">
                <div className="text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Files</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCollection.totalFiles}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Processed</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedCollection.processedFiles}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pending</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedCollection.pendingFiles}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Errors</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedCollection.errorFiles}</div>
                </div>
              </div>
            </div>
            
            {/* Collection Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {selectedCollection.items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-apple-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                        {item.type === 'folder' ? (
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
                          <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">{item.name}</h3>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            {getStatusIcon(item.status)}
                            <div className={`w-2 h-2 rounded-full ${getStatusDot(item.status)}`}></div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{item.path}</p>
                        <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`font-medium ${getStatusColor(item.status)}`}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </span>
                          <span>
                            Added {new Date(item.addedAt).toLocaleDateString()}
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
                      
                      <div className="absolute right-0 top-10 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-apple-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                        <div className="p-1">
                          <button
                            onClick={() => rescanItem(selectedCollection.id, item.id)}
                            className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            🔄 Rescan
                          </button>
                          {item.status === 'error' && (
                            <>
                              <button
                                onClick={() => showErrorDetails(item.path)}
                                className="w-full px-3 py-2 text-sm text-left text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                              >
                                ⚠️ View Error
                              </button>
                              <button
                                onClick={() => reprocessErrors()}
                                className="w-full px-3 py-2 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              >
                                🔄 Retry Errors
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => removeItemFromCollection(selectedCollection.id, item.id)}
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
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">{item.filesCount}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Done</div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">{item.processedCount}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Queue</div>
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{item.pendingCount}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Errors</div>
                      <div className="text-lg font-semibold text-red-600 dark:text-red-400">{item.errorCount}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Processing Progress</span>
                      <span className="font-medium">
                        {item.filesCount > 0 ? Math.round((item.processedCount / item.filesCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ 
                          width: `${item.filesCount > 0 ? (item.processedCount / item.filesCount) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Last scan: {item.lastScan ? new Date(item.lastScan).toLocaleString() : 'Never'}
                      </span>
                      {item.status === 'active' && item.pendingCount > 0 && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          🔄 Processing...
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Empty state for collection items */}
            {selectedCollection.items.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-apple-lg flex items-center justify-center">
                  <span className="text-2xl">{selectedCollection.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No Items in Collection
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Add folders or files to start organizing your knowledge base
                </p>
                <div className="flex items-center justify-center space-x-3">
                  <Button onClick={() => addItemToCollection(selectedCollection.id, 'folder')}>
                    Add Folder
                  </Button>
                  <Button onClick={() => addItemToCollection(selectedCollection.id, 'file')} variant="outline">
                    Add File
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Collections Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection, index) => {
              const colorClasses = getColorClasses(collection.color);
              return (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-apple-lg transition-all cursor-pointer"
                  onClick={() => setSelectedCollection(collection)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 ${colorClasses.bg} ${colorClasses.darkBg} rounded-apple-lg flex items-center justify-center`}>
                      <span className="text-xl">{collection.icon}</span>
                    </div>
                    <div className="relative group">
                      <button 
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      
                      <div className="absolute right-0 top-10 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-apple-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                        <div className="p-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollectionStatus(collection.id);
                            }}
                            className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            {collection.status === 'active' ? '⏸️ Pause' : '▶️ Resume'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCollection(collection.id);
                            }}
                            className="w-full px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">{collection.name}</h3>
                    {collection.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{collection.description}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Items</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">{collection.items.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Files</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">{collection.totalFiles}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className={`font-medium ${getStatusColor(collection.status)}`}>
                      {collection.status.charAt(0).toUpperCase() + collection.status.slice(1)}
                    </span>
                    <span>Updated {new Date(collection.updatedAt).toLocaleDateString()}</span>
                  </div>
                  
                  {collection.totalFiles > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round((collection.processedFiles / collection.totalFiles) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-500 ease-out ${colorClasses.text.replace('text-', 'bg-')}`}
                          style={{ 
                            width: `${(collection.processedFiles / collection.totalFiles) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty State for Collections */}
        {!isLoading && !selectedCollection && collections.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-apple-xl flex items-center justify-center">
              <span className="text-4xl">📚</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Collections Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first collection to organize your files and folders into knowledge bases
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create First Collection
            </Button>
          </motion.div>
        )}
        
        {/* Create Collection Modal */}
        <CreateCollectionModal />
      </div>
    </div>
  );
}