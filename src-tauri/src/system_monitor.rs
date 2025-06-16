use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use sysinfo::{System, SystemExt, CpuExt, DiskExt, NetworkExt, ProcessExt};
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub memory_total: u64,
    pub memory_used: u64,
    pub disk_usage: Vec<DiskInfo>,
    pub gpu_info: Option<GpuInfo>,
    pub thermal_state: ThermalState,
    pub performance_profile: PerformanceProfile,
    pub network_usage: NetworkUsage,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub usage_percentage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub name: String,
    pub vendor: String,
    pub memory_total: Option<u64>,
    pub memory_used: Option<u64>,
    pub temperature: Option<f32>,
    pub utilization: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThermalState {
    Normal,
    Fair,
    Serious,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceProfile {
    PowerSaver,
    Balanced,
    HighPerformance,
    Gaming,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkUsage {
    pub bytes_received: u64,
    pub bytes_transmitted: u64,
    pub packets_received: u64,
    pub packets_transmitted: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemLoad {
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub disk_io: f32,
    pub network_io: f32,
    pub is_throttled: bool,
}

#[derive(Debug)]
pub struct SystemMonitor {
    system: Arc<RwLock<System>>,
    current_load: Arc<RwLock<SystemLoad>>,
    monitoring_active: Arc<RwLock<bool>>,
    performance_history: Arc<RwLock<Vec<SystemLoad>>>,
}

impl SystemMonitor {
    pub fn new() -> Self {
        let system = Arc::new(RwLock::new(System::new_all()));
        let current_load = Arc::new(RwLock::new(SystemLoad {
            cpu_usage: 0.0,
            memory_usage: 0.0,
            disk_io: 0.0,
            network_io: 0.0,
            is_throttled: false,
        }));
        let monitoring_active = Arc::new(RwLock::new(false));
        let performance_history = Arc::new(RwLock::new(Vec::new()));

        let monitor = Self {
            system,
            current_load,
            monitoring_active,
            performance_history,
        };

        // Start monitoring loop
        let system_clone = monitor.system.clone();
        let current_load_clone = monitor.current_load.clone();
        let monitoring_active_clone = monitor.monitoring_active.clone();
        let performance_history_clone = monitor.performance_history.clone();

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                let is_active = *monitoring_active_clone.read().await;
                if !is_active {
                    continue;
                }

                // Update system info
                {
                    let mut system = system_clone.write().await;
                    system.refresh_all();
                }

                // Calculate current load
                let load = {
                    let system = system_clone.read().await;
                    let cpu_usage = system.global_cpu_info().cpu_usage();
                    let memory_usage = (system.used_memory() as f32 / system.total_memory() as f32) * 100.0;
                    
                    SystemLoad {
                        cpu_usage,
                        memory_usage,
                        disk_io: 0.0, // Would be calculated from disk stats
                        network_io: 0.0, // Would be calculated from network stats
                        is_throttled: cpu_usage > 80.0 || memory_usage > 85.0,
                    }
                };

                // Update current load
                *current_load_clone.write().await = load.clone();

                // Add to history (keep last 100 readings)
                {
                    let mut history = performance_history_clone.write().await;
                    history.push(load);
                    if history.len() > 100 {
                        history.remove(0);
                    }
                }
            }
        });

        monitor
    }

    pub async fn start_monitoring(&self) -> AppResult<()> {
        *self.monitoring_active.write().await = true;
        Ok(())
    }

    pub async fn stop_monitoring(&self) -> AppResult<()> {
        *self.monitoring_active.write().await = false;
        Ok(())
    }

    pub async fn get_system_info(&self) -> serde_json::Value {
        let mut system = self.system.write().await;
        system.refresh_all();

        let cpu_usage = system.global_cpu_info().cpu_usage();
        let memory_total = system.total_memory();
        let memory_used = system.used_memory();
        let memory_usage = (memory_used as f32 / memory_total as f32) * 100.0;

        // Get disk information
        let disk_usage: Vec<DiskInfo> = system.disks().iter().map(|disk| {
            let total = disk.total_space();
            let available = disk.available_space();
            let used = total - available;
            let usage_percentage = if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 };

            DiskInfo {
                name: disk.name().to_string_lossy().to_string(),
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                total_space: total,
                available_space: available,
                used_space: used,
                usage_percentage,
            }
        }).collect();

        // Get network information
        let network_usage = {
            let mut bytes_received = 0;
            let mut bytes_transmitted = 0;
            let mut packets_received = 0;
            let mut packets_transmitted = 0;

            for (_, network) in system.networks() {
                bytes_received += network.received();
                bytes_transmitted += network.transmitted();
                packets_received += network.packets_received();
                packets_transmitted += network.packets_transmitted();
            }

            NetworkUsage {
                bytes_received,
                bytes_transmitted,
                packets_received,
                packets_transmitted,
            }
        };

        // Get top processes by CPU usage
        let mut processes: Vec<ProcessInfo> = system.processes()
            .iter()
            .map(|(pid, process)| ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_string(),
                cpu_usage: process.cpu_usage(),
                memory_usage: process.memory(),
            })
            .collect();

        processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
        processes.truncate(10); // Keep top 10

        let system_info = SystemInfo {
            cpu_usage,
            memory_usage,
            memory_total,
            memory_used,
            disk_usage,
            gpu_info: self.get_gpu_info().await,
            thermal_state: self.get_thermal_state(cpu_usage).await,
            performance_profile: self.get_performance_profile().await,
            network_usage,
            processes,
        };

        serde_json::to_value(system_info).unwrap_or_default()
    }

    pub async fn get_current_load(&self) -> SystemLoad {
        self.current_load.read().await.clone()
    }

    pub async fn should_throttle_processing(&self) -> bool {
        let load = self.current_load.read().await;
        load.is_throttled
    }

    pub async fn get_recommended_processing_threads(&self) -> usize {
        let load = self.current_load.read().await;
        let cpu_cores = num_cpus::get();
        
        if load.cpu_usage > 80.0 {
            // High CPU usage, use fewer threads
            (cpu_cores / 4).max(1)
        } else if load.cpu_usage > 50.0 {
            // Medium CPU usage, use half the cores
            (cpu_cores / 2).max(1)
        } else {
            // Low CPU usage, use most cores but leave some for system
            (cpu_cores * 3 / 4).max(1)
        }
    }

    pub async fn get_memory_pressure(&self) -> f32 {
        let load = self.current_load.read().await;
        load.memory_usage
    }

    pub async fn is_power_constrained(&self) -> bool {
        // Check if we're on battery power and low
        #[cfg(target_os = "macos")]
        {
            // Use macOS-specific power management APIs
            false // Placeholder
        }
        
        #[cfg(target_os = "windows")]
        {
            // Use Windows power management APIs
            false // Placeholder
        }
        
        #[cfg(target_os = "linux")]
        {
            // Check /sys/class/power_supply/
            false // Placeholder
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            false
        }
    }

    async fn get_gpu_info(&self) -> Option<GpuInfo> {
        // This would integrate with platform-specific GPU monitoring
        // For now, return a placeholder
        None
    }

    async fn get_thermal_state(&self, cpu_usage: f32) -> ThermalState {
        // Simple heuristic based on CPU usage
        // In a real implementation, this would check actual thermal sensors
        match cpu_usage {
            usage if usage > 90.0 => ThermalState::Critical,
            usage if usage > 75.0 => ThermalState::Serious,
            usage if usage > 50.0 => ThermalState::Fair,
            _ => ThermalState::Normal,
        }
    }

    async fn get_performance_profile(&self) -> PerformanceProfile {
        // This would check system power settings
        // For now, return a default
        PerformanceProfile::Balanced
    }

    pub async fn get_performance_history(&self) -> Vec<SystemLoad> {
        self.performance_history.read().await.clone()
    }

    pub async fn get_system_capabilities(&self) -> serde_json::Value {
        let system = self.system.read().await;
        let cpu_count = system.cpus().len();
        let total_memory = system.total_memory();
        
        serde_json::json!({
            "cpu_cores": cpu_count,
            "total_memory_gb": total_memory / (1024 * 1024 * 1024),
            "architecture": std::env::consts::ARCH,
            "os": std::env::consts::OS,
            "gpu_acceleration": self.supports_gpu_acceleration().await,
            "recommended_max_threads": self.get_recommended_processing_threads().await,
            "supports_background_processing": true,
        })
    }

    async fn supports_gpu_acceleration(&self) -> bool {
        // Check for GPU acceleration support
        #[cfg(target_os = "macos")]
        {
            // Check for Metal support
            true // Most modern Macs support Metal
        }
        
        #[cfg(target_os = "windows")]
        {
            // Check for DirectML/CUDA support
            false // Would need actual detection
        }
        
        #[cfg(target_os = "linux")]
        {
            // Check for CUDA/OpenCL support
            false // Would need actual detection
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            false
        }
    }

    pub async fn estimate_processing_time(&self, file_count: usize, average_file_size: u64) -> Duration {
        let current_load = self.current_load.read().await;
        let recommended_threads = self.get_recommended_processing_threads().await;
        
        // Base processing time per file (in milliseconds)
        let base_time_per_file = match average_file_size {
            size if size < 1024 * 1024 => 500,      // < 1MB: 500ms
            size if size < 10 * 1024 * 1024 => 2000, // < 10MB: 2s
            size if size < 100 * 1024 * 1024 => 5000, // < 100MB: 5s
            _ => 10000,                               // > 100MB: 10s
        };

        // Adjust for system load
        let load_multiplier = if current_load.cpu_usage > 80.0 {
            2.0
        } else if current_load.cpu_usage > 50.0 {
            1.5
        } else {
            1.0
        };

        // Adjust for parallel processing
        let parallel_files = (file_count as f64 / recommended_threads as f64).ceil() as u64;
        let total_time_ms = (parallel_files * base_time_per_file as u64) as f64 * load_multiplier;

        Duration::from_millis(total_time_ms as u64)
    }
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}