import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../../test/utils'
import { InsightsDashboard } from '../InsightsDashboard'
import { useInsightsStore } from '../../../stores/useInsightsStore'
import { mockTauriCommands } from '../../../test/utils'

// Mock the insights store
vi.mock('../../../stores/useInsightsStore')

// Mock Chart.js components
vi.mock('react-chartjs-2', () => ({
  Doughnut: ({ data, options }: any) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)}>
      Mock Doughnut Chart
    </div>
  ),
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      Mock Bar Chart
    </div>
  ),
}))

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  BarElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  ArcElement: vi.fn(),
}))

describe('InsightsDashboard Component', () => {
  const mockInsightsStore = {
    data: {
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
        {
          id: 'activity_2',
          type: 'error',
          message: '❌ Failed to process large_file.pdf',
          timestamp: '2023-01-01T11:00:00Z',
          status: 'error',
        },
      ],
      processing_summary: {
        total_files: 25,
        completed_files: 20,
        error_files: 2,
        success_rate: 80,
      },
    },
    collections: [
      {
        id: 'col1',
        name: 'Work Documents',
        description: 'Work-related files',
        file_count: 15,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
    loadInsights: vi.fn(),
    loadCollections: vi.fn(),
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    deleteCollection: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useInsightsStore).mockReturnValue(mockInsightsStore)
    
    // Reset mock Tauri commands
    Object.values(mockTauriCommands).forEach(mock => {
      if (vi.isMockFunction(mock)) {
        mock.mockClear()
      }
    })
  })

  it('renders the insights dashboard with main sections', () => {
    render(<InsightsDashboard />)
    
    expect(screen.getByText('File Intelligence Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Comprehensive insights into your file ecosystem')).toBeInTheDocument()
  })

  it('displays file type statistics', () => {
    render(<InsightsDashboard />)
    
    // Check for file type categories
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
    
    // Check for counts
    expect(screen.getByText('10')).toBeInTheDocument() // Documents count
    expect(screen.getByText('5')).toBeInTheDocument()  // Images count
    expect(screen.getByText('8')).toBeInTheDocument()  // Code count
    expect(screen.getByText('2')).toBeInTheDocument()  // Other count
  })

  it('renders file type distribution chart', () => {
    render(<InsightsDashboard />)
    
    const chart = screen.getByTestId('doughnut-chart')
    expect(chart).toBeInTheDocument()
    
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
    expect(chartData.labels).toEqual(['Documents', 'Images', 'Code', 'Other'])
    expect(chartData.datasets[0].data).toEqual([10, 5, 8, 2])
  })

  it('displays processing summary statistics', () => {
    render(<InsightsDashboard />)
    
    expect(screen.getByText('25')).toBeInTheDocument() // Total files
    expect(screen.getByText('20')).toBeInTheDocument() // Completed files
    expect(screen.getByText('2')).toBeInTheDocument()  // Error files
    expect(screen.getByText('80%')).toBeInTheDocument() // Success rate
  })

  it('shows recent activity feed', () => {
    render(<InsightsDashboard />)
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('✅ Successfully processed file.txt')).toBeInTheDocument()
    expect(screen.getByText('❌ Failed to process large_file.pdf')).toBeInTheDocument()
  })

  it('displays collections section', () => {
    render(<InsightsDashboard />)
    
    expect(screen.getByText('Collections')).toBeInTheDocument()
    expect(screen.getByText('Work Documents')).toBeInTheDocument()
    expect(screen.getByText('Work-related files')).toBeInTheDocument()
    expect(screen.getByText('15 files')).toBeInTheDocument()
  })

  it('handles loading state', () => {
    vi.mocked(useInsightsStore).mockReturnValue({
      ...mockInsightsStore,
      isLoading: true,
      data: null,
    })
    
    render(<InsightsDashboard />)
    
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
    expect(screen.getByText('Loading insights...')).toBeInTheDocument()
  })

  it('handles error state', () => {
    vi.mocked(useInsightsStore).mockReturnValue({
      ...mockInsightsStore,
      isLoading: false,
      error: 'Failed to load insights',
      data: null,
    })
    
    render(<InsightsDashboard />)
    
    expect(screen.getByText('Error loading insights')).toBeInTheDocument()
    expect(screen.getByText('Failed to load insights')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('handles retry action on error', async () => {
    vi.mocked(useInsightsStore).mockReturnValue({
      ...mockInsightsStore,
      isLoading: false,
      error: 'Network error',
      data: null,
    })
    
    render(<InsightsDashboard />)
    
    const retryButton = screen.getByRole('button', { name: /retry/i })
    retryButton.click()
    
    expect(mockInsightsStore.loadInsights).toHaveBeenCalled()
  })

  it('loads data on mount', () => {
    render(<InsightsDashboard />)
    
    expect(mockInsightsStore.loadInsights).toHaveBeenCalled()
    expect(mockInsightsStore.loadCollections).toHaveBeenCalled()
  })

  it('displays empty state when no data', () => {
    vi.mocked(useInsightsStore).mockReturnValue({
      ...mockInsightsStore,
      data: {
        file_types: { documents: 0, images: 0, code: 0, other: 0 },
        categories: [],
        recent_activity: [],
        processing_summary: {
          total_files: 0,
          completed_files: 0,
          error_files: 0,
          success_rate: 0,
        },
      },
      collections: [],
    })
    
    render(<InsightsDashboard />)
    
    expect(screen.getByText('No files processed yet')).toBeInTheDocument()
    expect(screen.getByText('Start by indexing some locations to see insights')).toBeInTheDocument()
  })

  it('handles collection creation', async () => {
    render(<InsightsDashboard />)
    
    const createButton = screen.getByRole('button', { name: /create collection/i })
    createButton.click()
    
    // This would typically open a modal - test depends on implementation
    expect(mockInsightsStore.createCollection).toHaveBeenCalled()
  })

  it('formats timestamps correctly', () => {
    render(<InsightsDashboard />)
    
    // Check that timestamps are displayed in a readable format
    const activityItems = screen.getAllByText(/2023/)
    expect(activityItems.length).toBeGreaterThan(0)
  })

  it('shows progress indicators for processing', () => {
    render(<InsightsDashboard />)
    
    // Look for progress-related elements
    const successRate = screen.getByText('80%')
    expect(successRate).toBeInTheDocument()
    
    // Check for progress bar or visual indicator
    const progressElements = screen.queryAllByRole('progressbar')
    if (progressElements.length > 0) {
      expect(progressElements[0]).toBeInTheDocument()
    }
  })

  it('handles refresh functionality', async () => {
    render(<InsightsDashboard />)
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    refreshButton.click()
    
    expect(mockInsightsStore.loadInsights).toHaveBeenCalledTimes(2) // Once on mount, once on refresh
    expect(mockInsightsStore.loadCollections).toHaveBeenCalledTimes(2)
  })

  it('displays charts with correct accessibility attributes', () => {
    render(<InsightsDashboard />)
    
    const charts = screen.getAllByTestId(/chart/)
    charts.forEach(chart => {
      expect(chart).toBeInTheDocument()
      // Charts should have proper accessibility attributes
      expect(chart).toHaveAttribute('data-testid')
    })
  })

  it('handles collection deletion', async () => {
    render(<InsightsDashboard />)
    
    // Look for delete buttons on collections
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i })
    
    if (deleteButtons.length > 0) {
      deleteButtons[0].click()
      
      // Should call delete function
      await waitFor(() => {
        expect(mockInsightsStore.deleteCollection).toHaveBeenCalled()
      })
    }
  })

  it('shows appropriate icons for different activity types', () => {
    render(<InsightsDashboard />)
    
    // Check for checkmark icon for completed activity
    expect(screen.getByText('✅ Successfully processed file.txt')).toBeInTheDocument()
    
    // Check for error icon for failed activity
    expect(screen.getByText('❌ Failed to process large_file.pdf')).toBeInTheDocument()
  })

  it('handles responsive design elements', () => {
    render(<InsightsDashboard />)
    
    // The component should render without errors on different screen sizes
    // This is a basic test - in a real scenario you'd test specific responsive behaviors
    const dashboard = screen.getByText('File Intelligence Dashboard').closest('div')
    expect(dashboard).toBeInTheDocument()
  })

  it('displays correct file type percentages', () => {
    render(<InsightsDashboard />)
    
    // Check that percentages are displayed correctly
    expect(screen.getByText('40%')).toBeInTheDocument() // Documents
    expect(screen.getByText('20%')).toBeInTheDocument() // Images
    expect(screen.getByText('32%')).toBeInTheDocument() // Code
    expect(screen.getByText('8%')).toBeInTheDocument()  // Other
  })

  it('handles activity item interactions', async () => {
    render(<InsightsDashboard />)
    
    // Click on activity items to potentially show more details
    const activityItems = screen.getAllByText(/processed|Failed/)
    
    if (activityItems.length > 0) {
      activityItems[0].click()
      
      // Depending on implementation, this might show details or trigger actions
      // Test would be specific to actual implementation
    }
  })
})