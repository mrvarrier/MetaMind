import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Logo } from "../common/Logo";
import { useSystemStore } from "../../stores/useSystemStore";
import { safeInvoke, isTauriApp } from "../../utils/tauri";

// Type definitions for insights data
interface ProcessingSummary {
  total_files?: number;
  completed_files?: number;
  success_rate?: number;
}

interface FileTypes {
  documents?: number;
  images?: number;
  code?: number;
  other?: number;
}

interface RecentActivity {
  action?: string;
  file?: string;
  timestamp?: string;
}

interface CategoryData {
  name?: string;
  count?: number;
}

interface InsightsData {
  processing_summary?: ProcessingSummary;
  file_types?: FileTypes;
  recent_activity?: RecentActivity[];
  categories?: CategoryData[];
}

// Type guard for insights data
function isInsightsData(obj: unknown): obj is InsightsData {
  return typeof obj === 'object' && obj !== null;
}

export function Insights() {
  const { processingStatus, systemInfo } = useSystemStore();
  
  // Calculate disk usage percentage from DiskInfo array
  const calculateDiskUsage = () => {
    try {
      if (!systemInfo?.disk_usage || !Array.isArray(systemInfo.disk_usage)) {
        return 0;
      }
      
      const disks = systemInfo.disk_usage;
      if (disks.length === 0) return 0;
      
      // Use the primary disk (usually first in the array) or calculate average
      const primaryDisk = disks[0];
      return Number(primaryDisk?.usage_percentage) || 0;
    } catch (error) {
      console.error('Error calculating disk usage:', error);
      return 0;
    }
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
    recentActivity: [] as any[],
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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load insights data from backend
  const loadInsightsData = async () => {
    try {
      console.log('Loading insights data - start');
      setIsLoading(true);
      setError(null);

      if (isTauriApp()) {
        console.log('Calling get_insights_data backend command');
        const response = await safeInvoke('get_insights_data');
        console.log('Received insights data:', response);
        
        if (isInsightsData(response)) {
          const insightsData = response;
          console.log('Processing insights data');
          
          // Safely extract data with fallbacks
          const totalFiles = Number(insightsData.processing_summary?.total_files) || 0;
          const completedFiles = Number(insightsData.processing_summary?.completed_files) || 0;
          const successRate = Number(insightsData.processing_summary?.success_rate) || 0;
          
          const fileTypes = {
            documents: insightsData.file_types?.documents || 0,
            images: insightsData.file_types?.images || 0,
            code: insightsData.file_types?.code || 0,
            other: insightsData.file_types?.other || 0
          };
          
          const recentActivity = Array.isArray(insightsData.recent_activity) 
            ? insightsData.recent_activity 
            : [];
            
          const categories = Array.isArray(insightsData.categories)
            ? insightsData.categories.map(cat => ({
                name: cat.name || "Unknown",
                count: cat.count || 0,
                percentage: 0,
                color: "blue"
              }))
            : [
                { name: "Documents", count: 0, percentage: 0, color: "blue" },
                { name: "Images", count: 0, percentage: 0, color: "green" },
                { name: "Code", count: 0, percentage: 0, color: "purple" },
                { name: "Other", count: 0, percentage: 0, color: "gray" }
              ];
          
          console.log('Setting insights state with processed data');
          setInsights(prev => ({
            ...prev,
            totalFiles,
            processedFiles: completedFiles,
            fileTypes,
            recentActivity,
            topCategories: categories,
            processingStats: {
              ...prev.processingStats,
              successRate
            }
          }));
          console.log('Insights state updated successfully');
        }
      } else {
        // Web mode - use mock data
        setInsights(prev => ({
          ...prev,
          totalFiles: 150,
          processedFiles: 125,
          fileTypes: {
            documents: 85,
            images: 23,
            code: 12,
            other: 5
          },
          recentActivity: [
            {
              id: "1",
              type: "analysis",
              message: "✅ Successfully processed presentation.pdf",
              timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
              status: "completed"
            },
            {
              id: "2",
              type: "indexing", 
              message: "✅ Successfully processed report.docx",
              timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
              status: "completed"
            }
          ],
          topCategories: [
            { name: "Documents", count: 85, percentage: 68, color: "blue" },
            { name: "Images", count: 23, percentage: 18.4, color: "green" },
            { name: "Code", count: 12, percentage: 9.6, color: "purple" },
            { name: "Other", count: 5, percentage: 4, color: "gray" }
          ]
        }));
      }
    } catch (error) {
      console.error('Failed to load insights data:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setError(`Failed to load insights data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('Loading insights data - complete');
      setIsLoading(false);
    }
  };

  // Load insights data on component mount and set up refresh
  useEffect(() => {
    loadInsightsData();
    
    // Temporarily disable auto-refresh to debug the issue
    // const interval = setInterval(() => {
    //   if (!error) {
    //     loadInsightsData();
    //   }
    // }, 30000);
    // return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update only live processing metrics when processing status changes
    // Do NOT overwrite backend data (totalFiles, processedFiles) to prevent reset to 0
    if (processingStatus) {
      const avgSpeed = processingStatus.average_processing_time_ms > 0 ? 1000 / processingStatus.average_processing_time_ms : 0;
      
      setInsights(prev => ({
        ...prev,
        // Only update real-time processing stats, preserve backend totals
        processingStats: {
          avgProcessingSpeed: Math.round(avgSpeed * 10) / 10, // files per second
          totalProcessingTime: processingStatus.average_processing_time_ms,
          successRate: prev.processingStats.successRate, // Keep backend success rate
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
  }) => {
    const getColorClasses = (colorName: string) => {
      const colorMap: { [key: string]: { bg: string; darkBg: string } } = {
        blue: { bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/20' },
        green: { bg: 'bg-green-100', darkBg: 'dark:bg-green-900/20' },
        orange: { bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/20' },
        purple: { bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/20' },
        red: { bg: 'bg-red-100', darkBg: 'dark:bg-red-900/20' },
        primary: { bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/20' }
      };
      return colorMap[colorName] || colorMap.primary;
    };
    
    const colors = getColorClasses(color);
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-apple-lg transition-all">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{title}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{subtitle}</p>
            )}
          </div>
          <div className={`w-14 h-14 ${colors.bg} ${colors.darkBg} rounded-apple-lg flex items-center justify-center flex-shrink-0 ml-4`}>
            <span className="text-2xl">{icon}</span>
          </div>
        </div>
      </div>
    );
  };

  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500", 
    purple: "bg-purple-500",
    gray: "bg-gray-500"
  };

  return (
    <div className="p-6 min-h-full overflow-auto">
      <div className="max-w-6xl mx-auto min-w-fit">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Logo size="lg" variant="icon" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                AI-powered analysis and insights about your files
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadInsightsData}
              disabled={isLoading}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors flex items-center space-x-2 ${
                isLoading 
                  ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              <svg 
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard
              title="Total Files"
              value={isLoading ? "..." : (insights.totalFiles || 0).toLocaleString()}
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
              value={isLoading ? "..." : (insights.processedFiles || 0).toLocaleString()}
              subtitle={isLoading ? "Loading..." : `${Math.round(((insights.processedFiles || 0) / Math.max((insights.totalFiles || 1), 1)) * 100)}% complete`}
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
              value={isLoading ? "..." : (processingStatus?.queue_size || 0).toLocaleString()}
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
              value={isLoading ? "..." : `${insights.processingStats?.avgProcessingSpeed || 0}`}
              subtitle="files/sec"
              icon="⚡"
              color="purple"
            />
          </motion.div>
        </div>

        {/* AI Processing Insights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <StatCard
              title="Success Rate"
              value={isLoading ? "..." : `${insights.processingStats?.successRate || 0}%`}
              subtitle="Files processed without errors"
              icon="✅"
              color="green"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <StatCard
              title="Active Workers"
              value={isLoading ? "..." : (insights.processingStats?.activeWorkers || 0)}
              subtitle="Currently processing files"
              icon="🤖"
              color="blue"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <StatCard
              title="Errors"
              value={isLoading ? "..." : (processingStatus?.errors || 0)}
              subtitle="Failed processing attempts"
              icon="⚠️"
              color="red"
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
          {/* File Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              File Categories
            </h3>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                      <div className="w-20 h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                      <div className="w-20 h-2 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : insights.topCategories.every(cat => cat.count === 0) ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No file categories available</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Process some files to see categories</p>
              </div>
            ) : (
              <div className="space-y-5">
                {insights.topCategories.map((category) => (
                  <div key={category.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${colorClasses[category.color as keyof typeof colorClasses]}`} />
                      <span className="text-gray-900 dark:text-white font-medium">{category.name}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-600 dark:text-gray-400 font-medium min-w-[2rem] text-right">
                        {category.count.toLocaleString()}
                      </span>
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-500 ${colorClasses[category.color as keyof typeof colorClasses]}`}
                          style={{ width: `${Math.max(category.percentage, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-right">
                        {category.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Recent Activity
            </h3>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                    <div className="flex-1">
                      <div className="w-full h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-2" />
                      <div className="w-16 h-3 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : insights.recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📝</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Activity will appear here when files are processed</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {insights.recentActivity.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' :
                      activity.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/20' :
                      activity.status === 'error' ? 'bg-red-100 dark:bg-red-900/20' :
                      'bg-gray-100 dark:bg-gray-900/20'
                    }`}>
                      {activity.status === 'completed' ? '✅' :
                       activity.status === 'in_progress' ? '🔄' : 
                       activity.status === 'error' ? '❌' : '⏸️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white text-sm leading-relaxed">{activity.message}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                        {(() => {
                          try {
                            // Handle both ISO format and database datetime format
                            const date = activity.timestamp.includes('T') 
                              ? new Date(activity.timestamp)
                              : new Date(activity.timestamp + 'Z'); // Assume UTC if no timezone
                            
                            const now = new Date();
                            const diffMs = now.getTime() - date.getTime();
                            const diffMins = Math.floor(diffMs / (1000 * 60));
                            
                            if (diffMins < 1) return 'Just now';
                            if (diffMins < 60) return `${diffMins}m ago`;
                            if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
                            return date.toLocaleDateString();
                          } catch (e) {
                            return activity.timestamp;
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Processing Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Processing Trends
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                <span>Files Processed</span>
                <span className="text-gray-900 dark:text-white">
                  {isLoading ? "..." : (insights.processedFiles || 0).toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${isLoading ? 0 : Math.min(((insights.processedFiles || 0) / Math.max((insights.totalFiles || 1), 1)) * 100, 100)}%` 
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isLoading ? "Loading..." : `${Math.round(((insights.processedFiles || 0) / Math.max((insights.totalFiles || 1), 1)) * 100)}% of total files`}
              </p>
            </div>
            
            <div>
              <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                <span>Processing Efficiency</span>
                <span className="text-gray-900 dark:text-white">
                  {isLoading ? "..." : `${insights.processingStats?.successRate || 0}%`}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${isLoading ? 0 : insights.processingStats?.successRate || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Success rate for processed files
              </p>
            </div>
          </div>
        </motion.div>

        {/* System Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="bg-white dark:bg-gray-800 rounded-apple-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            System Performance
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                <span>CPU Usage</span>
                <span className="text-gray-900 dark:text-white">
                  {Math.round(systemInfo?.cpu_usage || 0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${systemInfo?.cpu_usage || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Current processor load
              </p>
            </div>
            
            <div>
              <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                <span>Memory Usage</span>
                <span className="text-gray-900 dark:text-white">
                  {Math.round(systemInfo?.memory_usage || 0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${systemInfo?.memory_usage || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                RAM utilization
              </p>
            </div>
            
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                <span>Disk Usage</span>
                <span className="text-gray-900 dark:text-white">
                  {Math.round(diskUsagePercentage)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-orange-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${diskUsagePercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Storage utilization
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}