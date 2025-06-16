import { useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { SearchInterface } from "../search/SearchInterface";
import { Collections } from "../collections/Collections";
import { Insights } from "../insights/Insights";
import { Settings } from "../settings/Settings";
import { useAppStore } from "../../stores/useAppStore";

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const { theme } = useAppStore();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
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