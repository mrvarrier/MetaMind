import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../common/Button";
import { invoke } from "@tauri-apps/api/tauri";

interface VisualSearchProps {
  onSearch: (query: string, imageFile?: File) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface SimilarImage {
  path: string;
  name: string;
  similarity: number;
  preview?: string;
}

export function VisualSearch({ onSearch, isOpen, onClose }: VisualSearchProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [similarImages, setSimilarImages] = useState<SimilarImage[]>([]);
  const [searchMode, setSearchMode] = useState<'similarity' | 'content'>('similarity');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setImagePreview(null);
      setAnalysisResult(null);
      setSimilarImages([]);
      setError(null);
      setIsAnalyzing(false);
    }
  }, [isOpen]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileSelection = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large. Please select an image smaller than 10MB.');
      return;
    }

    setError(null);
    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Start analysis
    await analyzeImage(file);
  };

  const analyzeImage = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setSimilarImages([]);

    try {
      // Convert file to base64 for backend
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
        try {
          // Send to backend for analysis
          const result = await invoke('analyze_visual_search_image', {
            imageData: base64Data,
            searchMode: searchMode
          });

          setAnalysisResult(result);

          // If similarity search, find similar images
          if (searchMode === 'similarity') {
            const similarResults = await invoke('find_similar_images', {
              imageData: base64Data,
              limit: 10
            });
            setSimilarImages(similarResults || []);
          }
        } catch (error) {
          console.error('Analysis failed:', error);
          setError('Failed to analyze image. Please try again.');
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File reading failed:', error);
      setError('Failed to read image file.');
      setIsAnalyzing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleSearch = (queryType: 'content' | 'similarity' | 'custom', customQuery?: string) => {
    if (!selectedImage && !customQuery) return;

    let searchQuery = '';
    
    switch (queryType) {
      case 'content':
        if (analysisResult?.description) {
          searchQuery = `images containing: ${analysisResult.description}`;
        }
        break;
      case 'similarity':
        searchQuery = 'similar images';
        break;
      case 'custom':
        searchQuery = customQuery || '';
        break;
    }

    if (searchQuery) {
      onSearch(searchQuery, selectedImage || undefined);
      onClose();
    }
  };

  const clearSelection = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setSimilarImages([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white dark:bg-gray-900 rounded-apple shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  🖼️ Visual Search
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Search by image content or find similar images
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex h-[calc(90vh-140px)]">
              {/* Left Panel - Image Upload */}
              <div className="w-1/2 p-6 border-r border-gray-200 dark:border-gray-700">
                {/* Search Mode Toggle */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Search Mode
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSearchMode('similarity')}
                      className={`px-3 py-2 rounded-apple text-sm font-medium transition-colors ${
                        searchMode === 'similarity'
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Find Similar
                    </button>
                    <button
                      onClick={() => setSearchMode('content')}
                      className={`px-3 py-2 rounded-apple text-sm font-medium transition-colors ${
                        searchMode === 'content'
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Search by Content
                    </button>
                  </div>
                </div>

                {/* Drop Zone */}
                <div
                  ref={dropZoneRef}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-apple-lg transition-colors ${
                    dragActive
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                      : 'border-gray-300 dark:border-gray-600'
                  } ${selectedImage ? 'h-64' : 'h-48'}`}
                >
                  {selectedImage && imagePreview ? (
                    <div className="relative h-full">
                      <img
                        src={imagePreview}
                        alt="Selected"
                        className="w-full h-full object-contain rounded-apple-lg"
                      />
                      <button
                        onClick={clearSelection}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                      <svg
                        className="w-12 h-12 text-gray-400 mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        Drag and drop an image here
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                        or click to browse
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        size="sm"
                      >
                        Select Image
                      </Button>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-apple"
                  >
                    <p className="text-red-700 dark:text-red-400 text-sm flex items-center">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      </svg>
                      {error}
                    </p>
                  </motion.div>
                )}

                {/* Analysis Progress */}
                {isAnalyzing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-apple border border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                      <p className="text-blue-700 dark:text-blue-400 text-sm">
                        Analyzing image...
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right Panel - Results */}
              <div className="w-1/2 p-6 overflow-y-auto">
                {analysisResult ? (
                  <div className="space-y-6">
                    {/* Analysis Results */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Analysis Results
                      </h4>
                      
                      {analysisResult.description && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-apple">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Content Description:
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {analysisResult.description}
                          </p>
                        </div>
                      )}

                      {analysisResult.objects && analysisResult.objects.length > 0 && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-apple">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Detected Objects:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.objects.map((obj: any, index: number) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 rounded-apple text-xs"
                              >
                                {obj.name} ({Math.round(obj.confidence * 100)}%)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysisResult.colors && analysisResult.colors.length > 0 && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-apple">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Dominant Colors:
                          </p>
                          <div className="flex space-x-2">
                            {analysisResult.colors.slice(0, 6).map((color: string, index: number) => (
                              <div
                                key={index}
                                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Similar Images */}
                    {searchMode === 'similarity' && similarImages.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Similar Images Found
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {similarImages.slice(0, 6).map((image, index) => (
                            <div
                              key={index}
                              className="relative bg-gray-100 dark:bg-gray-800 rounded-apple overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all"
                              onClick={() => handleSearch('custom', `file: ${image.name}`)}
                            >
                              {image.preview ? (
                                <img
                                  src={image.preview}
                                  alt={image.name}
                                  className="w-full h-20 object-cover"
                                />
                              ) : (
                                <div className="w-full h-20 flex items-center justify-center">
                                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M4 4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h16v7l-3-3-6 6-2-2-5 5V6z"/>
                                  </svg>
                                </div>
                              )}
                              <div className="p-2">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {image.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {Math.round(image.similarity * 100)}% similar
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search Actions */}
                    <div className="space-y-3">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Search Actions
                      </h4>
                      
                      {searchMode === 'content' && analysisResult.description && (
                        <Button
                          onClick={() => handleSearch('content')}
                          className="w-full justify-start"
                        >
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                          </svg>
                          Search by Image Content
                        </Button>
                      )}

                      {searchMode === 'similarity' && (
                        <Button
                          onClick={() => handleSearch('similarity')}
                          className="w-full justify-start"
                        >
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          Find Similar Images
                        </Button>
                      )}

                      {analysisResult.objects && analysisResult.objects.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Search for specific objects:
                          </p>
                          {analysisResult.objects.slice(0, 3).map((obj: any, index: number) => (
                            <Button
                              key={index}
                              variant="outline"
                              onClick={() => handleSearch('custom', `images with ${obj.name}`)}
                              className="w-full justify-start text-sm"
                            >
                              Search for "{obj.name}"
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : selectedImage ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-pulse">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-apple mx-auto mb-4"></div>
                        <p className="text-gray-500 dark:text-gray-400">Processing image...</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-sm">
                      <svg
                        className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M4 4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h16v7l-3-3-6 6-2-2-5 5V6z"/>
                      </svg>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Upload an Image
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Select an image to start visual search. MetaMind can analyze content and find similar images.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}