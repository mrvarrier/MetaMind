import { create } from 'zustand';
import { safeInvoke, isTauriApp } from '../utils/tauri';

export interface Collection {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  rules?: string;
  insights?: string;
  // UI-specific properties
  color?: string;
  icon?: string;
}

interface CollectionsState {
  collections: Collection[];
  selectedCollection: Collection | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadCollections: () => Promise<void>;
  createCollection: (name: string, description?: string) => Promise<Collection | null>;
  updateCollection: (id: string, updates: { name?: string; description?: string }) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  selectCollection: (collection: Collection | null) => void;
  addFileToCollection: (fileId: string, collectionId: string) => Promise<void>;
  removeFileFromCollection: (fileId: string, collectionId: string) => Promise<void>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// Default collections with UI properties
const defaultCollections: Collection[] = [
  {
    id: 'default-documents',
    name: 'Documents',
    description: 'All document files from monitored folders',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    file_count: 0,
    color: 'blue',
    icon: '📄',
  },
  {
    id: 'default-images',
    name: 'Images',
    description: 'Photos and image files',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    file_count: 0,
    color: 'green',
    icon: '🖼️',
  },
  {
    id: 'default-code',
    name: 'Code',
    description: 'Source code and programming files',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    file_count: 0,
    color: 'purple',
    icon: '💻',
  }
];

// Icon and color mappings for collections
const getCollectionIcon = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('document')) return '📄';
  if (lowerName.includes('image') || lowerName.includes('photo')) return '🖼️';
  if (lowerName.includes('code') || lowerName.includes('programming')) return '💻';
  if (lowerName.includes('video')) return '🎥';
  if (lowerName.includes('audio') || lowerName.includes('music')) return '🎵';
  if (lowerName.includes('archive') || lowerName.includes('zip')) return '📦';
  return '📁';
};

const getCollectionColor = (index: number): string => {
  const colors = ['blue', 'green', 'purple', 'gray', 'indigo', 'pink', 'yellow', 'red'];
  return colors[index % colors.length];
};

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  selectedCollection: null,
  isLoading: false,
  error: null,

  loadCollections: async () => {
    try {
      set({ isLoading: true, error: null });
      
      let collections: Collection[] = [];
      
      if (isTauriApp()) {
        try {
          const backendCollections = await safeInvoke<Collection[]>('get_collections');
          collections = backendCollections || [];
          
          // Add UI properties to backend collections
          collections = collections.map((collection, index) => ({
            ...collection,
            color: collection.color || getCollectionColor(index),
            icon: collection.icon || getCollectionIcon(collection.name),
          }));
          
          // If no collections exist in backend, create default ones
          if (collections.length === 0) {
            console.log('No collections found, creating default collections...');
            for (const defaultCollection of defaultCollections) {
              try {
                const created = await safeInvoke<Collection>('create_collection', {
                  name: defaultCollection.name,
                  description: defaultCollection.description,
                });
                if (created) {
                  collections.push({
                    ...created,
                    color: defaultCollection.color,
                    icon: defaultCollection.icon,
                  });
                }
              } catch (error) {
                console.error('Failed to create default collection:', defaultCollection.name, error);
              }
            }
          }
        } catch (error) {
          console.error('Failed to load collections from backend:', error);
          // Fallback to default collections in development
          collections = defaultCollections;
        }
      } else {
        // Web mode - use default collections
        console.log('Running in web mode - using default collections');
        collections = defaultCollections;
      }
      
      set({ collections, isLoading: false });
    } catch (error) {
      console.error('Failed to load collections:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load collections',
        isLoading: false,
        collections: defaultCollections // Fallback to defaults
      });
    }
  },

  createCollection: async (name: string, description?: string) => {
    try {
      set({ isLoading: true, error: null });
      
      let newCollection: Collection | null = null;
      
      if (isTauriApp()) {
        try {
          newCollection = await safeInvoke<Collection>('create_collection', {
            name,
            description,
          });
          
          if (newCollection) {
            // Add UI properties
            newCollection = {
              ...newCollection,
              color: getCollectionColor(get().collections.length),
              icon: getCollectionIcon(name),
            };
          }
        } catch (error) {
          console.error('Failed to create collection in backend:', error);
          throw error;
        }
      } else {
        // Web mode - create mock collection
        newCollection = {
          id: `mock-${Date.now()}`,
          name,
          description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          file_count: 0,
          color: getCollectionColor(get().collections.length),
          icon: getCollectionIcon(name),
        };
      }
      
      if (newCollection) {
        set(state => ({
          collections: [...state.collections, newCollection!],
          isLoading: false,
        }));
      }
      
      return newCollection;
    } catch (error) {
      console.error('Failed to create collection:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create collection',
        isLoading: false
      });
      return null;
    }
  },

  updateCollection: async (id: string, updates: { name?: string; description?: string }) => {
    try {
      set({ isLoading: true, error: null });
      
      if (isTauriApp()) {
        await safeInvoke('update_collection', {
          id,
          name: updates.name,
          description: updates.description,
        });
      }
      
      set(state => ({
        collections: state.collections.map(collection =>
          collection.id === id
            ? { 
                ...collection, 
                ...updates, 
                updated_at: new Date().toISOString(),
                icon: updates.name ? getCollectionIcon(updates.name) : collection.icon 
              }
            : collection
        ),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to update collection:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update collection',
        isLoading: false
      });
    }
  },

  deleteCollection: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      
      if (isTauriApp()) {
        await safeInvoke('delete_collection', { id });
      }
      
      set(state => ({
        collections: state.collections.filter(collection => collection.id !== id),
        selectedCollection: state.selectedCollection?.id === id ? null : state.selectedCollection,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to delete collection:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete collection',
        isLoading: false
      });
    }
  },

  selectCollection: (collection: Collection | null) => {
    set({ selectedCollection: collection });
  },

  addFileToCollection: async (fileId: string, collectionId: string) => {
    try {
      if (isTauriApp()) {
        await safeInvoke('add_file_to_collection', { fileId, collectionId });
      }
      
      // Update collection file count
      set(state => ({
        collections: state.collections.map(collection =>
          collection.id === collectionId
            ? { ...collection, file_count: collection.file_count + 1, updated_at: new Date().toISOString() }
            : collection
        ),
      }));
    } catch (error) {
      console.error('Failed to add file to collection:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to add file to collection' });
    }
  },

  removeFileFromCollection: async (fileId: string, collectionId: string) => {
    try {
      if (isTauriApp()) {
        await safeInvoke('remove_file_from_collection', { fileId, collectionId });
      }
      
      // Update collection file count
      set(state => ({
        collections: state.collections.map(collection =>
          collection.id === collectionId
            ? { ...collection, file_count: Math.max(0, collection.file_count - 1), updated_at: new Date().toISOString() }
            : collection
        ),
      }));
    } catch (error) {
      console.error('Failed to remove file from collection:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to remove file from collection' });
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));