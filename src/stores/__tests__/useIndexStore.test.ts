import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useIndexStore } from '../useIndexStore'
import { mockTauriCommands } from '../../test/utils'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}))

// Mock Tauri dialog
vi.mock('@tauri-apps/api/dialog', () => ({
  open: vi.fn(),
}))

describe('useIndexStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset store state before each test
    useIndexStore.setState({
      locations: [],
      isIndexing: false,
      progress: 0,
      currentFile: '',
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
    
    // Setup dialog mock
    const { open } = require('@tauri-apps/api/dialog')
    open.mockResolvedValue('/test/selected/folder')
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const { result } = renderHook(() => useIndexStore())
      
      expect(result.current.locations).toEqual([])
      expect(result.current.isIndexing).toBe(false)
      expect(result.current.progress).toBe(0)
      expect(result.current.currentFile).toBe('')
      expect(result.current.error).toBeNull()
    })
  })

  describe('addLocation', () => {
    it('opens folder selection dialog and adds location', async () => {
      const { open } = require('@tauri-apps/api/dialog')
      open.mockResolvedValue('/test/new/folder')
      
      mockTauriCommands.get_location_stats.mockResolvedValue({
        total_files: 100,
        processed_files: 80,
        pending_files: 15,
        error_files: 5,
      })
      
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(open).toHaveBeenCalledWith({
        directory: true,
        multiple: false,
        title: 'Select folder to index',
      })
      
      expect(result.current.locations).toHaveLength(1)
      expect(result.current.locations[0].path).toBe('/test/new/folder')
      expect(result.current.locations[0].stats).toEqual({
        total_files: 100,
        processed_files: 80,
        pending_files: 15,
        error_files: 5,
      })
    })

    it('handles cancelled folder selection', async () => {
      const { open } = require('@tauri-apps/api/dialog')
      open.mockResolvedValue(null) // User cancelled
      
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(result.current.locations).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })

    it('prevents adding duplicate locations', async () => {
      const { open } = require('@tauri-apps/api/dialog')
      open.mockResolvedValue('/test/existing/folder')
      
      mockTauriCommands.get_location_stats.mockResolvedValue({
        total_files: 50,
        processed_files: 40,
        pending_files: 10,
        error_files: 0,
      })
      
      const { result } = renderHook(() => useIndexStore())
      
      // Add location first time
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(result.current.locations).toHaveLength(1)
      
      // Try to add same location again
      await act(async () => {
        await result.current.addLocation()
      })
      
      // Should still only have one location
      expect(result.current.locations).toHaveLength(1)
    })

    it('handles errors when getting location stats', async () => {
      const { open } = require('@tauri-apps/api/dialog')
      open.mockResolvedValue('/test/error/folder')
      
      mockTauriCommands.get_location_stats.mockRejectedValue(new Error('Stats error'))
      
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(result.current.error).toBe('Stats error')
      expect(result.current.locations).toHaveLength(0)
    })
  })

  describe('removeLocation', () => {
    it('removes location by path', async () => {
      const { result } = renderHook(() => useIndexStore())
      
      // Add a location first
      act(() => {
        useIndexStore.setState({
          locations: [
            {
              id: '1',
              path: '/test/location1',
              name: 'Location 1',
              addedAt: new Date(),
              stats: {
                total_files: 10,
                processed_files: 8,
                pending_files: 2,
                error_files: 0,
              },
            },
            {
              id: '2',
              path: '/test/location2',
              name: 'Location 2',
              addedAt: new Date(),
              stats: {
                total_files: 20,
                processed_files: 15,
                pending_files: 5,
                error_files: 0,
              },
            },
          ],
        })
      })
      
      await act(async () => {
        await result.current.removeLocation('/test/location1')
      })
      
      expect(result.current.locations).toHaveLength(1)
      expect(result.current.locations[0].path).toBe('/test/location2')
    })

    it('handles removing non-existent location gracefully', async () => {
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.removeLocation('/non/existent/path')
      })
      
      expect(result.current.locations).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })
  })

  describe('startIndexing', () => {
    it('starts indexing process successfully', async () => {
      mockTauriCommands.index_location = vi.fn().mockResolvedValue({ success: true })
      
      const { result } = renderHook(() => useIndexStore())
      
      // Add a location first
      act(() => {
        useIndexStore.setState({
          locations: [{
            id: '1',
            path: '/test/location',
            name: 'Test Location',
            addedAt: new Date(),
            stats: {
              total_files: 10,
              processed_files: 0,
              pending_files: 10,
              error_files: 0,
            },
          }],
        })
      })
      
      await act(async () => {
        await result.current.startIndexing()
      })
      
      expect(mockTauriCommands.index_location).toHaveBeenCalledWith({
        path: '/test/location',
      })
      expect(result.current.isIndexing).toBe(true)
    })

    it('handles indexing errors', async () => {
      mockTauriCommands.index_location = vi.fn().mockRejectedValue(new Error('Indexing failed'))
      
      const { result } = renderHook(() => useIndexStore())
      
      // Add a location first
      act(() => {
        useIndexStore.setState({
          locations: [{
            id: '1',
            path: '/test/location',
            name: 'Test Location',
            addedAt: new Date(),
            stats: {
              total_files: 10,
              processed_files: 0,
              pending_files: 10,
              error_files: 0,
            },
          }],
        })
      })
      
      await act(async () => {
        await result.current.startIndexing()
      })
      
      expect(result.current.error).toBe('Indexing failed')
      expect(result.current.isIndexing).toBe(false)
    })

    it('does not start indexing when no locations', async () => {
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.startIndexing()
      })
      
      expect(mockTauriCommands.index_location).not.toHaveBeenCalled()
      expect(result.current.isIndexing).toBe(false)
    })
  })

  describe('stopIndexing', () => {
    it('stops indexing process', async () => {
      mockTauriCommands.stop_indexing = vi.fn().mockResolvedValue({})
      
      const { result } = renderHook(() => useIndexStore())
      
      // Set indexing state
      act(() => {
        useIndexStore.setState({ isIndexing: true, progress: 50 })
      })
      
      await act(async () => {
        await result.current.stopIndexing()
      })
      
      expect(mockTauriCommands.stop_indexing).toHaveBeenCalled()
      expect(result.current.isIndexing).toBe(false)
      expect(result.current.progress).toBe(0)
      expect(result.current.currentFile).toBe('')
    })

    it('handles stop indexing errors', async () => {
      mockTauriCommands.stop_indexing = vi.fn().mockRejectedValue(new Error('Stop failed'))
      
      const { result } = renderHook(() => useIndexStore())
      
      act(() => {
        useIndexStore.setState({ isIndexing: true })
      })
      
      await act(async () => {
        await result.current.stopIndexing()
      })
      
      expect(result.current.error).toBe('Stop failed')
    })
  })

  describe('getLocationStats', () => {
    it('refreshes location statistics', async () => {
      const updatedStats = {
        total_files: 150,
        processed_files: 120,
        pending_files: 20,
        error_files: 10,
      }
      
      mockTauriCommands.get_location_stats.mockResolvedValue(updatedStats)
      
      const { result } = renderHook(() => useIndexStore())
      
      // Add a location first
      act(() => {
        useIndexStore.setState({
          locations: [{
            id: '1',
            path: '/test/location',
            name: 'Test Location',
            addedAt: new Date(),
            stats: {
              total_files: 100,
              processed_files: 80,
              pending_files: 15,
              error_files: 5,
            },
          }],
        })
      })
      
      await act(async () => {
        await result.current.getLocationStats('/test/location')
      })
      
      expect(mockTauriCommands.get_location_stats).toHaveBeenCalledWith({
        path: '/test/location',
      })
      
      expect(result.current.locations[0].stats).toEqual(updatedStats)
    })

    it('handles stats refresh errors', async () => {
      mockTauriCommands.get_location_stats.mockRejectedValue(new Error('Stats refresh failed'))
      
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.getLocationStats('/test/location')
      })
      
      expect(result.current.error).toBe('Stats refresh failed')
    })

    it('handles refreshing stats for non-existent location', async () => {
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.getLocationStats('/non/existent/path')
      })
      
      // Should not throw error or change state
      expect(result.current.error).toBeNull()
    })
  })

  describe('progress tracking', () => {
    it('updates indexing progress', () => {
      const { result } = renderHook(() => useIndexStore())
      
      act(() => {
        useIndexStore.setState({
          isIndexing: true,
          progress: 25,
          currentFile: '/test/current/file.txt',
        })
      })
      
      expect(result.current.isIndexing).toBe(true)
      expect(result.current.progress).toBe(25)
      expect(result.current.currentFile).toBe('/test/current/file.txt')
    })

    it('resets progress when indexing completes', async () => {
      const { result } = renderHook(() => useIndexStore())
      
      // Set progress state
      act(() => {
        useIndexStore.setState({
          isIndexing: true,
          progress: 75,
          currentFile: '/test/file.txt',
        })
      })
      
      // Complete indexing
      await act(async () => {
        await result.current.stopIndexing()
      })
      
      expect(result.current.isIndexing).toBe(false)
      expect(result.current.progress).toBe(0)
      expect(result.current.currentFile).toBe('')
    })
  })

  describe('error handling', () => {
    it('clears error on successful operation', async () => {
      const { result } = renderHook(() => useIndexStore())
      
      // Set error state
      act(() => {
        useIndexStore.setState({ error: 'Previous error' })
      })
      
      expect(result.current.error).toBe('Previous error')
      
      // Successful operation should clear error
      const { open } = require('@tauri-apps/api/dialog')
      open.mockResolvedValue('/test/folder')
      mockTauriCommands.get_location_stats.mockResolvedValue({
        total_files: 10,
        processed_files: 5,
        pending_files: 5,
        error_files: 0,
      })
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(result.current.error).toBeNull()
    })
  })

  describe('location management', () => {
    it('generates unique IDs for locations', async () => {
      const { open } = require('@tauri-apps/api/dialog')
      const { result } = renderHook(() => useIndexStore())
      
      // Add first location
      open.mockResolvedValue('/test/location1')
      mockTauriCommands.get_location_stats.mockResolvedValue({
        total_files: 10,
        processed_files: 5,
        pending_files: 5,
        error_files: 0,
      })
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      // Add second location
      open.mockResolvedValue('/test/location2')
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(result.current.locations).toHaveLength(2)
      expect(result.current.locations[0].id).not.toBe(result.current.locations[1].id)
    })

    it('extracts location name from path', async () => {
      const { open } = require('@tauri-apps/api/dialog')
      open.mockResolvedValue('/home/user/Documents/Important Files')
      
      mockTauriCommands.get_location_stats.mockResolvedValue({
        total_files: 5,
        processed_files: 3,
        pending_files: 2,
        error_files: 0,
      })
      
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(result.current.locations[0].name).toBe('Important Files')
    })

    it('handles root directory paths', async () => {
      const { open } = require('@tauri-apps/api/dialog')
      open.mockResolvedValue('/')
      
      mockTauriCommands.get_location_stats.mockResolvedValue({
        total_files: 1000,
        processed_files: 800,
        pending_files: 200,
        error_files: 0,
      })
      
      const { result } = renderHook(() => useIndexStore())
      
      await act(async () => {
        await result.current.addLocation()
      })
      
      expect(result.current.locations[0].name).toBe('/')
      expect(result.current.locations[0].path).toBe('/')
    })
  })
})