import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { vi } from 'vitest'

// Test data generators
export const createMockFileRecord = (overrides = {}) => ({
  id: 'test-file-1',
  path: '/test/path/file.txt',
  name: 'file.txt',
  extension: 'txt',
  size: 1024,
  created_at: new Date('2023-01-01'),
  modified_at: new Date('2023-01-02'),
  last_accessed: new Date('2023-01-03'),
  mime_type: 'text/plain',
  hash: 'test-hash-123',
  content: 'Test file content',
  tags: JSON.stringify(['document', 'text']),
  metadata: JSON.stringify({ author: 'Test Author' }),
  ai_analysis: 'This is a test document containing sample text.',
  embedding: null,
  indexed_at: new Date('2023-01-04'),
  processing_status: 'completed',
  error_message: null,
  ...overrides,
})

export const createMockCollection = (overrides = {}) => ({
  id: 'test-collection-1',
  name: 'Test Collection',
  description: 'A test collection for testing purposes',
  created_at: new Date('2023-01-01'),
  updated_at: new Date('2023-01-02'),
  file_count: 5,
  rules: null,
  insights: null,
  ...overrides,
})

export const createMockSearchResults = (count = 3) => {
  return Array.from({ length: count }, (_, i) => 
    createMockFileRecord({
      id: `test-file-${i + 1}`,
      name: `file-${i + 1}.txt`,
      path: `/test/path/file-${i + 1}.txt`,
    })
  )
}

// Mock implementations for Tauri commands
export const mockTauriCommands = {
  search_files: vi.fn().mockResolvedValue(createMockSearchResults()),
  get_file_by_path: vi.fn().mockResolvedValue(createMockFileRecord()),
  get_insights_data: vi.fn().mockResolvedValue({
    file_types: { documents: 10, images: 5, code: 8, other: 2 },
    categories: [
      { name: 'Documents', count: 10, percentage: 40, color: 'blue' },
      { name: 'Images', count: 5, percentage: 20, color: 'green' },
      { name: 'Code', count: 8, percentage: 32, color: 'purple' },
      { name: 'Other', count: 2, percentage: 8, color: 'gray' },
    ],
    recent_activity: [
      {
        id: 'activity_1',
        type: 'completed',
        message: '✅ Successfully processed file.txt',
        timestamp: '2023-01-01T12:00:00Z',
        status: 'completed',
      },
    ],
    processing_summary: {
      total_files: 25,
      completed_files: 20,
      error_files: 2,
      success_rate: 80,
    },
  }),
  get_collections: vi.fn().mockResolvedValue([createMockCollection()]),
  get_app_config: vi.fn().mockResolvedValue({
    version: '0.0.0',
    ai: {
      ollama_url: 'http://localhost:11434',
      model: 'llama3.1:8b',
      enabled: true,
      max_content_length: 1000000,
      timeout_seconds: 60,
    },
    performance: {
      max_concurrent_jobs: 4,
      max_file_size_mb: 100,
      enable_background_processing: true,
      adaptive_performance: true,
    },
    privacy: {
      local_processing_only: true,
      data_retention_days: 365,
      anonymous_analytics: false,
    },
    ui: {
      theme: 'auto',
      animations_enabled: true,
      compact_mode: false,
      show_file_previews: true,
    },
  }),
  check_ai_availability: vi.fn().mockResolvedValue(true),
  get_queue_status: vi.fn().mockResolvedValue({
    total_queued: 0,
    active_workers: 0,
    available_workers: 4,
    priority_breakdown: {},
    oldest_job_age_seconds: 0,
    average_retry_count: 0,
    processing_efficiency: 100,
  }),
  select_folder: vi.fn().mockResolvedValue('/test/selected/folder'),
  index_location: vi.fn().mockResolvedValue({ success: true }),
  get_location_stats: vi.fn().mockResolvedValue({
    total_files: 10,
    processed_files: 8,
    pending_files: 2,
    error_files: 0,
  }),
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add any custom options here if needed
}

export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  return render(ui, {
    // Add any providers here if needed (theme provider, etc.)
    ...options,
  })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Test assertions helpers
export const expectElementToBeInTheDocument = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument()
}

export const expectElementToHaveText = (element: HTMLElement | null, text: string) => {
  expect(element).toHaveTextContent(text)
}

export const expectElementToHaveClass = (element: HTMLElement | null, className: string) => {
  expect(element).toHaveClass(className)
}

// Async test helpers
export const waitForElementToAppear = async (getByTestId: any, testId: string) => {
  await expect(getByTestId(testId)).resolves.toBeInTheDocument()
}

export const waitForElementToDisappear = async (queryByTestId: any, testId: string) => {
  await expect(queryByTestId(testId)).resolves.toBeNull()
}

// Mock store states
export const createMockSearchStore = (overrides = {}) => ({
  query: '',
  results: [],
  suggestions: [],
  isSearching: false,
  filters: {
    type: '',
    dateRange: '',
    sizeRange: '',
    tags: [],
  },
  aiAvailable: true,
  lastSearchType: 'unknown' as const,
  totalResults: 0,
  currentPage: 1,
  itemsPerPage: 20,
  search: vi.fn(),
  getSuggestions: vi.fn(),
  setFilters: vi.fn(),
  clearSearch: vi.fn(),
  nextPage: vi.fn(),
  prevPage: vi.fn(),
  checkAiAvailability: vi.fn(),
  ...overrides,
})

export const createMockIndexStore = (overrides = {}) => ({
  locations: [],
  isIndexing: false,
  progress: 0,
  currentFile: '',
  error: null,
  addLocation: vi.fn(),
  removeLocation: vi.fn(),
  startIndexing: vi.fn(),
  stopIndexing: vi.fn(),
  getLocationStats: vi.fn(),
  ...overrides,
})

export const createMockInsightsStore = (overrides = {}) => ({
  data: null,
  collections: [],
  isLoading: false,
  error: null,
  loadInsights: vi.fn(),
  loadCollections: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  ...overrides,
})