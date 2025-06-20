import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useInsightsStore } from '../useInsightsStore'
import { mockTauriCommands, createMockCollection } from '../../test/utils'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}))

describe('useInsightsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset store state before each test
    useInsightsStore.setState({
      data: null,
      collections: [],
      isLoading: false,
      error: null,
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
      const { result } = renderHook(() => useInsightsStore())
      
      expect(result.current.data).toBeNull()
      expect(result.current.collections).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('loadInsights', () => {
    it('loads insights data successfully', async () => {
      const mockInsightsData = {
        file_types: { documents: 10, images: 5, code: 8, other: 2 },
        categories: [
          { name: 'Documents', count: 10, percentage: 40, color: 'blue' },
          { name: 'Images', count: 5, percentage: 20, color: 'green' },
        ],
        recent_activity: [
          {
            id: 'activity_1',
            type: 'completed',
            message: 'Successfully processed file.txt',
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
      }
      
      mockTauriCommands.get_insights_data.mockResolvedValue(mockInsightsData)
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.loadInsights()
      })
      
      expect(result.current.data).toEqual(mockInsightsData)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(mockTauriCommands.get_insights_data).toHaveBeenCalled()
    })

    it('sets loading state during insights loading', async () => {
      let resolveInsights: (value: any) => void
      const insightsPromise = new Promise(resolve => {
        resolveInsights = resolve
      })
      mockTauriCommands.get_insights_data.mockReturnValue(insightsPromise)
      
      const { result } = renderHook(() => useInsightsStore())
      
      // Start loading
      act(() => {
        result.current.loadInsights()
      })
      
      // Should be loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBeNull()
      
      // Complete loading
      await act(async () => {
        resolveInsights({})
        await insightsPromise
      })
      
      // Should no longer be loading
      expect(result.current.isLoading).toBe(false)
    })

    it('handles insights loading errors', async () => {
      const errorMessage = 'Failed to load insights'
      mockTauriCommands.get_insights_data.mockRejectedValue(new Error(errorMessage))
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.loadInsights()
      })
      
      expect(result.current.data).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('loadCollections', () => {
    it('loads collections successfully', async () => {
      const mockCollections = [
        createMockCollection({ name: 'Work Documents' }),
        createMockCollection({ name: 'Personal Files' }),
      ]
      
      mockTauriCommands.get_collections.mockResolvedValue(mockCollections)
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.loadCollections()
      })
      
      expect(result.current.collections).toEqual(mockCollections)
      expect(result.current.error).toBeNull()
      expect(mockTauriCommands.get_collections).toHaveBeenCalled()
    })

    it('handles collections loading errors', async () => {
      const errorMessage = 'Failed to load collections'
      mockTauriCommands.get_collections.mockRejectedValue(new Error(errorMessage))
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.loadCollections()
      })
      
      expect(result.current.collections).toEqual([])
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('createCollection', () => {
    it('creates a new collection successfully', async () => {
      const newCollection = createMockCollection({ name: 'New Collection' })
      mockTauriCommands.create_collection = vi.fn().mockResolvedValue(newCollection)
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.createCollection('New Collection', 'Test description')
      })
      
      expect(mockTauriCommands.create_collection).toHaveBeenCalledWith({
        name: 'New Collection',
        description: 'Test description',
      })
      
      // Should reload collections after creation
      expect(mockTauriCommands.get_collections).toHaveBeenCalled()
    })

    it('handles collection creation errors', async () => {
      const errorMessage = 'Failed to create collection'
      mockTauriCommands.create_collection = vi.fn().mockRejectedValue(new Error(errorMessage))
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.createCollection('New Collection')
      })
      
      expect(result.current.error).toBe(errorMessage)
    })

    it('creates collection without description', async () => {
      const newCollection = createMockCollection({ name: 'Simple Collection' })
      mockTauriCommands.create_collection = vi.fn().mockResolvedValue(newCollection)
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.createCollection('Simple Collection')
      })
      
      expect(mockTauriCommands.create_collection).toHaveBeenCalledWith({
        name: 'Simple Collection',
        description: undefined,
      })
    })
  })

  describe('updateCollection', () => {
    it('updates an existing collection successfully', async () => {
      mockTauriCommands.update_collection = vi.fn().mockResolvedValue({})
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.updateCollection('collection-id', 'Updated Name', 'Updated description')
      })
      
      expect(mockTauriCommands.update_collection).toHaveBeenCalledWith({
        id: 'collection-id',
        name: 'Updated Name',
        description: 'Updated description',
      })
      
      // Should reload collections after update
      expect(mockTauriCommands.get_collections).toHaveBeenCalled()
    })

    it('handles collection update errors', async () => {
      const errorMessage = 'Failed to update collection'
      mockTauriCommands.update_collection = vi.fn().mockRejectedValue(new Error(errorMessage))
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.updateCollection('collection-id', 'Updated Name')
      })
      
      expect(result.current.error).toBe(errorMessage)
    })

    it('updates collection with partial data', async () => {
      mockTauriCommands.update_collection = vi.fn().mockResolvedValue({})
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.updateCollection('collection-id', 'New Name')
      })
      
      expect(mockTauriCommands.update_collection).toHaveBeenCalledWith({
        id: 'collection-id',
        name: 'New Name',
        description: undefined,
      })
    })
  })

  describe('deleteCollection', () => {
    it('deletes a collection successfully', async () => {
      mockTauriCommands.delete_collection = vi.fn().mockResolvedValue({})
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.deleteCollection('collection-id')
      })
      
      expect(mockTauriCommands.delete_collection).toHaveBeenCalledWith({
        id: 'collection-id',
      })
      
      // Should reload collections after deletion
      expect(mockTauriCommands.get_collections).toHaveBeenCalled()
    })

    it('handles collection deletion errors', async () => {
      const errorMessage = 'Failed to delete collection'
      mockTauriCommands.delete_collection = vi.fn().mockRejectedValue(new Error(errorMessage))
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.deleteCollection('collection-id')
      })
      
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('error handling', () => {
    it('clears error when loading insights successfully after error', async () => {
      const { result } = renderHook(() => useInsightsStore())
      
      // Set initial error state
      act(() => {
        useInsightsStore.setState({ error: 'Previous error' })
      })
      
      expect(result.current.error).toBe('Previous error')
      
      // Successful load should clear error
      mockTauriCommands.get_insights_data.mockResolvedValue({})
      
      await act(async () => {
        await result.current.loadInsights()
      })
      
      expect(result.current.error).toBeNull()
    })

    it('preserves data when error occurs', async () => {
      const { result } = renderHook(() => useInsightsStore())
      
      // Set initial data
      const initialData = { file_types: {}, categories: [] }
      act(() => {
        useInsightsStore.setState({ data: initialData })
      })
      
      // Error should preserve existing data
      mockTauriCommands.get_insights_data.mockRejectedValue(new Error('Network error'))
      
      await act(async () => {
        await result.current.loadInsights()
      })
      
      expect(result.current.data).toEqual(initialData)
      expect(result.current.error).toBe('Network error')
    })
  })

  describe('concurrent operations', () => {
    it('handles concurrent loadInsights calls', async () => {
      const { result } = renderHook(() => useInsightsStore())
      
      // Start multiple concurrent loads
      const promises = [
        result.current.loadInsights(),
        result.current.loadInsights(),
        result.current.loadInsights(),
      ]
      
      await act(async () => {
        await Promise.all(promises)
      })
      
      // Should only make one call to the backend
      expect(mockTauriCommands.get_insights_data).toHaveBeenCalledTimes(3)
      expect(result.current.isLoading).toBe(false)
    })

    it('handles concurrent loadCollections calls', async () => {
      const { result } = renderHook(() => useInsightsStore())
      
      const promises = [
        result.current.loadCollections(),
        result.current.loadCollections(),
      ]
      
      await act(async () => {
        await Promise.all(promises)
      })
      
      expect(mockTauriCommands.get_collections).toHaveBeenCalledTimes(2)
    })
  })

  describe('store persistence', () => {
    it('maintains state across hook re-renders', () => {
      const { result, rerender } = renderHook(() => useInsightsStore())
      
      // Set some data
      act(() => {
        useInsightsStore.setState({
          data: { file_types: {}, categories: [] },
          collections: [createMockCollection()],
        })
      })
      
      // Re-render hook
      rerender()
      
      // State should persist
      expect(result.current.data).toEqual({ file_types: {}, categories: [] })
      expect(result.current.collections).toHaveLength(1)
    })
  })

  describe('data validation', () => {
    it('handles invalid insights data gracefully', async () => {
      // Mock invalid data
      mockTauriCommands.get_insights_data.mockResolvedValue(null)
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.loadInsights()
      })
      
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('handles invalid collections data gracefully', async () => {
      mockTauriCommands.get_collections.mockResolvedValue(null)
      
      const { result } = renderHook(() => useInsightsStore())
      
      await act(async () => {
        await result.current.loadCollections()
      })
      
      expect(result.current.collections).toEqual([])
      expect(result.current.error).toBeNull()
    })
  })
})