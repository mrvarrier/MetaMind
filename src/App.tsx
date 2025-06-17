import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Onboarding } from "./components/onboarding/Onboarding";
import { MainLayout } from "./components/layout/MainLayout";
import { useAppStore } from "./stores/useAppStore";
import { useSystemStore } from "./stores/useSystemStore";
import { useSearchStore } from "./stores/useSearchStore";
import { LoadingScreen } from "./components/common/LoadingScreen";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    isOnboardingComplete, 
    initializeApp, 
    setOnboardingComplete 
  } = useAppStore();
  
  const { 
    initializeSystemMonitoring, 
    systemInfo 
  } = useSystemStore();
  
  const { init: initializeSearch } = useSearchStore();

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        
        // Initialize app state
        await initializeApp();
        
        // Initialize system monitoring
        await initializeSystemMonitoring();
        
        // Initialize search store
        initializeSearch();
        
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize application');
        setIsLoading(false);
      }
    };

    initialize();
  }, [initializeApp, initializeSystemMonitoring, initializeSearch]);

  if (isLoading) {
    return <LoadingScreen message="Initializing MetaMind..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Initialization Error
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-apple"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        <AnimatePresence mode="wait">
          {!isOnboardingComplete ? (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Onboarding onComplete={() => setOnboardingComplete(true)} />
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <MainLayout />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

export default App;