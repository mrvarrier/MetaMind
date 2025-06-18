import { useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { SearchInterface } from "../search/SearchInterface";
import { Collections } from "../collections/Collections";
import { Insights } from "../insights/Insights";
import { Settings } from "../settings/Settings";
import { useAppStore } from "../../stores/useAppStore";
import { safeInvoke, isTauriApp } from "../../utils/tauri";

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const { theme, resetOnboarding } = useAppStore();

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 overflow-auto">
      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Custom Title Bar (for frameless window) */}
        <div 
          className="h-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 flex items-center justify-center"
          data-tauri-drag-region
        >
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <div className="w-3 h-3 bg-green-500 rounded-full" />
          </div>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              MetaMind
            </span>
          </div>
          
          {/* Development Reset Button */}
          <div className="absolute right-4">
            <button
              onClick={async () => {
                if (confirm('Reset everything? This will clear all data and restart the app.')) {
                  try {
                    // Reset database first
                    if (isTauriApp()) {
                      await safeInvoke('reset_database');
                    }
                    // Clear all localStorage
                    localStorage.clear();
                    sessionStorage.clear();
                    // Reset onboarding state
                    resetOnboarding();
                    // Force reload the app
                    window.location.href = window.location.origin;
                  } catch (error) {
                    console.error('Failed to reset database:', error);
                    alert('Failed to reset database, but onboarding will be reset anyway');
                    localStorage.clear();
                    sessionStorage.clear();
                    resetOnboarding();
                    window.location.href = window.location.origin;
                  }
                }
              }}
              className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              title="Reset onboarding (dev only)"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Main Interface */}
        <div className="flex-1 flex flex-col">
          {activeTab === "search" && <SearchInterface />}
          {activeTab === "collections" && <Collections />}
          {activeTab === "insights" && <Insights />}
          {activeTab === "settings" && <Settings />}
        </div>
      </div>
    </div>
  );
}