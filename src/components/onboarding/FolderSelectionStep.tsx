import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { open } from "@tauri-apps/api/dialog";
import { fileProcessingService } from "../../services/fileProcessingService";
import { isTauriApp } from "../../utils/tauri";

interface FolderSelectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function FolderSelectionStep({ onNext, onBack }: FolderSelectionStepProps) {
  const [selectedPaths, setSelectedPaths] = useState<{ path: string; type: 'folder' | 'file' }[]>([]);
  const { updateOnboardingState } = useAppStore();

  const addFolder = async () => {
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
          setSelectedPaths(prev => [...prev, ...newFolders]);
        }
      } else {
        // In web mode, simulate folder selection for development
        const mockFolders = [
          '/Users/Documents/Projects',
          '/Users/Documents/Research',
          '/Users/Downloads/Files'
        ];
        const randomFolder = mockFolders[Math.floor(Math.random() * mockFolders.length)];
        const newFolder = { path: randomFolder, type: 'folder' as const };
        setSelectedPaths(prev => [...prev, newFolder]);
      }
    } catch (error) {
      console.error('Error selecting folders:', error);
    }
  };

  const addFiles = async () => {
    try {
      if (isTauriApp()) {
        const selected = await open({
          directory: false,
          multiple: true,
          title: "Select files to monitor"
        });
        
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          const newFiles = paths.map(path => ({ path, type: 'file' as const }));
          setSelectedPaths(prev => [...prev, ...newFiles]);
        }
      } else {
        // In web mode, simulate file selection for development
        const mockFiles = [
          '/Users/Documents/report.pdf',
          '/Users/Documents/presentation.pptx',
          '/Users/Downloads/data.csv'
        ];
        const randomFile = mockFiles[Math.floor(Math.random() * mockFiles.length)];
        const newFile = { path: randomFile, type: 'file' as const };
        setSelectedPaths(prev => [...prev, newFile]);
      }
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  };

  const removePath = (pathToRemove: string) => {
    setSelectedPaths(prev => prev.filter(item => item.path !== pathToRemove));
  };

  const getDisplayName = (fullPath: string) => {
    return fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath;
  };

  const handleNext = () => {
    const folderPaths = selectedPaths.map(item => item.path);
    updateOnboardingState({ selectedFolders: folderPaths });
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Fixed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center flex-shrink-0"
      >
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Add Folders and Files
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Select folders and files for MetaMind to analyze and index
        </p>
      </motion.div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-6 pb-6">{/* Content container */}

      {/* Add Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
        <Button onClick={addFolder} variant="primary" size="lg">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Folders
        </Button>
        <Button onClick={addFiles} variant="outline" size="lg">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Add Files
        </Button>
      </div>

      {/* Selected Items List */}
      {selectedPaths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 mb-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Selected Items ({selectedPaths.length})
          </h3>
          {selectedPaths.map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-notion p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-xl">
                    {item.type === 'folder' ? '📁' : '📄'}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {getDisplayName(item.path)}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {item.path}
                    </p>
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded mt-1">
                      {item.type}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => removePath(item.path)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Empty State */}
      {selectedPaths.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 mb-8"
        >
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-apple-xl flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Items Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add folders and files to get started with MetaMind
          </p>
        </motion.div>
      )}

      <div className="card-notion p-6 mb-8 text-left">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Privacy & Performance Notes
        </h3>
        <ul className="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
          <li className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Files are analyzed locally on your device</span>
          </li>
          <li className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>You can add or remove folders anytime</span>
          </li>
          <li className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>More folders = longer initial processing time</span>
          </li>
        </ul>
      </div>

        </div>
      </div>

      {/* Navigation - Fixed at bottom */}
      <div className="flex justify-between mt-6 flex-shrink-0">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        
        <Button 
          onClick={handleNext}
          disabled={selectedPaths.length === 0}
        >
          Continue ({selectedPaths.length} item{selectedPaths.length !== 1 ? 's' : ''} selected)
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}