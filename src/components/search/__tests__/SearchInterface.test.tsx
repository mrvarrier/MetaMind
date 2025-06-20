import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../../test/utils'
import { SearchInterface } from '../SearchInterface'
import { useSearchStore } from '../../../stores/useSearchStore'
import { mockTauriCommands } from '../../../test/utils'

// Mock the search store
vi.mock('../../../stores/useSearchStore')

// Mock SearchResults and SearchFilters components
vi.mock('../SearchResults', () => ({
  SearchResults: () => <div data-testid="search-results">Search Results</div>
}))

vi.mock('../SearchFilters', () => ({
  SearchFilters: () => <div data-testid="search-filters">Search Filters</div>
}))

describe('SearchInterface Component', () => {
  const mockSearchStore = {
    query: '',
    suggestions: [],
    isSearching: false,
    aiAvailable: true,
    lastSearchType: 'unknown' as const,
    search: vi.fn(),
    getSuggestions: vi.fn(),
    clearSearch: vi.fn(),
    checkAiAvailability: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSearchStore).mockReturnValue(mockSearchStore)
    
    // Reset mock Tauri commands
    Object.values(mockTauriCommands).forEach(mock => {
      if (vi.isMockFunction(mock)) {
        mock.mockClear()
      }
    })
  })

  it('renders the search interface with all main elements', () => {
    render(<SearchInterface />)
    
    // Check for main elements
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Search through your files using natural language')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search files with natural language...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
  })

  it('shows AI Enhanced status when AI is available', () => {
    render(<SearchInterface />)
    
    expect(screen.getByText('AI Enhanced')).toBeInTheDocument()
    const statusIndicator = screen.getByText('AI Enhanced').previousElementSibling
    expect(statusIndicator).toHaveClass('bg-green-400')
  })

  it('shows Basic Search status when AI is not available', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      aiAvailable: false,
    })
    
    render(<SearchInterface />)
    
    expect(screen.getByText('Basic Search')).toBeInTheDocument()
    const statusIndicator = screen.getByText('Basic Search').previousElementSibling
    expect(statusIndicator).toHaveClass('bg-yellow-400')
  })

  it('handles search input changes', async () => {
    render(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    fireEvent.change(searchInput, { target: { value: 'test query' } })
    
    expect(searchInput).toHaveValue('test query')
    
    // Should call getSuggestions after debounce
    await waitFor(() => {
      expect(mockSearchStore.getSuggestions).toHaveBeenCalledWith('test query')
    })
  })

  it('handles search submission on Enter key', () => {
    render(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    fireEvent.change(searchInput, { target: { value: 'test search' } })
    fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter' })
    
    expect(mockSearchStore.search).toHaveBeenCalledWith('test search')
  })

  it('handles search submission on button click', () => {
    render(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    const searchButton = screen.getByRole('button', { name: /search/i })
    
    fireEvent.change(searchInput, { target: { value: 'button search' } })
    fireEvent.click(searchButton)
    
    expect(mockSearchStore.search).toHaveBeenCalledWith('button search')
  })

  it('disables search button when input is empty', () => {
    render(<SearchInterface />)
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    expect(searchButton).toBeDisabled()
  })

  it('disables search button when searching', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      isSearching: true,
    })
    
    render(<SearchInterface />)
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    expect(searchButton).toBeDisabled()
  })

  it('shows loading state when searching', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      isSearching: true,
    })
    
    render(<SearchInterface />)
    
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
  })

  it('clears search input and results', () => {
    render(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    
    const clearButton = screen.getByRole('button', { name: '' }) // Clear button has no text, just an X icon
    fireEvent.click(clearButton)
    
    expect(mockSearchStore.clearSearch).toHaveBeenCalled()
  })

  it('toggles filters panel', () => {
    render(<SearchInterface />)
    
    const filtersButton = screen.getByRole('button', { name: /filters/i })
    fireEvent.click(filtersButton)
    
    expect(screen.getByTestId('search-filters')).toBeInTheDocument()
  })

  it('displays search suggestions when available', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      suggestions: ['test suggestion 1', 'test suggestion 2'],
    })
    
    render(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    fireEvent.focus(searchInput)
    
    expect(screen.getByText('test suggestion 1')).toBeInTheDocument()
    expect(screen.getByText('test suggestion 2')).toBeInTheDocument()
  })

  it('handles suggestion clicks', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      suggestions: ['clicked suggestion'],
    })
    
    render(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    fireEvent.focus(searchInput)
    
    const suggestion = screen.getByText('clicked suggestion')
    fireEvent.click(suggestion)
    
    expect(mockSearchStore.search).toHaveBeenCalledWith('clicked suggestion')
  })

  it('shows example searches when no query is present', () => {
    render(<SearchInterface />)
    
    expect(screen.getByText('Try searching with natural language:')).toBeInTheDocument()
    expect(screen.getByText('photos from last week')).toBeInTheDocument()
    expect(screen.getByText('PDF documents about project')).toBeInTheDocument()
  })

  it('handles example search clicks', () => {
    render(<SearchInterface />)
    
    const exampleButton = screen.getByText('photos from last week')
    fireEvent.click(exampleButton)
    
    expect(mockSearchStore.search).toHaveBeenCalledWith('photos from last week')
  })

  it('shows search results when query exists', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      query: 'test query',
    })
    
    render(<SearchInterface />)
    
    expect(screen.getByTestId('search-results')).toBeInTheDocument()
  })

  it('shows empty state when no query exists', () => {
    render(<SearchInterface />)
    
    expect(screen.getByText('Start Searching')).toBeInTheDocument()
    expect(screen.getByText('Use natural language to find your files. MetaMind understands context and meaning.')).toBeInTheDocument()
  })

  it('handles Escape key to close suggestions', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      suggestions: ['test suggestion'],
    })
    
    render(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    fireEvent.focus(searchInput)
    fireEvent.keyPress(searchInput, { key: 'Escape', code: 'Escape' })
    
    // Suggestions should be hidden (component manages this state internally)
    expect(screen.queryByText('test suggestion')).not.toBeInTheDocument()
  })

  it('refreshes AI availability when button is clicked', () => {
    render(<SearchInterface />)
    
    const refreshButton = screen.getByTitle('Refresh AI status')
    fireEvent.click(refreshButton)
    
    expect(mockSearchStore.checkAiAvailability).toHaveBeenCalled()
  })

  it('shows last search type when available', () => {
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      lastSearchType: 'semantic',
    })
    
    render(<SearchInterface />)
    
    expect(screen.getByText('Last: AI')).toBeInTheDocument()
  })

  it('calls search with empty string on mount to load all files', () => {
    render(<SearchInterface />)
    
    expect(mockSearchStore.search).toHaveBeenCalledWith('')
  })

  it('syncs search input with store query', () => {
    const { rerender } = render(<SearchInterface />)
    
    // Update the store query
    vi.mocked(useSearchStore).mockReturnValue({
      ...mockSearchStore,
      query: 'updated query',
    })
    
    rerender(<SearchInterface />)
    
    const searchInput = screen.getByPlaceholderText('Search files with natural language...')
    expect(searchInput).toHaveValue('updated query')
  })
})