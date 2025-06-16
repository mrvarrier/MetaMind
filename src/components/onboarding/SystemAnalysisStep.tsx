import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/tauri";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { useSystemStore } from "../../stores/useSystemStore";
import { SystemAnalysis } from "../../types";

interface SystemAnalysisStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function SystemAnalysisStep({ onNext, onBack }: SystemAnalysisStepProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  
  const { updateOnboardingState } = useAppStore();
  const { systemInfo, getSystemCapabilities } = useSystemStore();
  const [analysis, setAnalysis] = useState<SystemAnalysis | null>(null);

  useEffect(() => {
    startSystemAnalysis();
  }, []);

  const startSystemAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress(0);

    try {
      // Simulate analysis steps with progress
      const steps = [
        { name: "Detecting hardware...", duration: 1000 },
        { name: "Analyzing CPU capabilities...", duration: 800 },
        { name: "Checking memory configuration...", duration: 600 },
        { name: "Testing GPU acceleration...", duration: 1200 },
        { name: "Evaluating performance profile...", duration: 800 },
      ];

      let currentProgress = 0;
      for (const [index, step] of steps.entries()) {
        await new Promise(resolve => setTimeout(resolve, step.duration));
        currentProgress = ((index + 1) / steps.length) * 100;
        setProgress(currentProgress);
      }

      // Get actual system capabilities
      const capabilities = await getSystemCapabilities();
      setAnalysis(capabilities);
      
      // Store in onboarding state
      updateOnboardingState({ systemAnalysis: capabilities });
      
      setAnalysisComplete(true);
    } catch (error) {
      console.error('System analysis failed:', error);
      // Get minimal real data from browser
      const browserAnalysis: SystemAnalysis = {
        cpu_cores: navigator.hardwareConcurrency || 0,
        total_memory_gb: 0, // Will show "Unknown" in UI
        architecture: 'browser',
        os: navigator.platform || 'unknown',
        gpu_acceleration: false,
        recommended_max_threads: navigator.hardwareConcurrency || 0,
        supports_background_processing: true,
      };
      setAnalysis(browserAnalysis);
      setAnalysisComplete(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatMemory = (gb: number) => {
    if (gb === 0) return "Unknown";
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${gb} GB`;
  };

  const getPerformanceRating = () => {
    if (!analysis) return "Unknown";
    
    const { cpu_cores, total_memory_gb, gpu_acceleration } = analysis;
    
    let score = 0;
    if (cpu_cores >= 8) score += 3;
    else if (cpu_cores >= 4) score += 2;
    else score += 1;
    
    if (total_memory_gb >= 32) score += 3;
    else if (total_memory_gb >= 16) score += 2;
    else if (total_memory_gb >= 8) score += 1;
    
    if (gpu_acceleration) score += 2;
    
    if (score >= 7) return "Excellent";
    if (score >= 5) return "Good";
    if (score >= 3) return "Fair";
    return "Basic";
  };

  const getRecommendations = () => {
    if (!analysis) return [];
    
    const recommendations = [];
    
    if (analysis.cpu_cores < 4) {
      recommendations.push("Consider upgrading CPU for better performance");
    }
    
    if (analysis.total_memory_gb < 8) {
      recommendations.push("More RAM recommended for large file processing");
    }
    
    if (!analysis.gpu_acceleration) {
      recommendations.push("GPU acceleration not available - processing will use CPU only");
    }
    
    if (recommendations.length === 0) {
      recommendations.push("Your system is well-suited for MetaMind!");
    }
    
    return recommendations;
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
          System Analysis
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          We're analyzing your system to optimize MetaMind's performance
        </p>
      </motion.div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2">
        <div className="space-y-6 pb-6 max-w-4xl mx-auto">{/* Content container */}

      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <div className="card-notion p-8">
            {/* Animated Analysis Icon */}
            <div className="w-20 h-20 mx-auto mb-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-primary-200 rounded-full animate-spin">
                  <div className="absolute top-0 left-0 w-4 h-4 bg-primary-600 rounded-full"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Analyzing Your System
            </h3>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
              <motion.div
                className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            
            <p className="text-gray-600 dark:text-gray-400">
              {Math.round(progress)}% complete
            </p>
          </div>
        </motion.div>
      )}

      {analysisComplete && analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 mb-8"
        >
          {/* System Overview */}
          <div className="card-notion p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                System Overview
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                getPerformanceRating() === 'Excellent' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                getPerformanceRating() === 'Good' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                getPerformanceRating() === 'Fair' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              }`}>
                {getPerformanceRating()}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">CPU Cores</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {analysis.cpu_cores}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Memory</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatMemory(analysis.total_memory_gb)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Architecture</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {analysis.architecture}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">GPU Acceleration</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {analysis.gpu_acceleration ? "Available" : "Not Available"}
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="card-notion p-6 text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recommendations
            </h3>
            <ul className="space-y-2">
              {getRecommendations().map((recommendation, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <svg
                    className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400">
                    {recommendation}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Additional test content to ensure scrolling works */}
          <div className="card-notion p-6 text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              System Details
            </h3>
            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
              <p>This section contains additional system information to test scrolling functionality.</p>
              <p>The layout should be fully scrollable regardless of window size.</p>
              <p>You should be able to see this content and the Continue button below by scrolling.</p>
              <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">Test Scrolling:</p>
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <p key={i}>Line {i + 1}: This is test content to ensure proper scrolling behavior works correctly at all window sizes.</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

        </div>
      </div>

      {/* Navigation - Fixed at bottom */}
      <div className="flex justify-between mt-6 flex-shrink-0">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        
        <Button 
          onClick={onNext} 
          disabled={!analysisComplete}
          loading={isAnalyzing}
        >
          Continue
          <svg
            className="w-4 h-4 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
}