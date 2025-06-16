import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';
import { SystemInfo, ProcessingStatus, SystemAnalysis } from '../types';

interface SystemState {
  // System info
  systemInfo: SystemInfo | null;
  systemAnalysis: SystemAnalysis | null;
  processingStatus: ProcessingStatus | null;
  
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
      // Get initial system info
      const systemInfo = await invoke<SystemInfo>('get_system_info');
      set({ systemInfo });

      // Get system capabilities
      const capabilities = await get().getSystemCapabilities();
      set({ systemAnalysis: capabilities });

      // Start monitoring
      await get().startMonitoring();
    } catch (error) {
      console.error('Failed to initialize system monitoring:', error);
    }
  },

  startMonitoring: async () => {
    const { isMonitoring } = get();
    if (isMonitoring) return;

    try {
      // Start system monitoring on backend
      await invoke('start_system_monitoring');
      
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
    invoke('stop_system_monitoring').catch(console.error);

    set({ 
      isMonitoring: false, 
      monitoringInterval: null 
    });
  },

  refreshSystemInfo: async () => {
    try {
      const systemInfo = await invoke<SystemInfo>('get_system_info');
      
      set({ 
        systemInfo,
        cpuUsage: systemInfo.cpu_usage,
        memoryUsage: systemInfo.memory_usage,
        isThrottled: systemInfo.cpu_usage > 80 || systemInfo.memory_usage > 85
      });
    } catch (error) {
      console.error('Failed to refresh system info:', error);
    }
  },

  getSystemCapabilities: async (): Promise<SystemAnalysis> => {
    try {
      const capabilities = await invoke<SystemAnalysis>('get_system_capabilities');
      return capabilities;
    } catch (error) {
      console.error('Failed to get system capabilities:', error);
      
      // Return fallback capabilities
      return {
        cpu_cores: navigator.hardwareConcurrency || 4,
        total_memory_gb: 8, // Default assumption
        architecture: 'unknown',
        os: navigator.platform,
        gpu_acceleration: false,
        recommended_max_threads: navigator.hardwareConcurrency || 4,
        supports_background_processing: true,
      };
    }
  },

  getProcessingStatus: async () => {
    try {
      const status = await invoke<ProcessingStatus>('get_processing_status');
      set({ processingStatus: status });
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
}));