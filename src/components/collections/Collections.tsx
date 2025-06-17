import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useCollectionsStore } from "../../stores/useCollectionsStore";

export function Collections() {
  const {
    collections,
    isLoading,
    error,
    loadCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    selectCollection,
    setError
  } = useCollectionsStore();

  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [editingCollection, setEditingCollection] = useState<{ id: string; name: string; description: string } | null>(null);

  // Load collections on component mount
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleCreateCollection = async () => {
    if (newCollectionName.trim()) {
      const newCollection = await createCollection(
        newCollectionName.trim(),
        newCollectionDescription.trim() || undefined
      );
      
      if (newCollection) {
        setNewCollectionName("");
        setNewCollectionDescription("");
        setShowCreateCollection(false);
      }
    }
  };

  const handleEditCollection = (collection: any) => {
    setEditingCollection({
      id: collection.id,
      name: collection.name,
      description: collection.description || ""
    });
  };

  const handleUpdateCollection = async () => {
    if (editingCollection && editingCollection.name.trim()) {
      await updateCollection(editingCollection.id, {
        name: editingCollection.name.trim(),
        description: editingCollection.description.trim() || undefined
      });
      setEditingCollection(null);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (confirm("Are you sure you want to delete this collection? This action cannot be undone.")) {
      await deleteCollection(collectionId);
    }
  };

  const handleCollectionClick = (collection: any) => {
    selectCollection(collection);
    // TODO: Navigate to collection detail view or show files in collection
    console.log("Selected collection:", collection);
  };

  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    green: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    purple: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    gray: "bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Collections</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Organize your files into smart collections for better management
            </p>
          </div>
          
          <Button 
            onClick={() => setShowCreateCollection(true)}
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>New Collection</span>
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

        {/* Create Collection Modal */}
        {showCreateCollection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateCollection(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-apple-lg p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                Create New Collection
              </h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection name"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleCreateCollection()}
                  autoFocus
                />
                
                <textarea
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateCollection(false);
                    setNewCollectionName("");
                    setNewCollectionDescription("");
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim() || isLoading}
                >
                  {isLoading ? "Creating..." : "Create"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Collection Modal */}
        {editingCollection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setEditingCollection(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-gray-800 rounded-apple-lg p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                Edit Collection
              </h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={editingCollection.name}
                  onChange={(e) => setEditingCollection({...editingCollection, name: e.target.value})}
                  placeholder="Collection name"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleUpdateCollection()}
                />
                
                <textarea
                  value={editingCollection.description}
                  onChange={(e) => setEditingCollection({...editingCollection, description: e.target.value})}
                  placeholder="Description (optional)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setEditingCollection(null)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateCollection}
                  disabled={!editingCollection.name.trim() || isLoading}
                >
                  {isLoading ? "Updating..." : "Update"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Collections Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading collections...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection, index) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card-notion p-6 cursor-pointer hover:shadow-apple-lg transition-all ${
                  colorClasses[collection.color as keyof typeof colorClasses] || colorClasses.gray
                }`}
                onClick={() => handleCollectionClick(collection)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{collection.icon}</span>
                    <div>
                      <h3 className="font-semibold text-base">{collection.name}</h3>
                      <p className="text-sm opacity-80">{collection.description || "No description"}</p>
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <button 
                      className="p-1 rounded hover:bg-white/20 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle dropdown menu
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-8 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-apple shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCollection(collection);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCollection(collection.id);
                        }}
                        className="w-full px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Files</span>
                    <span className="text-lg font-bold">{collection.file_count}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm opacity-75">
                    <span>Last updated</span>
                    <span>{new Date(collection.updated_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div 
                      className="bg-white/40 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(collection.file_count / 10 * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && collections.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-apple-xl flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Collections Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first collection to organize your files
            </p>
            <Button onClick={() => setShowCreateCollection(true)}>
              Create Collection
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}