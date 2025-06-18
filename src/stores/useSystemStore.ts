import { create } from 'zustand';
import { SystemInfo, ProcessingStats, SystemAnalysis } from '../types';
import { safeInvoke, isTauriApp, mockData } from '../utils/tauri';

interface SystemState {
  // System info
  systemInfo: SystemInfo | null;
  systemAnalysis: SystemAnalysis | null;
  processingStatus: ProcessingStats | null;
  
  // Monitoring state
  isMonitoring: boolean;
  monitoringInterval: number | null;
  
  // Performance
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  isThrottled: boolean;
  
  // Actions
  initializeSystemMonitoring: () => Promise<void>;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
  refreshSystemInfo: () => Promise<void>;
  getSystemCapabilities: () => Promise<SystemAnalysis>;
  getProcessingStatus: () => Promise<void>;
  updatePerformanceMetrics: (metrics: { cpu: number; memory: number; disk: number }) => void;
  startMockMonitoring: () => void;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  // Initial state
  systemInfo: null,
  systemAnalysis: null,
  processingStatus: null,
  isMonitoring: false,
  monitoringInterval: null,
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
  isThrottled: false,

  // Actions
  initializeSystemMonitoring: async () => {
    try {
      let systemInfo: SystemInfo;
      let capabilities: SystemAnalysis;

      if (isTauriApp()) {
        // Get real system info from Tauri backend
        systemInfo = await safeInvoke<SystemInfo>('get_system_info') || mockData.systemInfo;
        capabilities = await get().getSystemCapabilities();
      } else {
        // Use mock data for web development
        console.log('Using mock system data for web development');
        systemInfo = mockData.systemInfo;
        capabilities = mockData.systemCapabilities;
      }

      set({ systemInfo, systemAnalysis: capabilities });

      // Start monitoring if in Tauri mode
      if (isTauriApp()) {
        await get().startMonitoring();
      } else {
        // Simulate monitoring with mock data updates
        get().startMockMonitoring();
      }
    } catch (error) {
      console.error('Failed to initialize system monitoring:', error);
      // Fallback to mock data
      set({ 
        systemInfo: mockData.systemInfo,
        systemAnalysis: mockData.systemCapabilities
      });
    }
  },

  startMonitoring: async () => {
    const { isMonitoring } = get();
    if (isMonitoring) return;

    try {
      // Start system monitoring on backend
      await safeInvoke('start_system_monitoring');
      
      // Set up periodic updates
      const interval = window.setInterval(async () => {
        await get().refreshSystemInfo();
        await get().getProcessingStatus();
      }, 5000); // Update every 5 seconds

      set({ 
        isMonitoring: true, 
        monitoringInterval: interval 
      });
    } catch (error) {
      console.error('Failed to start system monitoring:', error);
    }
  },

  stopMonitoring: () => {
    const { monitoringInterval } = get();
    
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }

    // Stop monitoring on backend
    if (isTauriApp()) {
      safeInvoke('stop_system_monitoring').catch(console.error);
    }

    set({ 
      isMonitoring: false, 
      monitoringInterval: null 
    });
  },

  refreshSystemInfo: async () => {
    try {
      if (isTauriApp()) {
        const systemInfo = await safeInvoke<SystemInfo>('get_system_info');
        if (systemInfo) {
          set({ 
            systemInfo,
            cpuUsage: systemInfo.cpu_usage,
            memoryUsage: systemInfo.memory_usage,
            isThrottled: systemInfo.cpu_usage > 80 || systemInfo.memory_usage > 85
          });
        }
      } else {
        // Update mock data with some variation
        const currentInfo = get().systemInfo || mockData.systemInfo;
        const updatedInfo = {
          ...currentInfo,
          cpu_usage: Math.max(10, Math.min(90, currentInfo.cpu_usage + (Math.random() - 0.5) * 10)),
          memory_usage: Math.max(20, Math.min(95, currentInfo.memory_usage + (Math.random() - 0.5) * 5)),
          disk_usage: currentInfo.disk_usage
        };
        
        set({ 
          systemInfo: updatedInfo,
          cpuUsage: updatedInfo.cpu_usage,
          memoryUsage: updatedInfo.memory_usage,
          isThrottled: updatedInfo.cpu_usage > 80 || updatedInfo.memory_usage > 85
        });
      }
    } catch (error) {
      console.error('Failed to refresh system info:', error);
    }
  },

  getSystemCapabilities: async (): Promise<SystemAnalysis> => {
    try {
      if (isTauriApp()) {
        const capabilities = await safeInvoke<SystemAnalysis>('get_system_capabilities');
        return capabilities || mockData.systemCapabilities;
      } else {
        // Return enhanced browser-detected capabilities for web mode
        return {
          cpu_cores: navigator.hardwareConcurrency || 8,
          total_memory_gb: 16, // Mock value for web development
          architecture: 'x86_64',
          os: navigator.platform || 'unknown',
          gpu_acceleration: false,
          recommended_max_threads: (navigator.hardwareConcurrency || 8) - 1,
          supports_background_processing: true,
        };
      }
    } catch (error) {
      console.error('Failed to get system capabilities:', error);
      return mockData.systemCapabilities;
    }
  },

  getProcessingStatus: async () => {
    try {
      if (isTauriApp()) {
        const status = await safeInvoke<ProcessingStats>('get_processing_status');
        if (status) {
          set({ processingStatus: status });
        }
      } else {
        // Use mock processing status for web development
        set({ processingStatus: mockData.processingStatus });
      }
    } catch (error) {
      console.error('Failed to get processing status:', error);
    }
  },

  updatePerformanceMetrics: (metrics: { cpu: number; memory: number; disk: number }) => {
    set({
      cpuUsage: metrics.cpu,
      memoryUsage: metrics.memory,
      diskUsage: metrics.disk,
      isThrottled: metrics.cpu > 80 || metrics.memory > 85,
    });
  },

  startMockMonitoring: () => {
    const { isMonitoring } = get();
    if (isMonitoring) return;

    // Set up periodic updates with mock data
    const interval = window.setInterval(async () => {
      await get().refreshSystemInfo();
      await get().getProcessingStatus();
    }, 5000); // Update every 5 seconds

    set({ 
      isMonitoring: true, 
      monitoringInterval: interval 
    });

    console.log('Mock system monitoring started');
  },
}));