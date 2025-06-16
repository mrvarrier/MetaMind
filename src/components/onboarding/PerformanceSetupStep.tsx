import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { PerformanceConfig } from "../../types";

interface PerformanceSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function PerformanceSetupStep({ onNext, onBack }: PerformanceSetupStepProps) {
  const [config, setConfig] = useState<PerformanceConfig>({
    max_cpu_usage: 50,
    max_memory_usage_mb: 1024,
    enable_gpu_acceleration: true,
    processing_threads: 4,
    enable_background_processing: true,
    thermal_throttling: true,
  });

  const { updateOnboardingState } = useAppStore();

  const presets = [
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

  const handlePresetSelect = (preset: typeof presets[0]) => {
    setConfig(preset.config);
  };

  const handleNext = () => {
    updateOnboardingState({ performanceSettings: config });
    onNext();
  };

  return (
    <div className="max-w-4xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Performance Settings
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Configure how MetaMind uses your system resources
        </p>
      </motion.div>

      {/* Presets */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {presets.map((preset, index) => (
          <motion.div
            key={preset.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`card-notion p-6 cursor-pointer transition-all ${
              JSON.stringify(config) === JSON.stringify(preset.config)
                ? 'ring-2 ring-primary-500 border-primary-300 dark:border-primary-600'
                : 'hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => handlePresetSelect(preset)}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {preset.name}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {preset.description}
            </p>
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
              </label>
              <input
                type="range"
                min="512"
                max="4096"
                step="512"
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
              </label>
              <input
                type="range"
                min="1"
                max="16"
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
              />
              <label htmlFor="gpu_acceleration" className="text-sm text-gray-600 dark:text-gray-400">
                Enable GPU acceleration (if available)
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              GPU acceleration can significantly speed up AI processing
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

      <div className="flex justify-between">
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