import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSearchStore } from '../useSearchStore'
import { mockTauriCommands, createMockSearchResults } from '../../test/utils'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}))

describe('useSearchStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset store state before each test
    useSearchStore.setState({
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
      aiAvailable: false,
      lastSearchType: 'unknown',
      totalResults: 0,
      currentPage: 1,
      itemsPerPage: 20,
    })
    
    // Setup default mock implementations
    const { invoke } = require('@tauri-apps/api/tauri')
    invoke.mockImplementation((command: string, args?: any) => {
      if (mockTauriCommands[command as keyof typeof mockTauriCommands]) {
        return mockTauriCommands[command as keyof typeof mockTauriCommands](args)
      }
      return Promise.resolve()
    })
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const { result } = renderHook(() => useSearchStore())
      
      expect(result.current.query).toBe('')
      expect(result.current.results).toEqual([])
      expect(result.current.suggestions).toEqual([])
      expect(result.current.isSearching).toBe(false)
      expect(result.current.aiAvailable).toBe(false)
      expect(result.current.lastSearchType).toBe('unknown')
      expect(result.current.currentPage).toBe(1)
      expect(result.current.itemsPerPage).toBe(20)
    })
  })

  describe('search functionality', () => {
    it('performs basic search successfully', async () => {
      const mockResults = createMockSearchResults(3)
      mockTauriCommands.search_files.mockResolvedValue(mockResults)
      
      const { result } = renderHook(() => useSearchStore())
      
      await act(async () => {
        await result.current.search('test query')
      })
      
      expect(result.current.query).toBe('test query')
      expect(result.current.results).toEqual(mockResults)
      expect(result.current.isSearching).toBe(false)
      expect(result.current.lastSearchType).toBe('regular')
    })

    it('handles semantic search when AI is available', async () => {
      const mockResults = createMockSearchResults(2)
      mockTauriCommands.search_files.mockResolvedValue(mockResults)
      mockTauriCommands.check_ai_availability.mockResolvedValue(true)
      
      const { result } = renderHook(() => useSearchStore())
      
      // First check AI availability
      await act(async () => {
        await result.current.checkAiAvailability()
      })
      
      // Then perform search
      await act(async () => {
        await result.current.search('semantic query')
      })
      
      expect(result.current.aiAvailable).toBe(true)
      expect(result.current.lastSearchType).toBe('semantic')
    })

    it('sets loading state during search', async () => {
      let resolveSearch: (value: any) => void
      const searchPromise = new Promise(resolve => {
        resolveSearch = resolve
      })
      mockTauriCommands.search_files.mockReturnValue(searchPromise)
      
      const { result } = renderHook(() => useSearchStore())
      
      // Start search
      act(() => {
        result.current.search('loading test')
      })
      
      // Should be loading
      expect(result.current.isSearching).toBe(true)
      
      // Complete search
      await act(async () => {
        resolveSearch([])
        await searchPromise
      })
      
      // Should no longer be loading
      expect(result.current.isSearching).toBe(false)
    })

    it('handles search errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockTauriCommands.search_files.mockRejectedValue(new Error('Search failed'))
      
      const { result } = renderHook(() => useSearchStore())
      
      await act(async () => {
        await result.current.search('error query')
      })
      
      expect(result.current.isSearching).toBe(false)
      expect(result.current.results).toEqual([])
      expect(consoleError).toHaveBeenCalledWith('Search error:', expect.any(Error))
      
      consoleError.mockRestore()
    })

    it('clears search results and query', () => {
      const { result } = renderHook(() => useSearchStore())
      
      // Set some state first
      act(() => {
        useSearchStore.setState({
          query: 'test',
          results: createMockSearchResults(2),
          totalResults: 2,
          currentPage: 2,
        })
      })
      
      act(() => {
        result.current.clearSearch()
      })
      
      expect(result.current.query).toBe('')
      expect(result.current.results).toEqual([])
      expect(result.current.totalResults).toBe(0)
      expect(result.current.currentPage).toBe(1)
    })
  })

  describe('suggestions', () => {
    it('gets search suggestions', async () => {
      const mockSuggestions = ['suggestion 1', 'suggestion 2']
      mockTauriCommands.search_files.mockResolvedValue(createMockSearchResults(2))
      
      const { result } = renderHook(() => useSearchStore())
      
      await act(async () => {
        await result.current.getSuggestions('test')
      })
      
      // Suggestions are generated from search results
      expect(result.current.suggestions.length).toBeGreaterThan(0)
    })

    it('handles suggestion errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockTauriCommands.search_files.mockRejectedValue(new Error('Suggestions failed'))
      
      const { result } = renderHook(() => useSearchStore())
      
      await act(async () => {
        await result.current.getSuggestions('error')
      })
      
      expect(result.current.suggestions).toEqual([])
      expect(consoleError).toHaveBeenCalled()
      
      consoleError.mockRestore()
    })
  })

  describe('filters', () => {
    it('sets search filters', () => {
      const { result } = renderHook(() => useSearchStore())
      
      const newFilters = {
        type: 'pdf',
        dateRange: 'last-week',
        sizeRange: '1-10mb',
        tags: ['document', 'important'],
      }
      
      act(() => {
        result.current.setFilters(newFilters)
      })
      
      expect(result.current.filters).toEqual(newFilters)
    })

    it('merges filters with existing ones', () => {
      const { result } = renderHook(() => useSearchStore())
      
      // Set initial filters
      act(() => {
        result.current.setFilters({ type: 'pdf', dateRange: 'last-week' })
      })
      
      // Update only type
      act(() => {
        result.current.setFilters({ type: 'image' })
      })
      
      expect(result.current.filters.type).toBe('image')
      expect(result.current.filters.dateRange).toBe('last-week')
    })
  })

  describe('pagination', () => {
    it('navigates to next page', () => {
      const { result } = renderHook(() => useSearchStore())
      
      // Set some results to enable pagination
      act(() => {
        useSearchStore.setState({
          totalResults: 50,
          currentPage: 1,
          itemsPerPage: 20,
        })
      })
      
      act(() => {
        result.current.nextPage()
      })
      
      expect(result.current.currentPage).toBe(2)
    })

    it('navigates to previous page', () => {
      const { result } = renderHook(() => useSearchStore())
      
      // Set current page to 2
      act(() => {
        useSearchStore.setState({
          currentPage: 2,
        })
      })
      
      act(() => {
        result.current.prevPage()
      })
      
      expect(result.current.currentPage).toBe(1)
    })

    it('does not go below page 1', () => {
      const { result } = renderHook(() => useSearchStore())
      
      act(() => {
        result.current.prevPage()
      })
      
      expect(result.current.currentPage).toBe(1)
    })

    it('does not exceed maximum pages', () => {
      const { result } = renderHook(() => useSearchStore())
      
      // Set state where we're already at max page
      act(() => {
        useSearchStore.setState({
          totalResults: 20,
          currentPage: 1,
          itemsPerPage: 20,
        })
      })
      
      act(() => {
        result.current.nextPage()
      })
      
      // Should not advance past page 1 (only 1 page of results)
      expect(result.current.currentPage).toBe(1)
    })
  })

  describe('AI availability', () => {
    it('checks AI availability successfully', async () => {
      mockTauriCommands.check_ai_availability.mockResolvedValue(true)
      
      const { result } = renderHook(() => useSearchStore())
      
      await act(async () => {
        await result.current.checkAiAvailability()
      })
      
      expect(result.current.aiAvailable).toBe(true)
    })

    it('handles AI availability check failure', async () => {
      mockTauriCommands.check_ai_availability.mockRejectedValue(new Error('AI check failed'))
      
      const { result } = renderHook(() => useSearchStore())
      
      await act(async () => {
        await result.current.checkAiAvailability()
      })
      
      expect(result.current.aiAvailable).toBe(false)
    })
  })

  describe('search type detection', () => {
    it('detects file service search for empty queries', async () => {
      mockTauriCommands.search_files.mockResolvedValue([])
      
      const { result } = renderHook(() => useSearchStore())
      
      await act(async () => {
        await result.current.search('')
      })
      
      expect(result.current.lastSearchType).toBe('all_files')
    })

    it('detects semantic search when AI is available and query is complex', async () => {
      mockTauriCommands.check_ai_availability.mockResolvedValue(true)
      mockTauriCommands.search_files.mockResolvedValue([])
      
      const { result } = renderHook(() => useSearchStore())
      
      // Enable AI
      await act(async () => {
        await result.current.checkAiAvailability()
      })
      
      // Perform complex search
      await act(async () => {
        await result.current.search('find documents about machine learning from last month')
      })
      
      expect(result.current.lastSearchType).toBe('semantic')
    })

    it('detects regular search for simple queries when AI is available', async () => {
      mockTauriCommands.check_ai_availability.mockResolvedValue(true)
      mockTauriCommands.search_files.mockResolvedValue([])
      
      const { result } = renderHook(() => useSearchStore())
      
      // Enable AI
      await act(async () => {
        await result.current.checkAiAvailability()
      })
      
      // Perform simple search
      await act(async () => {
        await result.current.search('test.pdf')
      })
      
      expect(result.current.lastSearchType).toBe('regular')
    })
  })
})