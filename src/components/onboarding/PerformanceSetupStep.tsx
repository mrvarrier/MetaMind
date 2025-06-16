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

  // Model resource requirements - Conservative estimates with safety margins
  const getModelRequirements = (modelId: string) => {
    const modelData: Record<string, { 
      minRamGB: number; 
      recommendedRamGB: number; 
      cpuIntensive: boolean; 
      gpuBenefit: boolean;
      maxSafeCpuUsage: number;
    }> = {
      "llama3.1:8b": { minRamGB: 6, recommendedRamGB: 10, cpuIntensive: false, gpuBenefit: true, maxSafeCpuUsage: 60 },
      "llama3.1:13b": { minRamGB: 12, recommendedRamGB: 20, cpuIntensive: true, gpuBenefit: true, maxSafeCpuUsage: 50 },
      "llama3.1:70b": { minRamGB: 48, recommendedRamGB: 80, cpuIntensive: true, gpuBenefit: true, maxSafeCpuUsage: 40 },
      "llava:13b": { minRamGB: 12, recommendedRamGB: 20, cpuIntensive: true, gpuBenefit: true, maxSafeCpuUsage: 50 },
      "codellama:13b": { minRamGB: 12, recommendedRamGB: 20, cpuIntensive: true, gpuBenefit: true, maxSafeCpuUsage: 50 },
      "mistral:7b": { minRamGB: 5, recommendedRamGB: 8, cpuIntensive: false, gpuBenefit: true, maxSafeCpuUsage: 60 },
    };
    
    // Conservative fallback for unknown models
    return modelData[modelId] || { 
      minRamGB: 8, 
      recommendedRamGB: 12, 
      cpuIntensive: true, 
      gpuBenefit: false, 
      maxSafeCpuUsage: 40 
    };
  };

  // Generate system-optimized configuration with strict safety checks
  const generateOptimizedConfig = (analysis: SystemAnalysis, selectedModel?: string): PerformanceConfig => {
    const { cpu_cores, total_memory_gb, gpu_acceleration } = analysis;
    const modelReqs = getModelRequirements(selectedModel || "");
    
    // SAFETY: Validate inputs and use conservative fallbacks
    const safeCpuCores = Math.max(cpu_cores || 2, 1);
    const safeMemoryGB = Math.max(total_memory_gb || 4, 2);
    
    // SAFETY: Check if system can run the model at all
    const canRunModel = safeMemoryGB >= modelReqs.minRamGB;
    const hasRecommendedMemory = safeMemoryGB >= modelReqs.recommendedRamGB;
    
    if (!canRunModel) {
      // CRITICAL: System cannot run this model safely - ultra-conservative settings
      return {
        max_cpu_usage: 20,
        max_memory_usage_mb: 256, // Absolute minimum
        enable_gpu_acceleration: false,
        processing_threads: 1,
        enable_background_processing: false,
        thermal_throttling: true,
      };
    }
    
    // SAFETY: Calculate available memory with large safety margins
    const systemReserve = Math.max(safeMemoryGB * 0.15, 2); // Reserve 15% or 2GB minimum for OS
    const modelMemoryNeed = hasRecommendedMemory ? modelReqs.minRamGB : modelReqs.recommendedRamGB;
    const availableMemoryGB = safeMemoryGB - systemReserve - modelMemoryNeed;
    
    // SAFETY: Ensure we have at least 1GB available for processing
    if (availableMemoryGB < 1) {
      // Insufficient memory - very conservative settings
      return {
        max_cpu_usage: 25,
        max_memory_usage_mb: 512,
        enable_gpu_acceleration: false,
        processing_threads: Math.max(1, Math.floor(safeCpuCores * 0.25)),
        enable_background_processing: false,
        thermal_throttling: true,
      };
    }
    
    // SAFETY: CPU usage calculation with model-specific limits
    const baseCpuUsage = modelReqs.cpuIntensive ? 35 : 45;
    const maxSafeCpuUsage = Math.min(modelReqs.maxSafeCpuUsage, 70); // Never exceed 70%
    let cpuUsage = baseCpuUsage;
    
    // SAFETY: Thread calculation - always leave cores for system
    const reservedCores = Math.max(Math.ceil(safeCpuCores * 0.25), 1); // Reserve 25% or 1 core minimum
    const maxUsableCores = safeCpuCores - reservedCores;
    let threads = Math.max(1, Math.min(maxUsableCores, modelReqs.cpuIntensive ? 4 : 6));
    
    // SAFETY: Memory allocation - use percentage of available memory, not total
    let memoryMB = Math.min(
      availableMemoryGB * 1024 * 0.6, // Use max 60% of available memory
      modelReqs.cpuIntensive ? 1536 : 2048 // Conservative caps based on model type
    );
    
    // System tier classification with safety margins
    const isHighEnd = safeCpuCores >= 8 && safeMemoryGB >= (modelReqs.recommendedRamGB * 2);
    const isMidRange = safeCpuCores >= 4 && safeMemoryGB >= (modelReqs.recommendedRamGB * 1.25);
    
    if (isHighEnd && hasRecommendedMemory) {
      // High-end system with ample memory
      cpuUsage = Math.min(maxSafeCpuUsage * 0.8, 60); // Max 60% even on high-end
      threads = Math.min(maxUsableCores, modelReqs.cpuIntensive ? 6 : 8);
      memoryMB = Math.min(availableMemoryGB * 1024 * 0.7, 3072); // Max 3GB
    } else if (isMidRange && hasRecommendedMemory) {
      // Mid-range system
      cpuUsage = Math.min(maxSafeCpuUsage * 0.7, 50); // Max 50%
      threads = Math.min(maxUsableCores, modelReqs.cpuIntensive ? 4 : 6);
      memoryMB = Math.min(availableMemoryGB * 1024 * 0.6, 2048); // Max 2GB
    } else {
      // Lower-end or tight memory - very conservative
      cpuUsage = Math.min(maxSafeCpuUsage * 0.6, 40); // Max 40%
      threads = Math.min(maxUsableCores, modelReqs.cpuIntensive ? 2 : 4);
      memoryMB = Math.min(availableMemoryGB * 1024 * 0.5, 1024); // Max 1GB
    }
    
    // SAFETY: Final validation and enforcement of absolute limits
    cpuUsage = Math.max(20, Math.min(cpuUsage, 70)); // Hard limits: 20-70%
    memoryMB = Math.max(256, Math.min(memoryMB, 4096)); // Hard limits: 256MB-4GB
    threads = Math.max(1, Math.min(threads, safeCpuCores - 1)); // Always leave 1 core
    
    // SAFETY: Background processing only on adequate systems
    const backgroundProcessing = !modelReqs.cpuIntensive && 
                               safeCpuCores >= 4 && 
                               availableMemoryGB >= 2 &&
                               cpuUsage <= 50;
    
    // SAFETY: Always enable thermal throttling except on very high-end systems
    const thermalThrottling = !(isHighEnd && safeCpuCores >= 12 && !modelReqs.cpuIntensive);
    
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
    
    // SAFETY: Validate inputs
    const safeCpuCores = Math.max(cpu_cores || 2, 1);
    const safeMemoryGB = Math.max(total_memory_gb || 4, 2);
    
    // SAFETY: Calculate safe memory allocation
    const systemReserve = Math.max(safeMemoryGB * 0.15, 2);
    const modelMemoryNeed = modelReqs.recommendedRamGB;
    const availableMemoryGB = Math.max(safeMemoryGB - systemReserve - modelMemoryNeed, 0.5);
    
    const modelName = selectedModel ? selectedModel.split(':')[0] : 'selected model';
    
    return [
      {
        name: "Power Saver",
        description: `Minimal usage while running ${modelName}`,
        config: {
          max_cpu_usage: 20,
          max_memory_usage_mb: Math.max(256, Math.min(512, Math.round(availableMemoryGB * 1024 * 0.3))),
          enable_gpu_acceleration: false,
          processing_threads: Math.max(1, Math.floor(safeCpuCores * 0.25)),
          enable_background_processing: false,
          thermal_throttling: true,
        }
      },
      {
        name: "Model Optimized",
        description: `Optimized for ${modelName} on your ${safeCpuCores}-core system`,
        config: generateOptimizedConfig(analysis, selectedModel),
        isRecommended: true
      },
      {
        name: "High Performance",
        description: `Enhanced performance for ${modelName} (use with caution)`,
        config: {
          max_cpu_usage: Math.min(modelReqs.maxSafeCpuUsage, 65), // Respect model-specific limits
          max_memory_usage_mb: Math.max(512, Math.min(3072, Math.round(availableMemoryGB * 1024 * 0.8))),
          enable_gpu_acceleration: gpu_acceleration && modelReqs.gpuBenefit,
          processing_threads: Math.max(1, Math.min(safeCpuCores - 1, modelReqs.cpuIntensive ? 6 : 8)),
          enable_background_processing: safeCpuCores >= 6 && !modelReqs.cpuIntensive && availableMemoryGB >= 2,
          thermal_throttling: safeCpuCores < 12 || modelReqs.cpuIntensive,
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
                    Model needs {getModelRequirements(onboardingState.selectedModel).minRamGB}-{getModelRequirements(onboardingState.selectedModel).recommendedRamGB}GB RAM
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
                  const modelReqs = onboardingState.selectedModel ? getModelRequirements(onboardingState.selectedModel) : null;
                  const modelMemoryMB = modelReqs ? modelReqs.recommendedRamGB * 1024 : 0;
                  const totalMemoryUsage = config.max_memory_usage_mb + modelMemoryMB;
                  const systemMemoryMB = (onboardingState.systemAnalysis?.total_memory_gb || 8) * 1024;
                  const memoryScore = Math.min(5, Math.floor((totalMemoryUsage / systemMemoryMB) * 5));
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
                  const modelReqs = onboardingState.selectedModel ? getModelRequirements(onboardingState.selectedModel) : null;
                  const modelMemoryMB = modelReqs ? modelReqs.recommendedRamGB * 1024 : 0;
                  const totalMemoryUsage = config.max_memory_usage_mb + modelMemoryMB;
                  const systemMemoryMB = (onboardingState.systemAnalysis?.total_memory_gb || 8) * 1024;
                  const memoryPercent = (totalMemoryUsage / systemMemoryMB) * 100;
                  return memoryPercent > 70 ? 'High' : memoryPercent > 40 ? 'Medium' : 'Low';
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
              <strong>Model Impact:</strong> {onboardingState.selectedModel} will use {getModelRequirements(onboardingState.selectedModel).minRamGB}-{getModelRequirements(onboardingState.selectedModel).recommendedRamGB}GB of RAM
              {getModelRequirements(onboardingState.selectedModel).cpuIntensive ? ' and is CPU-intensive' : ' with moderate CPU usage'}.
              Maximum safe CPU usage for this model is {getModelRequirements(onboardingState.selectedModel).maxSafeCpuUsage}%.
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