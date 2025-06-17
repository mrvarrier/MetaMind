import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";
import { SystemAnalysis } from "../../types";
import { invoke } from "@tauri-apps/api/tauri";
import { isTauriApp } from "../../utils/tauri";

interface ModelSelectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

// Model metadata for known models
const modelMetadata: Record<string, any> = {
  "llama3.1:8b": {
    name: "Llama 3.1 8B",
    description: "Fast and efficient for most tasks",
    minMemoryGB: 8,
    minCpuCores: 2,
    capabilities: ["Text Analysis", "Document Processing", "Code Understanding"]
  },
  "llama3.1:13b": {
    name: "Llama 3.1 13B", 
    description: "Better accuracy for complex analysis",
    minMemoryGB: 16,
    minCpuCores: 4,
    capabilities: ["Advanced Text Analysis", "Complex Reasoning", "Better Code Analysis"]
  },
  "llama3.1:70b": {
    name: "Llama 3.1 70B",
    description: "Highest accuracy for complex reasoning",
    minMemoryGB: 64,
    minCpuCores: 8,
    capabilities: ["Expert-level Analysis", "Complex Reasoning", "Research Tasks"]
  },
  "llava:13b": {
    name: "LLaVA 13B",
    description: "Vision model for image analysis",
    minMemoryGB: 16,
    minCpuCores: 4,
    capabilities: ["Image Analysis", "OCR", "Visual Understanding"]
  },
  "codellama:13b": {
    name: "Code Llama 13B",
    description: "Specialized for code understanding and generation",
    minMemoryGB: 16,
    minCpuCores: 4,
    capabilities: ["Code Analysis", "Code Generation", "Programming Help"]
  },
  "mistral:7b": {
    name: "Mistral 7B",
    description: "Efficient European model with good performance",
    minMemoryGB: 8,
    minCpuCores: 2,
    capabilities: ["Text Analysis", "Multilingual Support", "General Tasks"]
  }
};

// Fallback models if Ollama is not available
const fallbackModels = [
  {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    description: "Fast and efficient for most tasks",
    size: "4.7 GB",
    minMemoryGB: 8,
    minCpuCores: 2,
    capabilities: ["Text Analysis", "Document Processing", "Code Understanding"],
    isInstalled: false
  },
  {
    id: "llama3.1:13b",
    name: "Llama 3.1 13B", 
    description: "Better accuracy for complex analysis",
    size: "7.3 GB",
    minMemoryGB: 16,
    minCpuCores: 4,
    capabilities: ["Advanced Text Analysis", "Complex Reasoning", "Better Code Analysis"],
    isInstalled: false
  },
  {
    id: "llava:13b",
    name: "LLaVA 13B",
    description: "Vision model for image analysis",
    size: "7.3 GB",
    minMemoryGB: 16,
    minCpuCores: 4,
    capabilities: ["Image Analysis", "OCR", "Visual Understanding"],
    isInstalled: false
  }
];

export function ModelSelectionStep({ onNext, onBack }: ModelSelectionStepProps) {
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState(fallbackModels.map(m => ({ ...m, recommended: false, compatible: true })));
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'not_found'>('checking');
  const { updateOnboardingState, onboardingState } = useAppStore();

  // Get system analysis from previous step
  const systemAnalysis = onboardingState.systemAnalysis;

  // Function to format model size
  const formatSize = (sizeInBytes: number) => {
    const gb = sizeInBytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  // Function to check Ollama models via direct API call
  const checkOllamaModels = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Ollama models found:', data);
      return data;
    } catch (error) {
      console.warn('Failed to connect to Ollama:', error);
      throw error;
    }
  };

  // Function to extract model info from Ollama response
  const processOllamaModels = (ollamaResponse: any) => {
    const installedModels = ollamaResponse.models || [];
    const allModels = [...fallbackModels];

    // Add installed models that aren't in our fallback list
    installedModels.forEach((ollamaModel: any) => {
      const modelId = ollamaModel.name;
      const existingIndex = allModels.findIndex(m => m.id === modelId);
      
      if (existingIndex >= 0) {
        // Update existing model with real data
        allModels[existingIndex] = {
          ...allModels[existingIndex],
          size: formatSize(ollamaModel.size),
          isInstalled: true
        };
      } else {
        // Add new model from Ollama
        const metadata = modelMetadata[modelId] || {
          name: modelId,
          description: "AI model available in your Ollama installation",
          minMemoryGB: 8,
          minCpuCores: 2,
          capabilities: ["AI Tasks"]
        };

        allModels.push({
          id: modelId,
          name: metadata.name,
          description: metadata.description,
          size: formatSize(ollamaModel.size),
          minMemoryGB: metadata.minMemoryGB,
          minCpuCores: metadata.minCpuCores,
          capabilities: metadata.capabilities,
          isInstalled: true
        });
      }
    });

    return allModels;
  };

  useEffect(() => {
    const loadAvailableModels = async () => {
      setIsLoadingModels(true);
      try {
        let response;
        
        // Try direct Ollama API first (works in both web and Tauri modes)
        try {
          response = await checkOllamaModels();
          setOllamaStatus('connected');
        } catch (ollamaError) {
          // Fallback to Tauri backend if available
          if (isTauriApp()) {
            try {
              response = await invoke('get_available_models') as any;
            } catch (tauriError) {
              console.warn('Both Ollama API and Tauri backend failed:', { ollamaError, tauriError });
              throw ollamaError; // Throw the original Ollama error
            }
          } else {
            throw ollamaError;
          }
        }
        
        const allModels = processOllamaModels(response);
        
        if (systemAnalysis) {
          const modelsWithRecommendations = allModels.map(model => {
            const hasEnoughMemory = systemAnalysis.total_memory_gb >= model.minMemoryGB;
            const hasEnoughCores = systemAnalysis.cpu_cores >= model.minCpuCores;
            const compatible = hasEnoughMemory && hasEnoughCores;

            // Logic for recommendations based on system specs
            let recommended = false;
            let description = model.description;

            if (compatible) {
              // For high-end systems (32GB+ RAM, 8+ cores), recommend larger models
              if (systemAnalysis.total_memory_gb >= 64 && systemAnalysis.cpu_cores >= 8) {
                recommended = model.id.includes("70b") || model.id === "llama3.1:13b";
              }
              else if (systemAnalysis.total_memory_gb >= 32 && systemAnalysis.cpu_cores >= 8) {
                recommended = model.id === "llama3.1:13b" || model.id === "codellama:13b";
                if (model.id === "llama3.1:8b") {
                  description = "Good performance, but your system can handle larger models";
                }
              }
              // For mid-range systems (16-32GB RAM, 4+ cores), recommend 8B or 13B
              else if (systemAnalysis.total_memory_gb >= 16 && systemAnalysis.cpu_cores >= 4) {
                recommended = model.id === "llama3.1:8b" || model.id === "mistral:7b";
                if (model.id.includes("13b")) {
                  description = "Better accuracy but will use more resources";
                }
              }
              // For lower-end systems (8-16GB RAM, 2+ cores), recommend smaller models
              else {
                recommended = model.id === "llama3.1:8b" || model.id === "mistral:7b";
                if (model.id.includes("13b") || model.id.includes("70b")) {
                  description = "May run slowly on your system";
                }
              }

              // Prioritize installed models for recommendations
              if (model.isInstalled && recommended) {
                description = `${description} (Already installed)`;
              } else if (!model.isInstalled) {
                description = `${description} (Needs download)`;
              }

            } else {
              // Mark as incompatible
              description = `Requires at least ${model.minMemoryGB}GB RAM and ${model.minCpuCores} CPU cores`;
            }

            return {
              ...model,
              description,
              recommended,
              compatible
            };
          });

          setAvailableModels(modelsWithRecommendations);
          
          // Auto-select the best model (prioritize installed + recommended)
          const installedRecommended = modelsWithRecommendations.find(m => m.recommended && m.isInstalled);
          const anyRecommended = modelsWithRecommendations.find(m => m.recommended);
          const installedCompatible = modelsWithRecommendations.find(m => m.compatible && m.isInstalled);
          const anyCompatible = modelsWithRecommendations.find(m => m.compatible);
          
          setSelectedModel(
            installedRecommended?.id || 
            anyRecommended?.id || 
            installedCompatible?.id || 
            anyCompatible?.id || 
            allModels[0].id
          );
        } else {
          setAvailableModels(allModels.map(m => ({ ...m, recommended: false, compatible: true })));
          setSelectedModel(allModels[0].id);
        }
      } catch (error) {
        console.error('Failed to load models from Ollama:', error);
        setOllamaStatus('not_found');
        // Use fallback models
        setAvailableModels(fallbackModels.map(m => ({ ...m, recommended: false, compatible: true })));
        setSelectedModel(fallbackModels[0].id);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadAvailableModels();
  }, [systemAnalysis]);

  const retryOllamaConnection = async () => {
    setOllamaStatus('checking');
    setIsLoadingModels(true);
    
    // Re-run the model loading function
    try {
      let response;
      
      // Try direct Ollama API first (works in both web and Tauri modes)
      try {
        response = await checkOllamaModels();
        setOllamaStatus('connected');
      } catch (ollamaError) {
        // Fallback to Tauri backend if available
        if (isTauriApp()) {
          try {
            response = await invoke('get_available_models') as any;
            setOllamaStatus('connected');
          } catch (tauriError) {
            console.warn('Both Ollama API and Tauri backend failed:', { ollamaError, tauriError });
            throw ollamaError;
          }
        } else {
          throw ollamaError;
        }
      }
      
      const allModels = processOllamaModels(response);
      
      if (systemAnalysis) {
        const modelsWithRecommendations = allModels.map(model => {
          const hasEnoughMemory = systemAnalysis.total_memory_gb >= model.minMemoryGB;
          const hasEnoughCores = systemAnalysis.cpu_cores >= model.minCpuCores;
          const compatible = hasEnoughMemory && hasEnoughCores;
          return { ...model, compatible, recommended: compatible };
        });
        setAvailableModels(modelsWithRecommendations);
        const bestModel = modelsWithRecommendations.find(m => m.compatible && m.isInstalled) || 
                         modelsWithRecommendations.find(m => m.compatible) || 
                         allModels[0];
        setSelectedModel(bestModel.id);
      } else {
        setAvailableModels(allModels.map(m => ({ ...m, recommended: false, compatible: true })));
        setSelectedModel(allModels[0].id);
      }
    } catch (error) {
      console.error('Retry failed:', error);
      setOllamaStatus('not_found');
      setAvailableModels(fallbackModels.map(m => ({ ...m, recommended: false, compatible: true })));
      setSelectedModel(fallbackModels[0].id);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleNext = () => {
    updateOnboardingState({ selectedModel });
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
          Choose Your AI Model
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Select the AI model that best fits your needs and system capabilities
        </p>
        {systemAnalysis && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Your system: {systemAnalysis.total_memory_gb}GB RAM, {systemAnalysis.cpu_cores} CPU cores
          </p>
        )}
        {!isLoadingModels && (
          <div className="flex items-center justify-center mt-3">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              ollamaStatus === 'connected' 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : ollamaStatus === 'not_found'
                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                ollamaStatus === 'connected' ? 'bg-green-500' : 
                ollamaStatus === 'not_found' ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
              <span>
                {ollamaStatus === 'connected' ? 'Ollama connected - showing installed models' :
                 ollamaStatus === 'not_found' ? 'Ollama not found - showing available models' :
                 'Checking Ollama...'}
              </span>
              {ollamaStatus === 'not_found' && (
                <button
                  onClick={retryOllamaConnection}
                  className="ml-2 text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                  title="Retry connection to Ollama"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2">
        <div className="space-y-6 pb-6 max-w-4xl mx-auto">{/* Content container */}

      {isLoadingModels ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {ollamaStatus === 'checking' ? 'Checking Ollama installation...' : 'Loading available models...'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            This may take a moment if Ollama is starting up
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 mb-8">
            {availableModels.map((model, index) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`card-notion p-6 cursor-pointer transition-all ${
                  selectedModel === model.id
                    ? 'ring-2 ring-primary-500 border-primary-300 dark:border-primary-600'
                    : model.compatible 
                      ? 'hover:border-gray-300 dark:hover:border-gray-600'
                      : 'opacity-60 hover:border-red-300 dark:hover:border-red-600'
                }`}
                onClick={() => setSelectedModel(model.id)}
              >
                <div className="flex items-start justify-between text-left">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        selectedModel === model.id
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`} />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {model.name}
                        {model.recommended && (
                          <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-full">
                            Recommended for your system
                          </span>
                        )}
                        {!model.compatible && (
                          <span className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded-full">
                            Not compatible
                          </span>
                        )}
                        {model.isInstalled && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                            Installed
                          </span>
                        )}
                      </h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {model.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {model.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full"
                        >
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Download Size</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {model.size}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Requires {model.minMemoryGB}GB RAM, {model.minCpuCores}+ cores
                    </p>
                    {systemAnalysis && (
                      <p className="text-xs mt-1">
                        <span className={model.compatible ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {model.compatible ? '✓ Compatible' : '✗ Incompatible'}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {ollamaStatus === 'not_found' && (
            <div className="card-notion p-6 mb-6 text-left bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Ollama Not Found
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                We couldn't connect to Ollama on your system. The models shown are available for download.
              </p>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <li>• Make sure Ollama is installed and running</li>
                <li>• Download Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ollama.ai</a></li>
                <li>• Run <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">ollama serve</code> in terminal</li>
              </ul>
              <button
                onClick={retryOllamaConnection}
                className="text-sm px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
              >
                Check Again
              </button>
            </div>
          )}

          <div className="card-notion p-6 mb-8 text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              What happens next?
            </h3>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  {availableModels.find(m => m.id === selectedModel)?.isInstalled 
                    ? "Selected model is already installed and ready" 
                    : "The selected model will be downloaded automatically"}
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>You can change models later in settings</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Models run locally for privacy and speed</span>
              </li>
            </ul>
          </div>
        </>
      )}

        </div>
      </div>

      {/* Navigation - Fixed at bottom */}
      <div className="flex justify-between mt-6 flex-shrink-0">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        
        <Button onClick={handleNext}>
          Continue with {availableModels.find(m => m.id === selectedModel)?.name}
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}