import { motion } from "framer-motion";
import { useSystemStore } from "../../stores/useSystemStore";
import { useSearchStore } from "../../stores/useSearchStore";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { processingStatus, cpuUsage, memoryUsage } = useSystemStore();
  const { searchHistory } = useSearchStore();

  const menuItems = [
    { icon: "🔍", label: "Search", active: true },
    { icon: "📁", label: "Collections", active: false },
    { icon: "📊", label: "Insights", active: false },
    { icon: "⚙️", label: "Settings", active: false },
  ];

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 64 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white">MetaMind</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">AI File Intelligence</p>
              </div>
            </motion.div>
          )}
          
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${
                collapsed ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 space-y-2">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              item.active
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-medium"
              >
                {item.label}
              </motion.span>
            )}
          </button>
        ))}
      </div>

      {/* System Status */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-auto p-4 border-t border-gray-200 dark:border-gray-700"
        >
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              System Status
            </h3>
            
            {/* CPU Usage */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>CPU</span>
                <span>{Math.round(cpuUsage)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${cpuUsage}%` }}
                />
              </div>
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Memory</span>
                <span>{Math.round(memoryUsage)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${memoryUsage}%` }}
                />
              </div>
            </div>

            {/* Processing Status */}
            {processingStatus && (
              <div className="text-xs">
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 mb-1">
                  <span>Processing</span>
                  <span>{processingStatus.queue_size} queued</span>
                </div>
                <div className="text-green-600 dark:text-green-400">
                  {processingStatus.total_processed} files processed
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Recent Searches */}
      {!collapsed && searchHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="p-4 border-t border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Recent Searches
          </h3>
          <div className="space-y-1">
            {searchHistory.slice(0, 5).map((query, index) => (
              <button
                key={index}
                className="w-full text-left px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded truncate"
              >
                {query}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}