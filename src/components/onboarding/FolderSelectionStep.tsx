import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";

interface FolderSelectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function FolderSelectionStep({ onNext, onBack }: FolderSelectionStepProps) {
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const { updateOnboardingState } = useAppStore();

  const suggestedFolders = [
    { path: "~/Documents", description: "Your documents folder", icon: "📄" },
    { path: "~/Desktop", description: "Files on your desktop", icon: "🖥️" },
    { path: "~/Downloads", description: "Downloaded files", icon: "⬇️" },
    { path: "~/Pictures", description: "Your photos and images", icon: "📸" },
    { path: "~/Projects", description: "Development projects", icon: "⚡" },
  ];

  const toggleFolder = (folderPath: string) => {
    if (selectedFolders.includes(folderPath)) {
      setSelectedFolders(selectedFolders.filter(f => f !== folderPath));
    } else {
      setSelectedFolders([...selectedFolders, folderPath]);
    }
  };

  const handleNext = () => {
    updateOnboardingState({ selectedFolders });
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Select Folders to Monitor
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Choose which folders MetaMind should analyze and index
        </p>
      </motion.div>

      <div className="space-y-4 mb-8">
        {suggestedFolders.map((folder, index) => (
          <motion.div
            key={folder.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`card-notion p-4 cursor-pointer transition-all ${
              selectedFolders.includes(folder.path)
                ? 'ring-2 ring-primary-500 border-primary-300 dark:border-primary-600'
                : 'hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => toggleFolder(folder.path)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-2xl">{folder.icon}</div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {folder.path}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {folder.description}
                  </p>
                </div>
              </div>
              
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                selectedFolders.includes(folder.path)
                  ? 'bg-primary-500 border-primary-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {selectedFolders.includes(folder.path) && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-center mb-8">
        <Button variant="outline">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Custom Folder
        </Button>
      </div>

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

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        
        <Button 
          onClick={handleNext}
          disabled={selectedFolders.length === 0}
        >
          Continue ({selectedFolders.length} folder{selectedFolders.length !== 1 ? 's' : ''} selected)
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}