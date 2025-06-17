import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';
import { SearchResult, SearchQuery, SearchFilters, ViewMode, SortOption, SortDirection } from '../types';
import { fileProcessingService, ProcessedFile } from '../services/fileProcessingService';
import { isTauriApp } from '../utils/tauri';

interface SearchState {
  // Search state
  query: string;
  results: SearchResult[];
  suggestions: string[];
  isSearching: boolean;
  searchHistory: string[];
  
  // Filters and view
  filters: SearchFilters;
  viewMode: ViewMode;
  sortBy: SortOption;
  sortDirection: SortDirection;
  
  // Pagination
  currentPage: number;
  totalResults: number;
  resultsPerPage: number;
  
  // Selected items
  selectedResults: string[];
  
  // Actions
  init: () => void;
  search: (query: string, filters?: SearchFilters) => Promise<void>;
  clearSearch: () => void;
  setQuery: (query: string) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  setViewMode: (mode: ViewMode) => void;
  setSorting: (sortBy: SortOption, direction: SortDirection) => void;
  toggleResultSelection: (resultId: string) => void;
  selectAllResults: () => void;
  clearSelection: () => void;
  getSuggestions: (partialQuery: string) => Promise<void>;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  goToPage: (page: number) => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  // Initial state
  query: '',
  results: [],
  suggestions: [],
  isSearching: false,
  searchHistory: [],
  filters: {},
  viewMode: 'grid',
  sortBy: 'relevance',
  sortDirection: 'desc',
  currentPage: 1,
  totalResults: 0,
  resultsPerPage: 20,
  selectedResults: [],

  // Initialize the store
  init: () => {
    // Subscribe to file processing updates
    fileProcessingService.subscribe((files) => {
      const { query } = get();
      if (query.trim()) {
        // Re-run search with updated files
        get().search(query);
      }
    });
  },

  // Actions
  search: async (query: string, filters?: SearchFilters) => {
    try {
      set({ isSearching: true, query });

      const searchQuery: SearchQuery = {
        text: query,
        filters: filters || get().filters,
        limit: get().resultsPerPage,
        offset: (get().currentPage - 1) * get().resultsPerPage,
      };

      let response: {
        results: SearchResult[];
        total: number;
        query: string;
        execution_time_ms: number;
      };

      // Try file processing service first (uses files from onboarding)
      const processedFiles = fileProcessingService.searchFiles(query);
      
      if (processedFiles.length > 0) {
        // Convert processed files to search results
        const searchResults = get().convertProcessedFilesToSearchResults(processedFiles, query);
        response = {
          results: searchResults,
          total: searchResults.length,
          query: query,
          execution_time_ms: 25
        };
      } else {
        // Try backend if no processed files found
        try {
          response = await invoke<{
            results: SearchResult[];
            total: number;
            query: string;
            execution_time_ms: number;
          }>('search_files', { 
            query: searchQuery.text, 
            filters: searchQuery.filters 
          });
        } catch (backendError) {
          console.warn('Backend search not available, using mock data:', backendError);
          
          // Generate mock search results as final fallback
          const mockResults = get().generateMockResults(query);
          response = {
            results: mockResults,
            total: mockResults.length,
            query: query,
            execution_time_ms: 45
          };
        }
      }

      // Apply client-side sorting
      const sortedResults = get().applySorting(response.results);

      set({
        results: sortedResults,
        totalResults: response.total,
        isSearching: false,
        selectedResults: [], // Clear selection on new search
      });

      // Add to search history if query is not empty
      if (query.trim()) {
        get().addToHistory(query);
      }
    } catch (error) {
      console.error('Search failed:', error);
      set({ 
        isSearching: false,
        results: [],
        totalResults: 0,
      });
    }
  },

  clearSearch: () => {
    set({
      query: '',
      results: [],
      totalResults: 0,
      currentPage: 1,
      selectedResults: [],
      suggestions: [],
    });
  },

  setQuery: (query: string) => {
    set({ query });
  },

  setFilters: (filters: Partial<SearchFilters>) => {
    const currentFilters = get().filters;
    const newFilters = { ...currentFilters, ...filters };
    
    set({ filters: newFilters });

    // Re-run search if there's an active query
    const { query } = get();
    if (query.trim()) {
      get().search(query, newFilters);
    }
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  setSorting: (sortBy: SortOption, direction: SortDirection) => {
    set({ sortBy, sortDirection });

    // Re-sort current results
    const { results } = get();
    const sortedResults = get().applySorting(results);
    set({ results: sortedResults });
  },

  applySorting: (results: SearchResult[]): SearchResult[] => {
    const { sortBy, sortDirection } = get();
    
    const sorted = [...results].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = b.score - a.score;
          break;
        case 'name':
          comparison = a.file.name.localeCompare(b.file.name);
          break;
        case 'size':
          comparison = a.file.size - b.file.size;
          break;
        case 'modified':
          comparison = new Date(a.file.modified_at).getTime() - new Date(b.file.modified_at).getTime();
          break;
        case 'created':
          comparison = new Date(a.file.created_at).getTime() - new Date(b.file.created_at).getTime();
          break;
        case 'type':
          const aExt = a.file.extension || '';
          const bExt = b.file.extension || '';
          comparison = aExt.localeCompare(bExt);
          break;
      }
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  },

  toggleResultSelection: (resultId: string) => {
    const { selectedResults } = get();
    
    if (selectedResults.includes(resultId)) {
      set({ 
        selectedResults: selectedResults.filter(id => id !== resultId) 
      });
    } else {
      set({ 
        selectedResults: [...selectedResults, resultId] 
      });
    }
  },

  selectAllResults: () => {
    const { results } = get();
    const allIds = results.map(result => result.file.id);
    set({ selectedResults: allIds });
  },

  clearSelection: () => {
    set({ selectedResults: [] });
  },

  getSuggestions: async (partialQuery: string) => {
    if (!partialQuery.trim()) {
      set({ suggestions: [] });
      return;
    }

    try {
      const suggestions = await invoke<string[]>('get_search_suggestions', { 
        partialQuery 
      });
      
      set({ suggestions });
    } catch (error) {
      console.warn('Backend suggestions not available, using mock data:', error);
      
      // Generate mock suggestions based on partial query
      const mockSuggestions = get().generateMockSuggestions(partialQuery);
      set({ suggestions: mockSuggestions });
    }
  },

  addToHistory: (query: string) => {
    const { searchHistory } = get();
    
    // Remove if already exists to avoid duplicates
    const filtered = searchHistory.filter(item => item !== query);
    
    // Add to beginning and limit to 20 items
    const newHistory = [query, ...filtered].slice(0, 20);
    
    set({ searchHistory: newHistory });
  },

  clearHistory: () => {
    set({ searchHistory: [] });
  },

  goToPage: (page: number) => {
    const { totalResults, resultsPerPage } = get();
    const maxPage = Math.ceil(totalResults / resultsPerPage);
    
    if (page >= 1 && page <= maxPage) {
      set({ currentPage: page });
      
      // Re-run search with new pagination
      const { query, filters } = get();
      if (query.trim()) {
        get().search(query, filters);
      }
    }
  },

  // Convert processed files to search results
  convertProcessedFilesToSearchResults: (processedFiles: ProcessedFile[], query: string): SearchResult[] => {
    return processedFiles.map(file => ({
      file: {
        id: file.id,
        path: file.path,
        name: file.name,
        extension: file.extension,
        size: file.size,
        created_at: file.created_at,
        modified_at: file.modified_at,
        mime_type: file.mime_type,
        processing_status: file.processing_status as any
      },
      score: (file as any).relevanceScore || 0.85,
      snippet: file.content ? file.content.substring(0, 200) + '...' : `Content from ${file.name}`,
      highlights: [query, ...(file.tags || [])]
    }));
  },

  // Mock data generators (for development when backend is not available)
  generateMockResults: (query: string): SearchResult[] => {
    const mockFiles = [
      {
        id: "1",
        path: "/Users/documents/project-proposal.pdf", 
        name: "Project Proposal.pdf",
        extension: "pdf",
        size: 2048576,
        created_at: "2024-01-15T10:30:00Z",
        modified_at: "2024-01-20T14:45:00Z",
        mime_type: "application/pdf",
        processing_status: "completed" as ProcessingStatus
      },
      {
        id: "2", 
        path: "/Users/documents/meeting-notes.md",
        name: "Meeting Notes.md", 
        extension: "md",
        size: 4096,
        created_at: "2024-01-18T09:15:00Z",
        modified_at: "2024-01-18T16:20:00Z",
        mime_type: "text/markdown",
        processing_status: "completed" as ProcessingStatus
      },
      {
        id: "3",
        path: "/Users/code/metamind/src/main.rs",
        name: "main.rs",
        extension: "rs", 
        size: 8192,
        created_at: "2024-01-10T11:00:00Z",
        modified_at: "2024-01-22T13:30:00Z",
        mime_type: "text/rust",
        processing_status: "completed" as ProcessingStatus
      },
      {
        id: "4",
        path: "/Users/images/vacation-photo.jpg",
        name: "Vacation Photo.jpg",
        extension: "jpg",
        size: 1536000,
        created_at: "2024-01-05T18:22:00Z", 
        modified_at: "2024-01-05T18:22:00Z",
        mime_type: "image/jpeg",
        processing_status: "completed" as ProcessingStatus
      },
      {
        id: "5",
        path: "/Users/spreadsheets/budget-2024.xlsx",
        name: "Budget 2024.xlsx",
        extension: "xlsx", 
        size: 512000,
        created_at: "2024-01-01T00:00:00Z",
        modified_at: "2024-01-20T09:45:00Z",
        mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        processing_status: "completed" as ProcessingStatus
      }
    ];

    // Filter files based on query relevance
    const filtered = mockFiles.filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase()) ||
      file.path.toLowerCase().includes(query.toLowerCase()) ||
      (file.extension && query.toLowerCase().includes(file.extension))
    );

    // If no matches found, return all files with lower scores
    const filesToReturn = filtered.length > 0 ? filtered : mockFiles;

    return filesToReturn.map(file => ({
      file,
      score: filtered.length > 0 ? 0.85 + Math.random() * 0.15 : 0.3 + Math.random() * 0.4,
      snippet: `Content snippet from ${file.name} matching "${query}"...`,
      highlights: [query, file.name.split('.')[0]]
    }));
  },

  generateMockSuggestions: (partialQuery: string): string[] => {
    const allSuggestions = [
      "photos from last week",
      "PDF documents about project", 
      "code files modified today",
      "presentations larger than 10MB",
      "images from vacation",
      "spreadsheets containing budget",
      "markdown files with meeting notes",
      "rust code files",
      "documents created this month",
      "files modified recently"
    ];

    return allSuggestions
      .filter(suggestion => 
        suggestion.toLowerCase().includes(partialQuery.toLowerCase())
      )
      .slice(0, 5);
  },
}));