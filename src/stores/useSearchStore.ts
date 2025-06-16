import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';
import { SearchResult, SearchQuery, SearchFilters, ViewMode, SortOption, SortDirection } from '../types';

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

      const response = await invoke<{
        results: SearchResult[];
        total: number;
        query: string;
        execution_time_ms: number;
      }>('search_files', { 
        query: searchQuery.text, 
        filters: searchQuery.filters 
      });

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
      console.error('Failed to get suggestions:', error);
      set({ suggestions: [] });
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
}));