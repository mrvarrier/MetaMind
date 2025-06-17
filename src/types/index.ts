// Core system types
export interface SystemInfo {
  cpu_usage: number;
  memory_usage: number;
  memory_total: number;
  memory_used: number;
  disk_usage: DiskInfo[];
  gpu_info?: GpuInfo;
  thermal_state: ThermalState;
  performance_profile: PerformanceProfile;
  network_usage: NetworkUsage;
  processes: ProcessInfo[];
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_space: number;
  available_space: number;
  used_space: number;
  usage_percentage: number;
}

export interface GpuInfo {
  name: string;
  vendor: string;
  memory_total?: number;
  memory_used?: number;
  temperature?: number;
  utilization?: number;
}

export type ThermalState = 'Normal' | 'Fair' | 'Serious' | 'Critical';
export type PerformanceProfile = 'PowerSaver' | 'Balanced' | 'HighPerformance' | 'Gaming';

export interface NetworkUsage {
  bytes_received: number;
  bytes_transmitted: number;
  packets_received: number;
  packets_transmitted: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_usage: number;
}

// File system types
export interface FileRecord {
  id: string;
  path: string;
  name: string;
  extension?: string;
  size: number;
  created_at: string;
  modified_at: string;
  last_accessed?: string;
  mime_type?: string;
  hash?: string;
  tags?: string;
  metadata?: string;
  ai_analysis?: string;
  embedding?: number[];
  indexed_at?: string;
  processing_status: ProcessingStatus;
  error_message?: string;
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface SearchResult {
  file: FileRecord;
  score: number;
  snippet?: string;
  highlights: string[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  rules?: string;
  insights?: string;
}

// AI analysis types
export interface AIAnalysis {
  summary: string;
  tags: string[];
  category: string;
  sentiment?: number;
  key_entities: string[];
  topics: string[];
  language?: string;
  confidence: number;
  embedding?: number[];
  metadata: Record<string, any>;
}

// Search types
export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  file_types?: string[];
  size_range?: SizeRange;
  date_range?: DateRange;
  tags?: string[];
  categories?: string[];
}

export interface SizeRange {
  min?: number;
  max?: number;
}

export interface DateRange {
  start?: string;
  end?: string;
}

// Configuration types
export interface AppConfig {
  version: string;
  ai: AIConfig;
  search: SearchConfig;
  monitoring: MonitoringConfig;
  ui: UIConfig;
  performance: PerformanceConfig;
  privacy: PrivacyConfig;
}

export interface AIConfig {
  primary_provider: AIProvider;
  fallback_provider?: AIProvider;
  ollama_url: string;
  model_preferences: ModelPreferences;
  processing_queue_size: number;
  batch_size: number;
  timeout_seconds: number;
}

export type AIProvider = 
  | { Ollama: { model: string; url: string } }
  | { OpenAI: { api_key: string; model: string } }
  | { Anthropic: { api_key: string; model: string } };

export interface ModelPreferences {
  text_analysis: string;
  image_analysis: string;
  document_analysis: string;
  code_analysis: string;
  embedding_model: string;
}

export interface SearchConfig {
  max_results: number;
  enable_semantic_search: boolean;
  enable_fuzzy_search: boolean;
  cache_size: number;
  index_batch_size: number;
}

export interface MonitoringConfig {
  watched_directories: string[];
  excluded_patterns: string[];
  max_file_size_mb: number;
  enable_recursive: boolean;
  scan_interval_seconds: number;
}

export interface UIConfig {
  theme: Theme;
  language: string;
  enable_animations: boolean;
  compact_mode: boolean;
  default_view: string;
}

export type Theme = 'Light' | 'Dark' | 'Auto';

export interface PerformanceConfig {
  max_cpu_usage: number;
  max_memory_usage_mb: number;
  enable_gpu_acceleration: boolean;
  processing_threads: number;
  enable_background_processing: boolean;
  thermal_throttling: boolean;
}

export interface PrivacyConfig {
  enable_telemetry: boolean;
  enable_crash_reporting: boolean;
  local_processing_only: boolean;
  encrypt_sensitive_data: boolean;
  data_retention_days: number;
}

// UI State types
export interface OnboardingState {
  currentStep: OnboardingStep;
  systemAnalysis?: SystemAnalysis;
  selectedModel?: string;
  selectedFolders: { path: string; type: 'folder' | 'file' }[];
  performanceSettings?: PerformanceConfig;
  isComplete: boolean;
}

export type OnboardingStep = 
  | 'welcome'
  | 'system-analysis' 
  | 'model-selection'
  | 'folder-selection'
  | 'performance-setup'
  | 'completion';

export interface SystemAnalysis {
  cpu_cores: number;
  total_memory_gb: number;
  architecture: string;
  os: string;
  gpu_acceleration: boolean;
  recommended_max_threads: number;
  supports_background_processing: boolean;
}

export interface ProcessingStatus {
  total_processed: number;
  queue_size: number;
  current_processing: number;
  errors: number;
  average_processing_time_ms: number;
  last_processed_at?: string;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface InputProps extends BaseComponentProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

// Error types
export type AppError = 
  | { Database: string }
  | { FileSystem: string }
  | { AIProcessing: string }
  | { Search: string }
  | { Config: string }
  | { SystemMonitor: string }
  | { Serialization: string }
  | { Network: string }
  | { Permission: string }
  | { NotFound: string }
  | { InvalidInput: string }
  | { Internal: string };

// View modes
export type ViewMode = 'list' | 'grid' | 'timeline' | 'graph';

// Sorting options
export type SortOption = 
  | 'relevance'
  | 'name'
  | 'size'
  | 'modified'
  | 'created'
  | 'type';

export type SortDirection = 'asc' | 'desc';