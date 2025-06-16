import { motion } from "framer-motion";
import { Button } from "../common/Button";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-12"
      >
        {/* Logo */}
        <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-apple-xl shadow-apple-xl flex items-center justify-center">
          <div className="w-16 h-16 bg-white/20 rounded-apple-lg backdrop-blur-sm flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            MetaMind
          </span>
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
          Your AI-powered file intelligence system that automatically analyzes, 
          tags, and organizes your files with natural language search capabilities.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="grid md:grid-cols-3 gap-6 mb-12"
      >
        {/* Feature Cards */}
        <div className="card-notion p-6">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-apple-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary-600 dark:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Smart Search
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Find anything with natural language queries and semantic understanding.
          </p>
        </div>

        <div className="card-notion p-6">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-apple-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary-600 dark:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            AI Analysis
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Automatically analyze and categorize files with advanced AI models.
          </p>
        </div>

        <div className="card-notion p-6">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-apple-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary-600 dark:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Privacy First
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Your data stays local with optional cloud features you control.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Button
          size="lg"
          onClick={onNext}
          className="px-8 py-4 text-lg"
        >
          Get Started
          <svg
            className="w-5 h-5 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Button>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          This setup will take about 3-5 minutes
        </p>
      </motion.div>
    </div>
  );
}