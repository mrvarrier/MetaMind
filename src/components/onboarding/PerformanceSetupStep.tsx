import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { PerformanceConfig, SystemAnalysis } from "../../types";

interface PerformanceSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function PerformanceSetupStep({ onNext, onBack }: PerformanceSetupStepProps) {
  const { onboardingState, updateOnboardingState } = useAppStore();
  const [config, setConfig] = useState<PerformanceConfig>({
    max_cpu_usage: 50,
    max_memory_usage_mb: 1024,
    enable_gpu_acceleration: true,
    processing_threads: 4,
    enable_background_processing: true,
    thermal_throttling: true,
  });
  const [isSystemOptimized, setIsSystemOptimized] = useState(false);

  // Generate system-optimized configuration
  const generateOptimizedConfig = (analysis: SystemAnalysis): PerformanceConfig => {
    const { cpu_cores, total_memory_gb, gpu_acceleration } = analysis;
    
    // Calculate optimal settings based on system specs
    let cpuUsage = 50;
    let memoryMB = 1024;
    let threads = Math.min(cpu_cores, 4);
    
    if (cpu_cores >= 8 && total_memory_gb >= 16) {
      // High-end system
      cpuUsage = 70;
      memoryMB = Math.min(total_memory_gb * 1024 * 0.25, 3072); // 25% of RAM, max 3GB
      threads = Math.min(cpu_cores - 2, 8); // Leave 2 cores for system
    } else if (cpu_cores >= 4 && total_memory_gb >= 8) {
      // Mid-range system
      cpuUsage = 60;
      memoryMB = Math.min(total_memory_gb * 1024 * 0.2, 2048); // 20% of RAM, max 2GB
      threads = Math.min(cpu_cores - 1, 6); // Leave 1 core for system
    } else {
      // Lower-end system
      cpuUsage = 40;
      memoryMB = Math.min(total_memory_gb * 1024 * 0.15, 1024); // 15% of RAM, max 1GB
      threads = Math.max(1, cpu_cores - 1); // Leave 1 core for system, min 1 thread
    }
    
    return {
      max_cpu_usage: cpuUsage,
      max_memory_usage_mb: Math.round(memoryMB),
      enable_gpu_acceleration: gpu_acceleration,
      processing_threads: threads,
      enable_background_processing: cpu_cores >= 4, // Only enable on quad-core+
      thermal_throttling: true, // Always enable for safety
    };
  };

  useEffect(() => {
    // Apply system-optimized settings on component mount
    if (onboardingState.systemAnalysis && !isSystemOptimized) {
      const optimizedConfig = generateOptimizedConfig(onboardingState.systemAnalysis);
      setConfig(optimizedConfig);
      setIsSystemOptimized(true);
    }
  }, [onboardingState.systemAnalysis, isSystemOptimized]);

  // Generate dynamic presets based on system capabilities
  const getPresets = () => {
    const analysis = onboardingState.systemAnalysis;
    if (!analysis) {
      // Fallback static presets if no system analysis
      return [
        {
          name: "Power Saver",
          description: "Minimal resource usage",
          config: {
            max_cpu_usage: 25,
            max_memory_usage_mb: 512,
            enable_gpu_acceleration: false,
            processing_threads: 2,
            enable_background_processing: false,
            thermal_throttling: true,
          }
        },
        {
          name: "Balanced",
          description: "Good balance of speed and efficiency",
          config: {
            max_cpu_usage: 50,
            max_memory_usage_mb: 1024,
            enable_gpu_acceleration: true,
            processing_threads: 4,
            enable_background_processing: true,
            thermal_throttling: true,
          }
        },
        {
          name: "Performance",
          description: "Maximum speed and responsiveness",
          config: {
            max_cpu_usage: 80,
            max_memory_usage_mb: 2048,
            enable_gpu_acceleration: true,
            processing_threads: 8,
            enable_background_processing: true,
            thermal_throttling: false,
          }
        }
      ];
    }

    const { cpu_cores, total_memory_gb, gpu_acceleration } = analysis;
    const maxMemory = Math.max(total_memory_gb * 1024, 1024); // At least 1GB
    const maxThreads = Math.max(cpu_cores, 2);
    
    return [
      {
        name: "Power Saver",
        description: "Minimal resource usage for battery life",
        config: {
          max_cpu_usage: 25,
          max_memory_usage_mb: Math.min(512, Math.round(maxMemory * 0.1)),
          enable_gpu_acceleration: false,
          processing_threads: Math.max(1, Math.floor(maxThreads * 0.25)),
          enable_background_processing: false,
          thermal_throttling: true,
        }
      },
      {
        name: "System Optimized",
        description: `Optimized for your ${cpu_cores}-core system`,
        config: generateOptimizedConfig(analysis),
        isRecommended: true
      },
      {
        name: "Maximum Performance",
        description: "Use maximum available resources",
        config: {
          max_cpu_usage: Math.min(85, cpu_cores >= 8 ? 80 : 70),
          max_memory_usage_mb: Math.min(Math.round(maxMemory * 0.4), 4096),
          enable_gpu_acceleration: gpu_acceleration,
          processing_threads: Math.max(1, maxThreads - 1),
          enable_background_processing: cpu_cores >= 4,
          thermal_throttling: cpu_cores < 8, // Disable only on high-end systems
        }
      }
    ];
  };

  const presets = getPresets();

  const handlePresetSelect = (preset: typeof presets[0]) => {
    setConfig(preset.config);
  };

  const handleNext = () => {
    updateOnboardingState({ performanceSettings: config });
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
          Performance Settings
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Configure how MetaMind uses your system resources
        </p>
      </motion.div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-6 pb-6">{/* Content container */}

      {/* System Information */}
      {onboardingState.systemAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-notion p-4 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  System: {onboardingState.systemAnalysis.cpu_cores} cores, {onboardingState.systemAnalysis.total_memory_gb || 'Unknown'} GB RAM
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  GPU: {onboardingState.systemAnalysis.gpu_acceleration ? 'Available' : 'Not Available'}
                </p>
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded">
              Auto-configured
            </span>
          </div>
        </motion.div>
      )}

      {/* Presets */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {presets.map((preset, index) => (
          <motion.div
            key={preset.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`card-notion p-6 cursor-pointer transition-all relative ${
              JSON.stringify(config) === JSON.stringify(preset.config)
                ? 'ring-2 ring-primary-500 border-primary-300 dark:border-primary-600'
                : 'hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => handlePresetSelect(preset)}
          >
            {preset.isRecommended && (
              <div className="absolute -top-2 -right-2 bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                Recommended
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {preset.name}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {preset.description}
            </p>
            {preset.isRecommended && (
              <div className="mt-3 text-xs text-primary-600 dark:text-primary-400">
                ✓ Based on your system specs
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Detailed Settings */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* CPU Usage */}
        <div className="card-notion p-6 text-left">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            CPU Usage Limit
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Maximum CPU Usage: {config.max_cpu_usage}%
              </label>
              <input
                type="range"
                min="10"
                max="90"
                value={config.max_cpu_usage}
                onChange={(e) => setConfig({ ...config, max_cpu_usage: Number(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="thermal_throttling"
                checked={config.thermal_throttling}
                onChange={(e) => setConfig({ ...config, thermal_throttling: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="thermal_throttling" className="text-sm text-gray-600 dark:text-gray-400">
                Enable thermal throttling
              </label>
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="card-notion p-6 text-left">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Memory Usage
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Maximum Memory: {(config.max_memory_usage_mb / 1024).toFixed(1)} GB
                {onboardingState.systemAnalysis && onboardingState.systemAnalysis.total_memory_gb > 0 && (
                  <span className="text-xs text-gray-500 ml-1">
                    (of {onboardingState.systemAnalysis.total_memory_gb} GB total)
                  </span>
                )}
              </label>
              <input
                type="range"
                min="512"
                max={onboardingState.systemAnalysis && onboardingState.systemAnalysis.total_memory_gb > 0 
                  ? Math.min(onboardingState.systemAnalysis.total_memory_gb * 1024 * 0.5, 8192)
                  : 4096}
                step="256"
                value={config.max_memory_usage_mb}
                onChange={(e) => setConfig({ ...config, max_memory_usage_mb: Number(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
          </div>
        </div>

        {/* Processing Threads */}
        <div className="card-notion p-6 text-left">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Processing
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Processing Threads: {config.processing_threads}
                {onboardingState.systemAnalysis && (
                  <span className="text-xs text-gray-500 ml-1">
                    (max: {onboardingState.systemAnalysis.cpu_cores})
                  </span>
                )}
              </label>
              <input
                type="range"
                min="1"
                max={onboardingState.systemAnalysis ? onboardingState.systemAnalysis.cpu_cores : 16}
                value={config.processing_threads}
                onChange={(e) => setConfig({ ...config, processing_threads: Number(e.target.value) })}
                className="w-full mt-2"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="background_processing"
                checked={config.enable_background_processing}
                onChange={(e) => setConfig({ ...config, enable_background_processing: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="background_processing" className="text-sm text-gray-600 dark:text-gray-400">
                Enable background processing
              </label>
            </div>
          </div>
        </div>

        {/* GPU Acceleration */}
        <div className="card-notion p-6 text-left">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            GPU Acceleration
          </h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="gpu_acceleration"
                checked={config.enable_gpu_acceleration}
                onChange={(e) => setConfig({ ...config, enable_gpu_acceleration: e.target.checked })}
                className="rounded"
                disabled={onboardingState.systemAnalysis && !onboardingState.systemAnalysis.gpu_acceleration}
              />
              <label htmlFor="gpu_acceleration" className={`text-sm ${
                onboardingState.systemAnalysis && !onboardingState.systemAnalysis.gpu_acceleration
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                Enable GPU acceleration
                {onboardingState.systemAnalysis && (
                  <span className={`ml-1 text-xs ${
                    onboardingState.systemAnalysis.gpu_acceleration
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    ({onboardingState.systemAnalysis.gpu_acceleration ? 'Available' : 'Not Available'})
                  </span>
                )}
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {onboardingState.systemAnalysis && onboardingState.systemAnalysis.gpu_acceleration
                ? 'GPU acceleration can significantly speed up AI processing'
                : 'GPU acceleration is not available on your system'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="card-notion p-6 mb-8 text-left">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Performance Impact
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Processing Speed</p>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-sm ${
                      i <= Math.floor((config.max_cpu_usage + config.processing_threads * 10) / 30)
                        ? 'bg-green-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {Math.floor((config.max_cpu_usage + config.processing_threads * 10) / 30) > 3 ? 'Fast' : 
                 Math.floor((config.max_cpu_usage + config.processing_threads * 10) / 30) > 1 ? 'Medium' : 'Slow'}
              </span>
            </div>
          </div>
          
          <div>
            <p className="text-gray-500 dark:text-gray-400">System Impact</p>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-sm ${
                      i <= Math.floor(config.max_cpu_usage / 20)
                        ? 'bg-yellow-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {config.max_cpu_usage > 60 ? 'High' : config.max_cpu_usage > 30 ? 'Medium' : 'Low'}
              </span>
            </div>
          </div>
          
          <div>
            <p className="text-gray-500 dark:text-gray-400">Battery Life</p>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-sm ${
                      i <= (5 - Math.floor(config.max_cpu_usage / 20))
                        ? 'bg-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {config.max_cpu_usage < 30 ? 'Excellent' : config.max_cpu_usage < 60 ? 'Good' : 'Fair'}
              </span>
            </div>
          </div>
        </div>
      </div>

        </div>
      </div>

      {/* Navigation - Fixed at bottom */}
      <div className="flex justify-between mt-6 flex-shrink-0">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        
        <Button onClick={handleNext}>
          Continue
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}