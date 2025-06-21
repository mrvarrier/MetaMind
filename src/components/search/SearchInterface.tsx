import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../common/Button";
import { Logo } from "../common/Logo";
import { useSearchStore } from "../../stores/useSearchStore";
import { SearchResults } from "./SearchResults";
import { SearchFilters } from "./SearchFilters";
import { VoiceSearch } from "./VoiceSearch";
import { VisualSearch } from "./VisualSearch";

export function SearchInterface() {
  const [searchInput, setSearchInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<'semantic' | 'hybrid' | 'traditional'>('semantic');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    suggestions,
    isSearching,
    aiAvailable,
    lastSearchType,
    search,
    hybridSearch,
    getSuggestions,
    clearSearch,
    checkAiAvailability,
  } = useSearchStore();

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Load processed files on mount (empty search to show all files)
  useEffect(() => {
    search("");
  }, []);

  useEffect(() => {
    if (searchInput.trim() && searchInput !== query) {
      const debounceTimer = setTimeout(() => {
        getSuggestions(searchInput);
        setShowSuggestions(true);
      }, 300);

      return () => clearTimeout(debounceTimer);
    } else {
      setShowSuggestions(false);
    }
  }, [searchInput, query, getSuggestions]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      const query = searchInput.trim();
      
      switch (searchMode) {
        case 'semantic':
          search(query);
          break;
        case 'hybrid':
          hybridSearch(query);
          break;
        case 'traditional':
          // Use regular search by temporarily setting a flag or passing a parameter
          search(query);
          break;
        default:
          search(query);
      }
      
      setShowSuggestions(false);
      searchInputRef.current?.blur();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      searchInputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchInput(suggestion);
    search(suggestion);
    setShowSuggestions(false);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    clearSearch();
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const handleVoiceTranscript = (transcript: string) => {
    setSearchInput(transcript);
  };

  const handleVoiceSearch = (query: string) => {
    setSearchInput(query);
    search(query);
    setShowSuggestions(false);
  };

  const handleVisualSearch = (query: string, _imageFile?: File) => {
    setSearchInput(query);
    search(query);
    setShowSuggestions(false);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Search Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header with Logo */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Logo size="lg" variant="icon" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Search</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Search through your files using natural language
                </p>
              </div>
            </div>
            
            {/* AI Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                aiAvailable 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  aiAvailable ? 'bg-green-400' : 'bg-yellow-400'
                }`}></div>
                <span>{aiAvailable ? 'AI Enhanced' : 'Basic Search'}</span>
              </div>
              
              {lastSearchType && lastSearchType !== 'unknown' && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Last: {lastSearchType === 'semantic' ? 'AI' : 
                         lastSearchType === 'regular' ? 'Text' :
                         lastSearchType === 'file_service' ? 'Local' :
                         lastSearchType === 'all_files' ? 'All' : 'Mock'}
                </div>
              )}
              
              <button
                onClick={checkAiAvailability}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Refresh AI status"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          {/* Main Search Bar */}
          <div className="relative">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="Search files with natural language..."
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-apple-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
                />

                {searchInput && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg
                      className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              <Button
                onClick={handleSearch}
                disabled={!searchInput.trim() || isSearching}
                loading={isSearching}
                size="lg"
              >
                Search
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowVoiceSearch(true)}
                size="lg"
                title="Voice Search"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3zm0 18c-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.93V23h2v-2.07c3.39-.5 6-3.4 6-6.93h-2c0 2.76-2.24 5-5 5z"/>
                </svg>
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowVisualSearch(true)}
                size="lg"
                title="Visual Search"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M4 4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h16v7l-3-3-6 6-2-2-5 5V6z"/>
                </svg>
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                size="lg"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
                  />
                </svg>
                Filters
              </Button>

              {/* Search Mode Selector */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-apple-lg p-1">
                {(['semantic', 'hybrid', 'traditional'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    className={`px-3 py-1 text-sm font-medium rounded-apple transition-colors ${
                      searchMode === mode
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'semantic' && '🧠 AI'}
                    {mode === 'hybrid' && '⚡ Hybrid'}
                    {mode === 'traditional' && '📝 Text'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Suggestions */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-apple-lg shadow-apple-lg z-50"
                >
                  <div className="p-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-apple transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                          <span>{suggestion}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Search Examples */}
          {!query && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Try searching with natural language:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "photos from last week",
                  "PDF documents about project",
                  "code files modified today",
                  "presentations larger than 10MB",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setSearchInput(example);
                      search(example);
                    }}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <SearchFilters />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-auto">
        {query ? (
          <SearchResults />
        ) : (
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Start Searching
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Use natural language to find your files. MetaMind understands context and meaning.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Voice Search Modal */}
      <VoiceSearch
        isOpen={showVoiceSearch}
        onClose={() => setShowVoiceSearch(false)}
        onTranscript={handleVoiceTranscript}
        onSearch={handleVoiceSearch}
      />

      {/* Visual Search Modal */}
      <VisualSearch
        isOpen={showVisualSearch}
        onClose={() => setShowVisualSearch(false)}
        onSearch={handleVisualSearch}
      />
    </div>
  );
}