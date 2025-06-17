// Tauri utilities for handling web vs native mode

/**
 * Check if the app is running in Tauri (native) mode
 */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && 
         window.__TAURI_IPC__ !== undefined;
}

/**
 * Safe invoke wrapper that handles both Tauri and web modes
 */
export async function safeInvoke<T>(
  command: string, 
  args?: Record<string, any>
): Promise<T | null> {
  if (!isTauriApp()) {
    console.warn(`Tauri command '${command}' not available in web mode`);
    return null;
  }
  
  try {
    const { invoke } = await import('@tauri-apps/api/tauri');
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command '${command}' failed:`, error);
    throw error;
  }
}

/**
 * Mock data for development when Tauri is not available
 */
export const mockData = {
  appConfig: {
    version: "0.1.0",
    ai: {
      primary_provider: {
        Ollama: {
          model: "llama3.1:8b",
          url: "http://localhost:11434"
        }
      },
      ollama_url: "http://localhost:11434",
      model_preferences: {
        text_analysis: "llama3.1:8b",
        image_analysis: "llava:7b",
        document_analysis: "llama3.1:8b",
        code_analysis: "codellama:13b",
        embedding_model: "nomic-embed-text"
      },
      processing_queue_size: 100,
      batch_size: 10,
      timeout_seconds: 30
    },
    search: {
      max_results: 100,
      enable_semantic_search: true,
      enable_fuzzy_search: true,
      cache_size: 1000,
      index_batch_size: 50
    },
    monitoring: {
      watched_directories: [],
      excluded_patterns: [".git", "node_modules", ".DS_Store"],
      max_file_size_mb: 100,
      enable_recursive: true,
      scan_interval_seconds: 30
    },
    ui: {
      theme: "Auto",
      language: "en",
      enable_animations: true,
      compact_mode: false,
      default_view: "grid"
    },
    performance: {
      max_cpu_usage: 50,
      max_memory_usage_mb: 2048,
      enable_gpu_acceleration: false,
      processing_threads: 4,
      enable_background_processing: true,
      thermal_throttling: true
    },
    privacy: {
      enable_telemetry: false,
      enable_crash_reporting: false,
      local_processing_only: true,
      encrypt_sensitive_data: false,
      data_retention_days: 30
    }
  },
  
  systemInfo: {
    cpu_usage: 25.5,
    memory_usage: 65.2,
    memory_total: 16777216, // 16GB in KB
    memory_used: 10952204,
    disk_usage: 45.8,
    thermal_state: "Normal" as const,
    performance_profile: "Balanced" as const,
    network_usage: {
      bytes_received: 1024000,
      bytes_transmitted: 512000,
      packets_received: 1000,
      packets_transmitted: 800
    },
    processes: []
  },

  systemCapabilities: {
    cpu_cores: navigator.hardwareConcurrency || 8,
    total_memory_gb: 16,
    architecture: "x86_64",
    os: navigator.platform || "unknown",
    gpu_acceleration: false,
    recommended_max_threads: (navigator.hardwareConcurrency || 8) - 1,
    supports_background_processing: true
  },

  processingStatus: {
    total_processed: 0,
    queue_size: 0,
    current_processing: 0,
    errors: 0,
    average_processing_time_ms: 0
  }
};