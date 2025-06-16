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

  // Model resource requirements
  const getModelRequirements = (modelId: string) => {
    const modelData: Record<string, { ramGB: number; cpuIntensive: boolean; gpuBenefit: boolean }> = {
      "llama3.1:8b": { ramGB: 8, cpuIntensive: false, gpuBenefit: true },
      "llama3.1:13b": { ramGB: 16, cpuIntensive: true, gpuBenefit: true },
      "llama3.1:70b": { ramGB: 64, cpuIntensive: true, gpuBenefit: true },
      "llava:13b": { ramGB: 16, cpuIntensive: true, gpuBenefit: true },
      "codellama:13b": { ramGB: 16, cpuIntensive: true, gpuBenefit: true },
      "mistral:7b": { ramGB: 8, cpuIntensive: false, gpuBenefit: true },
    };
    
    return modelData[modelId] || { ramGB: 8, cpuIntensive: false, gpuBenefit: true };
  };

  // Generate system-optimized configuration considering both system specs and chosen model
  const generateOptimizedConfig = (analysis: SystemAnalysis, selectedModel?: string): PerformanceConfig => {
    const { cpu_cores, total_memory_gb, gpu_acceleration } = analysis;
    const modelReqs = getModelRequirements(selectedModel || "");
    
    // Base calculations
    let cpuUsage = 50;
    let memoryMB = 1024;
    let threads = Math.min(cpu_cores, 4);
    let backgroundProcessing = cpu_cores >= 4;
    let thermalThrottling = true;
    
    // Adjust for model requirements
    const modelMemoryNeed = modelReqs.ramGB * 1024;
    const availableMemory = (total_memory_gb * 1024) - modelMemoryNeed; // Memory after model allocation
    
    // System tier classification considering model
    const isHighEnd = cpu_cores >= 8 && total_memory_gb >= (modelReqs.ramGB * 2);
    const isMidRange = cpu_cores >= 4 && total_memory_gb >= (modelReqs.ramGB * 1.5);
    const isLowEnd = total_memory_gb >= modelReqs.ramGB;
    
    if (!isLowEnd) {
      // System can't adequately run the model - conservative settings
      cpuUsage = 30;
      memoryMB = Math.min(availableMemory * 0.3, 512);
      threads = Math.max(1, Math.floor(cpu_cores * 0.3));
      backgroundProcessing = false;
    } else if (isHighEnd) {
      // High-end system with adequate headroom
      cpuUsage = modelReqs.cpuIntensive ? 75 : 65;
      memoryMB = Math.min(availableMemory * 0.4, 4096);
      threads = Math.min(cpu_cores - 2, modelReqs.cpuIntensive ? 8 : 6);
      backgroundProcessing = true;
      thermalThrottling = !modelReqs.cpuIntensive; // Disable for intensive models on high-end
    } else if (isMidRange) {
      // Mid-range system
      cpuUsage = modelReqs.cpuIntensive ? 65 : 55;
      memoryMB = Math.min(availableMemory * 0.3, 2048);
      threads = Math.min(cpu_cores - 1, modelReqs.cpuIntensive ? 6 : 4);
      backgroundProcessing = !modelReqs.cpuIntensive;
    } else {
      // Low-end but adequate system
      cpuUsage = modelReqs.cpuIntensive ? 50 : 40;
      memoryMB = Math.min(availableMemory * 0.25, 1024);
      threads = Math.max(1, cpu_cores - 1);
      backgroundProcessing = false;
    }
    
    // Ensure minimum viable memory allocation
    memoryMB = Math.max(memoryMB, 512);
    
    return {
      max_cpu_usage: Math.round(cpuUsage),
      max_memory_usage_mb: Math.round(memoryMB),
      enable_gpu_acceleration: gpu_acceleration && modelReqs.gpuBenefit,
      processing_threads: threads,
      enable_background_processing: backgroundProcessing,
      thermal_throttling: thermalThrottling,
    };
  };

  useEffect(() => {
    // Apply system-optimized settings considering both system and model
    if (onboardingState.systemAnalysis && !isSystemOptimized) {
      const optimizedConfig = generateOptimizedConfig(
        onboardingState.systemAnalysis, 
        onboardingState.selectedModel
      );
      setConfig(optimizedConfig);
      setIsSystemOptimized(true);
    }
  }, [onboardingState.systemAnalysis, onboardingState.selectedModel, isSystemOptimized]);

  // Generate dynamic presets based on system capabilities and selected model
  const getPresets = () => {
    const analysis = onboardingState.systemAnalysis;
    const selectedModel = onboardingState.selectedModel;
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
    const modelReqs = getModelRequirements(selectedModel || "");
    const maxMemory = Math.max(total_memory_gb * 1024, 1024); // At least 1GB
    const maxThreads = Math.max(cpu_cores, 2);
    const availableMemory = maxMemory - (modelReqs.ramGB * 1024); // Memory after model
    
    const modelName = selectedModel ? selectedModel.split(':')[0] : 'selected model';
    
    return [
      {
        name: "Power Saver",
        description: `Minimal usage while running ${modelName}`,
        config: {
          max_cpu_usage: 25,
          max_memory_usage_mb: Math.min(512, Math.round(availableMemory * 0.15)),
          enable_gpu_acceleration: false,
          processing_threads: Math.max(1, Math.floor(maxThreads * 0.25)),
          enable_background_processing: false,
          thermal_throttling: true,
        }
      },
      {
        name: "Model Optimized",
        description: `Optimized for ${modelName} on your ${cpu_cores}-core system`,
        config: generateOptimizedConfig(analysis, selectedModel),
        isRecommended: true
      },
      {
        name: "Maximum Performance",
        description: `Maximum resources for ${modelName}`,
        config: {
          max_cpu_usage: Math.min(85, modelReqs.cpuIntensive ? 80 : 70),
          max_memory_usage_mb: Math.min(Math.round(availableMemory * 0.5), 4096),
          enable_gpu_acceleration: gpu_acceleration && modelReqs.gpuBenefit,
          processing_threads: Math.max(1, maxThreads - 1),
          enable_background_processing: cpu_cores >= 4 && !modelReqs.cpuIntensive,
          thermal_throttling: cpu_cores < 8 || modelReqs.cpuIntensive,
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

      {/* System and Model Information */}
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
                  Model: {onboardingState.selectedModel || 'None selected'} • GPU: {onboardingState.systemAnalysis.gpu_acceleration ? 'Available' : 'Not Available'}
                </p>
                {onboardingState.selectedModel && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Model needs ~{getModelRequirements(onboardingState.selectedModel).ramGB}GB RAM
                  </p>
                )}
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
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">AI Processing Speed</p>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((i) => {
                  const modelBonus = onboardingState.selectedModel && getModelRequirements(onboardingState.selectedModel).cpuIntensive ? 1 : 0;
                  const speedScore = Math.floor((config.max_cpu_usage + config.processing_threads * 10 + modelBonus * 10) / 35);
                  return (
                    <div
                      key={i}
                      className={`w-2 h-4 rounded-sm ${
                        i <= speedScore ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {(() => {
                  const modelBonus = onboardingState.selectedModel && getModelRequirements(onboardingState.selectedModel).cpuIntensive ? 1 : 0;
                  const speedScore = Math.floor((config.max_cpu_usage + config.processing_threads * 10 + modelBonus * 10) / 35);
                  return speedScore > 3 ? 'Fast' : speedScore > 1 ? 'Medium' : 'Slow';
                })()}
              </span>
            </div>
          </div>
          
          <div>
            <p className="text-gray-500 dark:text-gray-400">Memory Usage</p>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((i) => {
                  const totalMemoryUsage = config.max_memory_usage_mb + (onboardingState.selectedModel ? getModelRequirements(onboardingState.selectedModel).ramGB * 1024 : 0);
                  const systemMemory = onboardingState.systemAnalysis?.total_memory_gb || 8;
                  const memoryScore = Math.floor((totalMemoryUsage / (systemMemory * 1024)) * 5);
                  return (
                    <div
                      key={i}
                      className={`w-2 h-4 rounded-sm ${
                        i <= memoryScore ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {(() => {
                  const totalMemoryUsage = config.max_memory_usage_mb + (onboardingState.selectedModel ? getModelRequirements(onboardingState.selectedModel).ramGB * 1024 : 0);
                  const systemMemory = onboardingState.systemAnalysis?.total_memory_gb || 8;
                  const memoryPercent = (totalMemoryUsage / (systemMemory * 1024)) * 100;
                  return memoryPercent > 60 ? 'High' : memoryPercent > 30 ? 'Medium' : 'Low';
                })()}
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
        
        {onboardingState.selectedModel && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Model Impact:</strong> {onboardingState.selectedModel} will use approximately {getModelRequirements(onboardingState.selectedModel).ramGB}GB of RAM
              {getModelRequirements(onboardingState.selectedModel).cpuIntensive ? ' and is CPU-intensive' : ' with moderate CPU usage'}.
            </p>
          </div>
        )}
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