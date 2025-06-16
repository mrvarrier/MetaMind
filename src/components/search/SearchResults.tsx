import { motion } from "framer-motion";
import { useSearchStore } from "../../stores/useSearchStore";
import { formatBytes, formatDate, getFileIcon } from "../../utils/fileUtils";

export function SearchResults() {
  const {
    results,
    isSearching,
    query,
    viewMode,
    totalResults,
    selectedResults,
    toggleResultSelection,
    selectAllResults,
    clearSelection,
  } = useSearchStore();

  if (isSearching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Searching for "{query}"...
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-apple-xl flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 20a7.962 7.962 0 01-5-1.709M5 17H4a2 2 0 01-2-2V4a2 2 0 012-2h16a2 2 0 012 2v11a2 2 0 01-2 2h-1"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No files found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search terms or filters to find what you're looking for.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Results Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">
                {totalResults}
              </span>{" "}
              results for "{query}"
            </p>
            
            {selectedResults.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-primary-600 dark:text-primary-400">
                  {selectedResults.length} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={selectAllResults}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Select All
            </button>
            
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                className={`p-1.5 rounded ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                className={`p-1.5 rounded ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-auto p-6">
        <div className={`space-y-4 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : ''}`}>
          {results.map((result, index) => (
            <motion.div
              key={result.file.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={`card-notion p-4 cursor-pointer transition-all ${
                selectedResults.includes(result.file.id)
                  ? 'ring-2 ring-primary-500 border-primary-300 dark:border-primary-600'
                  : 'hover:shadow-apple-lg'
              }`}
              onClick={() => toggleResultSelection(result.file.id)}
            >
              <div className="flex items-start space-x-3">
                {/* File Icon */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-lg">{getFileIcon(result.file.extension)}</span>
                  </div>
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {result.file.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                        {result.file.path}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                        {Math.round(result.score * 100)}% match
                      </span>
                      
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedResults.includes(result.file.id)
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selectedResults.includes(result.file.id) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File Details */}
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatBytes(result.file.size)}</span>
                    <span>{formatDate(result.file.modified_at)}</span>
                    {result.file.extension && (
                      <span className="uppercase">{result.file.extension}</span>
                    )}
                  </div>

                  {/* Snippet */}
                  {result.snippet && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                      {result.snippet}
                    </p>
                  )}

                  {/* Highlights */}
                  {result.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.highlights.slice(0, 3).map((highlight, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 text-xs rounded-full"
                        >
                          {highlight.length > 20 ? `${highlight.slice(0, 20)}...` : highlight}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}