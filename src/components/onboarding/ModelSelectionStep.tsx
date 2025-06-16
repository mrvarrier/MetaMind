import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../common/Button";
import { useAppStore } from "../../stores/useAppStore";

interface ModelSelectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

const availableModels = [
  {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    description: "Fast and efficient for most tasks",
    size: "4.7 GB",
    recommended: true,
    capabilities: ["Text Analysis", "Document Processing", "Code Understanding"]
  },
  {
    id: "llama3.1:13b",
    name: "Llama 3.1 13B", 
    description: "Better accuracy for complex analysis",
    size: "7.3 GB",
    recommended: false,
    capabilities: ["Advanced Text Analysis", "Complex Reasoning", "Better Code Analysis"]
  },
  {
    id: "llava:13b",
    name: "LLaVA 13B",
    description: "Vision model for image analysis",
    size: "7.3 GB", 
    recommended: false,
    capabilities: ["Image Analysis", "OCR", "Visual Understanding"]
  }
];

export function ModelSelectionStep({ onNext, onBack }: ModelSelectionStepProps) {
  const [selectedModel, setSelectedModel] = useState(availableModels[0].id);
  const { updateOnboardingState } = useAppStore();

  const handleNext = () => {
    updateOnboardingState({ selectedModel });
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
          Choose Your AI Model
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Select the AI model that best fits your needs and system capabilities
        </p>
      </motion.div>

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
                : 'hover:border-gray-300 dark:hover:border-gray-600'
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
                      <span className="ml-2 px-2 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-xs rounded-full">
                        Recommended
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
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card-notion p-6 mb-8 text-left">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          What happens next?
        </h3>
        <ul className="space-y-2 text-gray-600 dark:text-gray-400">
          <li className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-primary-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>The selected model will be downloaded automatically</span>
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

      <div className="flex justify-between">
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