import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";

export function Collections() {
  const [collections, setCollections] = useState([
    {
      id: "1",
      name: "Documents",
      description: "All document files from monitored folders",
      fileCount: 0,
      color: "blue",
      icon: "📄",
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "2", 
      name: "Images",
      description: "Photos and image files",
      fileCount: 0,
      color: "green",
      icon: "🖼️",
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "3",
      name: "Code",
      description: "Source code and programming files",
      fileCount: 0,
      color: "purple",
      icon: "💻",
      lastUpdated: new Date().toISOString(),
    }
  ]);

  const [newCollectionName, setNewCollectionName] = useState("");
  const [showCreateCollection, setShowCreateCollection] = useState(false);

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      const newCollection = {
        id: Date.now().toString(),
        name: newCollectionName.trim(),
        description: "Custom collection",
        fileCount: 0,
        color: "gray",
        icon: "📁",
        lastUpdated: new Date().toISOString(),
      };
      
      setCollections([...collections, newCollection]);
      setNewCollectionName("");
      setShowCreateCollection(false);
    }
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
              
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-apple bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateCollection()}
                autoFocus
              />
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateCollection(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateCollection}>
                  Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Collections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection, index) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card-notion p-6 cursor-pointer hover:shadow-apple-lg transition-all ${
                colorClasses[collection.color as keyof typeof colorClasses]
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{collection.icon}</span>
                  <div>
                    <h3 className="font-semibold text-base">{collection.name}</h3>
                    <p className="text-sm opacity-80">{collection.description}</p>
                  </div>
                </div>
                
                <button className="p-1 rounded hover:bg-white/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Files</span>
                  <span className="text-lg font-bold">{collection.fileCount}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm opacity-75">
                  <span>Last updated</span>
                  <span>{new Date(collection.lastUpdated).toLocaleDateString()}</span>
                </div>
                
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-white/40 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(collection.fileCount / 10 * 100, 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {collections.length === 0 && (
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