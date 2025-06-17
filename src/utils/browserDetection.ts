// Browser-based system detection utilities

export interface BrowserSystemInfo {
  cpu_cores: number;
  total_memory_gb: number | null;
  architecture: string;
  os: string;
  browser: string;
  gpu_acceleration: boolean;
  recommended_max_threads: number;
  supports_background_processing: boolean;
  estimated_performance_tier: 'low' | 'medium' | 'high';
}

/**
 * Detect real system information from browser APIs
 */
export async function detectBrowserSystemInfo(): Promise<BrowserSystemInfo> {
  // CPU Detection
  const cpuCores = navigator.hardwareConcurrency || 4;
  
  // Memory Detection (if available)
  let memoryGB: number | null = null;
  try {
    // @ts-ignore - deviceMemory is not in all TypeScript definitions yet
    if ('deviceMemory' in navigator) {
      // @ts-ignore
      memoryGB = navigator.deviceMemory;
    }
  } catch (e) {
    // deviceMemory not available
  }
  
  // OS Detection from user agent
  const userAgent = navigator.userAgent;
  let os = 'Unknown';
  let architecture = 'Unknown';
  
  if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
    if (userAgent.includes('Intel')) {
      architecture = 'x86_64';
    } else {
      architecture = 'arm64'; // Apple Silicon
    }
  } else if (userAgent.includes('Windows')) {
    os = 'Windows';
    architecture = userAgent.includes('WOW64') || userAgent.includes('Win64') ? 'x86_64' : 'x86';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
    architecture = userAgent.includes('x86_64') ? 'x86_64' : 'x86';
  } else if (userAgent.includes('CrOS')) {
    os = 'Chrome OS';
    architecture = 'x86_64';
  }
  
  // If still unknown, fallback to navigator.platform
  if (os === 'Unknown') {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) {
      os = 'macOS';
      architecture = 'x86_64';
    } else if (platform.includes('win')) {
      os = 'Windows';
      architecture = 'x86_64';
    } else if (platform.includes('linux')) {
      os = 'Linux';
      architecture = 'x86_64';
    }
  }
  
  // Browser Detection
  let browser = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  }
  
  // GPU Detection
  let gpuAcceleration = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      gpuAcceleration = debugInfo !== null;
    }
  } catch (e) {
    // WebGL not available
  }
  
  // Performance Tier Estimation
  let performanceTier: 'low' | 'medium' | 'high' = 'medium';
  
  const memoryScore = memoryGB ? Math.min(memoryGB / 8, 1) : 0.5; // Normalize to 8GB
  const cpuScore = Math.min(cpuCores / 8, 1); // Normalize to 8 cores
  const overallScore = (memoryScore + cpuScore) / 2;
  
  if (overallScore < 0.4) {
    performanceTier = 'low';
  } else if (overallScore > 0.7) {
    performanceTier = 'high';
  }
  
  return {
    cpu_cores: cpuCores,
    total_memory_gb: memoryGB,
    architecture,
    os,
    browser,
    gpu_acceleration: gpuAcceleration,
    recommended_max_threads: Math.max(1, cpuCores - 1),
    supports_background_processing: 'serviceWorker' in navigator,
    estimated_performance_tier: performanceTier
  };
}

/**
 * Get performance recommendations based on detected system
 */
export function getPerformanceRecommendations(systemInfo: BrowserSystemInfo) {
  const { cpu_cores, total_memory_gb, estimated_performance_tier } = systemInfo;
  
  let maxCpuUsage: number;
  let maxMemoryMB: number;
  let processingThreads: number;
  
  switch (estimated_performance_tier) {
    case 'low':
      maxCpuUsage = 30;
      maxMemoryMB = 1024; // 1GB
      processingThreads = Math.max(1, Math.floor(cpu_cores / 2));
      break;
    case 'high':
      maxCpuUsage = 70;
      maxMemoryMB = total_memory_gb ? total_memory_gb * 1024 * 0.6 : 4096; // 60% of RAM or 4GB
      processingThreads = Math.max(2, cpu_cores - 1);
      break;
    default: // medium
      maxCpuUsage = 50;
      maxMemoryMB = total_memory_gb ? total_memory_gb * 1024 * 0.4 : 2048; // 40% of RAM or 2GB
      processingThreads = Math.max(1, Math.floor(cpu_cores * 0.75));
  }
  
  return {
    maxCpuUsage,
    maxMemoryMB,
    processingThreads,
    enableGpu: systemInfo.gpu_acceleration,
    thermalThrottling: estimated_performance_tier === 'low',
    backgroundProcessing: systemInfo.supports_background_processing
  };
}

/**
 * Format system info for display
 */
export function formatSystemInfoForDisplay(systemInfo: BrowserSystemInfo) {
  return {
    'CPU Cores': systemInfo.cpu_cores.toString(),
    'Memory': systemInfo.total_memory_gb 
      ? `${systemInfo.total_memory_gb} GB` 
      : 'Not detectable in browser',
    'Architecture': systemInfo.architecture,
    'Operating System': systemInfo.os,
    'Browser': systemInfo.browser,
    'GPU Acceleration': systemInfo.gpu_acceleration ? 'Available' : 'Not detected',
    'Background Processing': systemInfo.supports_background_processing ? 'Supported' : 'Not supported',
    'Performance Tier': systemInfo.estimated_performance_tier.charAt(0).toUpperCase() + 
                       systemInfo.estimated_performance_tier.slice(1)
  };
}