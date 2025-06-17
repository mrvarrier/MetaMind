import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSystemStore } from "../../stores/useSystemStore";

export function Insights() {
  const { processingStatus, systemInfo } = useSystemStore();
  
  // Calculate disk usage percentage from DiskInfo array
  const calculateDiskUsage = () => {
    if (!systemInfo?.disk_usage || !Array.isArray(systemInfo.disk_usage)) {
      return 0;
    }
    
    const disks = systemInfo.disk_usage;
    if (disks.length === 0) return 0;
    
    // Use the primary disk (usually first in the array) or calculate average
    const primaryDisk = disks[0];
    return primaryDisk?.usage_percentage || 0;
  };
  
  const diskUsagePercentage = calculateDiskUsage();
  
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
        message: "AI analysis completed for Documents folder",
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        status: "completed"
      },
      {
        id: "2",
        type: "indexing",
        message: "Content extraction for 15 PDF files",
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        status: "completed"
      },
      {
        id: "3",
        type: "processing",
        message: "Processing queue started for Images folder",
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        status: "in_progress"
      }
    ],
    topCategories: [
      { name: "Documents", count: 0, percentage: 0, color: "blue" },
      { name: "Images", count: 0, percentage: 0, color: "green" },
      { name: "Code", count: 0, percentage: 0, color: "purple" },
      { name: "Other", count: 0, percentage: 0, color: "gray" }
    ],
    processingStats: {
      avgProcessingSpeed: 0,
      totalProcessingTime: 0,
      successRate: 0,
      memoryUsage: 0,
      activeWorkers: 0
    }
  });

  useEffect(() => {
    // Update insights when processing status changes
    if (processingStatus) {
      const totalFiles = processingStatus.total_processed + processingStatus.queue_size;
      const successRate = totalFiles > 0 ? ((processingStatus.total_processed - processingStatus.errors) / totalFiles) * 100 : 0;
      const avgSpeed = processingStatus.average_processing_time_ms > 0 ? 1000 / processingStatus.average_processing_time_ms : 0;
      
      setInsights(prev => ({
        ...prev,
        processedFiles: processingStatus.total_processed,
        totalFiles,
        processingStats: {
          avgProcessingSpeed: Math.round(avgSpeed * 10) / 10, // files per second
          totalProcessingTime: processingStatus.average_processing_time_ms,
          successRate: Math.round(successRate),
          memoryUsage: Math.round((systemInfo?.memory_usage || 0)),
          activeWorkers: processingStatus.current_processing
        }
      }));
    }
  }, [processingStatus, systemInfo]);

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
              title="Processing Speed"
              value={`${insights.processingStats.avgProcessingSpeed}`}
              subtitle="files/sec"
              icon="⚡"
              color="purple"
            />
          </motion.div>
        </div>

        {/* AI Processing Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card-notion p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Success Rate</h3>
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {insights.processingStats.successRate}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Files processed without errors
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card-notion p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Active Workers</h3>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {insights.processingStats.activeWorkers}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Currently processing files
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="card-notion p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Errors</h3>
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <span className="text-xl">⚠️</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
              {processingStatus?.errors || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Failed processing attempts
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* File Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
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
            transition={{ delay: 0.9 }}
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

        {/* Processing Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="card-notion p-6 mb-8"
        >
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Processing Trends
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Files Processed Today</span>
                <span className="font-medium">{insights.processedFiles}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((insights.processedFiles / Math.max(insights.totalFiles, 1)) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {Math.round((insights.processedFiles / Math.max(insights.totalFiles, 1)) * 100)}% of total files
              </p>
            </div>
            
            <div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Processing Efficiency</span>
                <span className="font-medium">{insights.processingStats.successRate}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${insights.processingStats.successRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Success rate over last 24 hours
              </p>
            </div>
          </div>
        </motion.div>

        {/* System Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="card-notion p-6 mb-8"
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
                <span>{Math.round(diskUsagePercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${diskUsagePercentage}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}