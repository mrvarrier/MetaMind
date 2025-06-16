import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../stores/useAppStore";
import { WelcomeStep } from "./WelcomeStep";
import { SystemAnalysisStep } from "./SystemAnalysisStep";
import { ModelSelectionStep } from "./ModelSelectionStep";
import { FolderSelectionStep } from "./FolderSelectionStep";
import { PerformanceSetupStep } from "./PerformanceSetupStep";
import { CompletionStep } from "./CompletionStep";

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { onboardingState, setOnboardingStep } = useAppStore();
  const { currentStep } = onboardingState;

  const steps = [
    'welcome',
    'system-analysis',
    'model-selection',
    'folder-selection',
    'performance-setup',
    'completion',
  ] as const;

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setOnboardingStep(steps[nextIndex]);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setOnboardingStep(steps[prevIndex]);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onNext={nextStep} />;
      case 'system-analysis':
        return <SystemAnalysisStep onNext={nextStep} onBack={prevStep} />;
      case 'model-selection':
        return <ModelSelectionStep onNext={nextStep} onBack={prevStep} />;
      case 'folder-selection':
        return <FolderSelectionStep onNext={nextStep} onBack={prevStep} />;
      case 'performance-setup':
        return <PerformanceSetupStep onNext={nextStep} onBack={prevStep} />;
      case 'completion':
        return <CompletionStep onComplete={onComplete} onBack={prevStep} />;
      default:
        return <WelcomeStep onNext={nextStep} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Step Indicator */}
      <div className="fixed top-8 right-8 z-40">
        <div className="flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-apple-lg px-4 py-2 shadow-apple">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-primary-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-300/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}