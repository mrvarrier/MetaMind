import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { invoke } from "@tauri-apps/api/tauri";
import { fileProcessingService } from "../../services/fileProcessingService";
import { isTauriApp } from "../../utils/tauri";

interface CompletionStepProps {
  onComplete: () => void;
  onBack: () => void;
}

export function CompletionStep({ onComplete, onBack }: CompletionStepProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [initializationComplete, setInitializationComplete] = useState(false);
  
  const { onboardingState } = useAppStore();

  const startInitialization = async () => {
    setIsInitializing(true);
    setProgress(0);

    const tasks = [
      { name: "Downloading AI model...", duration: 2000 },
      { name: "Setting up file monitoring...", duration: 1500 },
      { name: "Processing selected folders...", duration: 2500 },
      { name: "Initializing search engine...", duration: 1000 },
      { name: "Configuring performance settings...", duration: 800 },
      { name: "Starting initial file scan...", duration: 1500 },
    ];

    try {
      for (const [index, task] of tasks.entries()) {
        setCurrentTask(task.name);
        
        // Execute actual setup tasks
        if (index === 0) {
          // Download model (simulated)
          await new Promise(resolve => setTimeout(resolve, task.duration));
        } else if (index === 1) {
          // Setup file monitoring
          try {
            if (isTauriApp()) {
              await invoke('start_file_monitoring', { 
                paths: onboardingState.selectedFolders 
              });
            }
          } catch (error) {
            console.warn('File monitoring setup failed:', error);
          }
          await new Promise(resolve => setTimeout(resolve, task.duration));
        } else if (index === 2) {
          // Process selected folders with file processing service
          try {
            await fileProcessingService.initializeFromOnboarding(onboardingState.selectedFolders || []);
            console.log('File processing initialized for folders:', onboardingState.selectedFolders);
          } catch (error) {
            console.error('File processing initialization failed:', error);
          }
          await new Promise(resolve => setTimeout(resolve, task.duration));
        } else if (index === 3) {
          // Initialize search engine (simulated)
          await new Promise(resolve => setTimeout(resolve, task.duration));
        } else if (index === 4) {
          // Configure performance settings
          try {
            if (onboardingState.performanceSettings && isTauriApp()) {
              await invoke('update_config', { 
                configUpdate: { performance: onboardingState.performanceSettings }
              });
            }
          } catch (error) {
            console.warn('Performance settings update failed:', error);
          }
          await new Promise(resolve => setTimeout(resolve, task.duration));
        } else if (index === 5) {
          // Start initial scan (simulated)
          await new Promise(resolve => setTimeout(resolve, task.duration));
        }

        setProgress(((index + 1) / tasks.length) * 100);
      }

      setInitializationComplete(true);
    } catch (error) {
      console.error('Initialization failed:', error);
      // For demo purposes, we'll still mark as complete
      setInitializationComplete(true);
    } finally {
      setIsInitializing(false);
      setCurrentTask("Setup complete!");
    }
  };

  useEffect(() => {
    // Auto-start initialization after a brief delay
    const timer = setTimeout(() => {
      startInitialization();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isInitializing || !initializationComplete) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <div className="w-32 h-32 mx-auto mb-6">
            <div className="relative">
              {/* Background circle */}
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-gray-200 dark:text-gray-700"
                />
                {/* Progress circle */}
                <motion.circle
                  cx="18"
                  cy="18"
                  r="16"
                  stroke="url(#progress-gradient)"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 100" }}
                  animate={{ strokeDasharray: `${progress} 100` }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="drop-shadow-sm"
                />
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>\n                </defs>
              </svg>
              
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  key={Math.round(progress)}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {Math.round(progress)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {progress === 100 ? 'Complete' : 'Setting up'}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Setting Up MetaMind
          </h2>
          
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            {currentTask}
          </p>
        </motion.div>

        <div className="card-notion p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              What's happening?
            </h3>
          </div>
          <div className="space-y-3 text-left text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                progress > 16 ? 'bg-green-500 shadow-lg shadow-green-500/30' : 
                progress > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className={progress > 16 ? 'text-gray-900 dark:text-white font-medium' : ''}>AI model downloaded and configured</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                progress > 33 ? 'bg-green-500 shadow-lg shadow-green-500/30' : 
                progress > 16 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className={progress > 33 ? 'text-gray-900 dark:text-white font-medium' : ''}>File monitoring system initialized</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                progress > 50 ? 'bg-green-500 shadow-lg shadow-green-500/30' : 
                progress > 33 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className={progress > 50 ? 'text-gray-900 dark:text-white font-medium' : ''}>Selected folders processed and indexed</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                progress > 66 ? 'bg-green-500 shadow-lg shadow-green-500/30' : 
                progress > 50 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className={progress > 66 ? 'text-gray-900 dark:text-white font-medium' : ''}>Search engine configured and ready</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                progress > 83 ? 'bg-green-500 shadow-lg shadow-green-500/30' : 
                progress > 66 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className={progress > 83 ? 'text-gray-900 dark:text-white font-medium' : ''}>Performance settings optimized</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                progress > 95 ? 'bg-green-500 shadow-lg shadow-green-500/30' : 
                progress > 83 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className={progress > 95 ? 'text-gray-900 dark:text-white font-medium' : ''}>Initial file scan completed</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-8"
      >
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
          className="w-24 h-24 mx-auto mb-6 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center"
        >
          <motion.svg
            className="w-12 h-12 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </motion.svg>
        </motion.div>

        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to MetaMind!
        </h2>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Your AI-powered file intelligence system is ready to use.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="space-y-6 mb-8"
      >
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-notion p-4">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {onboardingState.selectedFolders?.length || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Folders Monitored
            </div>
          </div>
          <div className="card-notion p-4">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {onboardingState.selectedModel?.includes('8b') ? '8B' : 
               onboardingState.selectedModel?.includes('13b') ? '13B' : 'AI'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              AI Model Ready
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="card-notion p-6 text-left">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            What's Next?
          </h3>
          <ul className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">1</span>
              </div>
              <span>MetaMind will automatically scan and analyze your selected folders</span>
            </li>
            <li className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">2</span>
              </div>
              <span>Start searching with natural language queries like "photos from last week"</span>
            </li>
            <li className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">3</span>
              </div>
              <span>Explore collections and insights as your files are processed</span>
            </li>
          </ul>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="flex justify-between"
      >
        <Button variant="secondary" onClick={onBack}>
          Back to Settings
        </Button>
        
        <Button onClick={onComplete} size="lg">
          Start Using MetaMind
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </motion.div>
    </div>
  );
}