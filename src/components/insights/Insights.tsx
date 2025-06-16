import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSystemStore } from "../../stores/useSystemStore";

export function Insights() {
  const { processingStatus, systemInfo } = useSystemStore();
  
  const [insights, setInsights] = useState({
    totalFiles: 0,
    processedFiles: 0,
    fileTypes: {
      documents: 0,
      images: 0,
      code: 0,
      other: 0
    },
    recentActivity: [
      {
        id: "1",
        type: "analysis",
        message: "AI analysis started for Documents folder",
        timestamp: new Date().toISOString(),
        status: "in_progress"
      }
    ],
    topCategories: [
      { name: "Documents", count: 0, percentage: 0, color: "blue" },
      { name: "Images", count: 0, percentage: 0, color: "green" },
      { name: "Code", count: 0, percentage: 0, color: "purple" },
      { name: "Other", count: 0, percentage: 0, color: "gray" }
    ]
  });

  useEffect(() => {
    // Update insights when processing status changes
    if (processingStatus) {
      setInsights(prev => ({
        ...prev,
        processedFiles: processingStatus.total_processed,
        totalFiles: processingStatus.total_processed + processingStatus.queue_size
      }));
    }
  }, [processingStatus]);

  const StatCard = ({ title, value, subtitle, icon, color = "primary" }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    color?: string;
  }) => (
    <div className="card-notion p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 bg-${color}-100 dark:bg-${color}-900/20 rounded-apple-lg flex items-center justify-center`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );

  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500", 
    purple: "bg-purple-500",
    gray: "bg-gray-500"
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            AI-powered analysis and insights about your files
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard
              title="Total Files"
              value={insights.totalFiles}
              subtitle="Monitored files"
              icon="📁"
              color="blue"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StatCard
              title="Analyzed"
              value={insights.processedFiles}
              subtitle={`${Math.round((insights.processedFiles / Math.max(insights.totalFiles, 1)) * 100)}% complete`}
              icon="🤖"
              color="green"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatCard
              title="Processing Queue"
              value={processingStatus?.queue_size || 0}
              subtitle="Files pending"
              icon="⏳"
              color="orange"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <StatCard
              title="Avg Processing Time"
              value={`${Math.round(processingStatus?.average_processing_time_ms || 0)}ms`}
              subtitle="Per file"
              icon="⚡"
              color="purple"
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* File Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card-notion p-6"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              File Categories
            </h3>
            
            <div className="space-y-4">
              {insights.topCategories.map((category, index) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${colorClasses[category.color as keyof typeof colorClasses]}`} />
                    <span className="text-gray-900 dark:text-white font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-600 dark:text-gray-400">{category.count}</span>
                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${colorClasses[category.color as keyof typeof colorClasses]}`}
                        style={{ width: `${category.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card-notion p-6"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            
            <div className="space-y-4">
              {insights.recentActivity.map((activity, index) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' :
                    activity.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/20' :
                    'bg-gray-100 dark:bg-gray-900/20'
                  }`}>
                    {activity.status === 'completed' ? '✅' :
                     activity.status === 'in_progress' ? '🔄' : '⏸️'}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 dark:text-white text-sm">{activity.message}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {insights.recentActivity.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* System Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="card-notion p-6 mt-8"
        >
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            System Performance
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>CPU Usage</span>
                <span>{Math.round(systemInfo?.cpu_usage || 0)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${systemInfo?.cpu_usage || 0}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Memory Usage</span>
                <span>{Math.round(systemInfo?.memory_usage || 0)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${systemInfo?.memory_usage || 0}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Disk Usage</span>
                <span>{Math.round(systemInfo?.disk_usage || 0)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${systemInfo?.disk_usage || 0}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}