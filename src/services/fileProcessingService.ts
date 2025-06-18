// @ts-nocheck
// File processing service for both Tauri and web modes

import { FileRecord, ProcessingStatus } from '../types';
import { safeInvoke, isTauriApp } from '../utils/tauri';

export interface ProcessedFile {
  id: string;
  path: string;
  name: string;
  extension?: string;
  size: number;
  created_at: string;
  modified_at: string;
  mime_type?: string;
  content?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'error';
  ai_analysis?: string;
  tags?: string[];
  category?: string;
}

class FileProcessingService {
  private processedFiles: ProcessedFile[] = [];
  private processingQueue: string[] = [];
  private isProcessing = false;
  private listeners: ((files: ProcessedFile[]) => void)[] = [];

  // Subscribe to file processing updates
  subscribe(listener: (files: ProcessedFile[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of updates
  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.processedFiles]));
  }

  // Add paths from onboarding to processing queue
  async initializeFromOnboarding(selectedPaths: string[]): Promise<void> {
    console.log('Initializing file processing for paths:', selectedPaths);
    
    if (isTauriApp()) {
      // Use Tauri backend for native app
      await this.initializeTauriProcessing(selectedPaths);
    } else {
      // Use web-based processing for browser
      await this.initializeWebProcessing(selectedPaths);
    }
  }

  // Tauri-based file processing
  private async initializeTauriProcessing(selectedPaths: string[]): Promise<void> {
    try {
      // Start file monitoring on selected paths
      await safeInvoke('start_file_monitoring', selectedPaths);
      
      // Scan each directory initially
      for (const path of selectedPaths) {
        await safeInvoke('scan_directory', path);
      }
      
      console.log('Started Tauri file monitoring for paths:', selectedPaths);
      
      // Start polling for real processing updates
      this.startTauriStatusPolling();
      
    } catch (error) {
      console.error('Failed to initialize Tauri file processing:', error);
    }
  }

  // Web-based file processing (for development)
  private async initializeWebProcessing(selectedPaths: string[]): Promise<void> {
    try {
      // Generate mock files based on selected paths
      const mockFiles = this.generateMockFiles(selectedPaths);
      this.processedFiles = mockFiles;
      this.notifyListeners();
      
      // Simulate processing delay
      setTimeout(() => {
        this.simulateProcessingComplete();
      }, 2000);
      
      console.log('Initialized web file processing with mock data');
    } catch (error) {
      console.error('Failed to initialize web file processing:', error);
    }
  }

  // Generate realistic mock files for web development
  private generateMockFiles(selectedPaths: string[]): ProcessedFile[] {
    const mockFiles: ProcessedFile[] = [];
    
    selectedPaths.forEach((basePath, pathIndex) => {
      // Generate mock files for each selected path
      const fileTypes = [
        { ext: 'pdf', name: 'Project Report', size: 2048576, content: 'This is a comprehensive project report...' },
        { ext: 'md', name: 'README', size: 4096, content: '# Project Documentation\n\nThis project implements...' },
        { ext: 'txt', name: 'Notes', size: 1024, content: 'Meeting notes from today...' },
        { ext: 'jpg', name: 'Image', size: 1536000, content: '[Image file]' },
        { ext: 'js', name: 'script', size: 8192, content: 'function processData() {\n  // Implementation\n}' },
        { ext: 'json', name: 'config', size: 2048, content: '{\n  "version": "1.0.0",\n  "name": "config"\n}' },
        { ext: 'xlsx', name: 'Spreadsheet', size: 512000, content: '[Excel spreadsheet data]' },
        { ext: 'docx', name: 'Document', size: 256000, content: 'This is a Word document...' },
        { ext: 'py', name: 'analysis', size: 16384, content: 'import pandas as pd\n\ndef analyze_data():\n    pass' },
        { ext: 'rs', name: 'main', size: 12288, content: 'fn main() {\n    println!("Hello, world!");\n}' }
      ];

      fileTypes.forEach((fileType, index) => {
        const fileName = `${fileType.name}_${pathIndex + 1}.${fileType.ext}`;
        const filePath = `${basePath}/${fileName}`;
        const now = new Date();
        const createdDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date within last 30 days
        const modifiedDate = new Date(createdDate.getTime() + Math.random() * 24 * 60 * 60 * 1000); // Modified after creation

        mockFiles.push({
          id: `file_${pathIndex}_${index}`,
          path: filePath,
          name: fileName,
          extension: fileType.ext,
          size: fileType.size + Math.floor(Math.random() * 1000), // Add some variance
          created_at: createdDate.toISOString(),
          modified_at: modifiedDate.toISOString(),
          mime_type: this.getMimeType(fileType.ext),
          content: fileType.content,
          processing_status: 'pending',
          tags: this.generateTags(fileType.ext),
          category: this.getCategory(fileType.ext)
        });
      });
    });

    return mockFiles;
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'js': 'text/javascript',
      'json': 'application/json',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'py': 'text/x-python',
      'rs': 'text/x-rust'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  private generateTags(extension: string): string[] {
    const tagMap: Record<string, string[]> = {
      'pdf': ['document', 'report', 'text'],
      'md': ['documentation', 'markdown', 'text'],
      'txt': ['notes', 'text', 'plain'],
      'jpg': ['image', 'photo', 'visual'],
      'js': ['code', 'javascript', 'programming'],
      'json': ['config', 'data', 'structured'],
      'xlsx': ['spreadsheet', 'data', 'excel'],
      'docx': ['document', 'word', 'text'],
      'py': ['code', 'python', 'programming'],
      'rs': ['code', 'rust', 'programming']
    };
    return tagMap[extension] || ['file'];
  }

  private getCategory(extension: string): string {
    const categoryMap: Record<string, string> = {
      'pdf': 'document',
      'md': 'document',
      'txt': 'document',
      'docx': 'document',
      'jpg': 'image',
      'js': 'code',
      'py': 'code',
      'rs': 'code',
      'json': 'data',
      'xlsx': 'data'
    };
    return categoryMap[extension] || 'other';
  }

  private simulateProcessingComplete() {
    // Simulate AI processing completion
    this.processedFiles = this.processedFiles.map(file => ({
      ...file,
      processing_status: 'completed' as const,
      ai_analysis: `AI analysis for ${file.name}: This file contains ${file.category} content and appears to be ${file.tags?.join(', ')}.`
    }));
    
    this.notifyListeners();
    console.log(`Processing completed for ${this.processedFiles.length} files`);
  }

  // Get all processed files
  getProcessedFiles(): ProcessedFile[] {
    return [...this.processedFiles];
  }

  // Get files by category
  getFilesByCategory(category: string): ProcessedFile[] {
    return this.processedFiles.filter(file => file.category === category);
  }

  // Search files by content, name, or tags
  searchFiles(query: string): ProcessedFile[] {
    const lowercaseQuery = query.toLowerCase();
    
    return this.processedFiles.filter(file => 
      file.name.toLowerCase().includes(lowercaseQuery) ||
      file.content?.toLowerCase().includes(lowercaseQuery) ||
      file.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
      file.ai_analysis?.toLowerCase().includes(lowercaseQuery) ||
      file.category?.toLowerCase().includes(lowercaseQuery)
    ).map(file => ({
      ...file,
      // Add relevance scoring
      relevanceScore: this.calculateRelevance(file, lowercaseQuery)
    })).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  private calculateRelevance(file: ProcessedFile, query: string): number {
    let score = 0;
    
    // Name match (highest priority)
    if (file.name.toLowerCase().includes(query)) score += 10;
    
    // Content match
    if (file.content?.toLowerCase().includes(query)) score += 5;
    
    // Tag match
    if (file.tags?.some(tag => tag.toLowerCase().includes(query))) score += 3;
    
    // AI analysis match
    if (file.ai_analysis?.toLowerCase().includes(query)) score += 2;
    
    // Category match
    if (file.category?.toLowerCase().includes(query)) score += 1;
    
    return score;
  }

  // Get processing status
  getProcessingStatus(): ProcessingStatus {
    const totalFiles = this.processedFiles.length;
    const processedFiles = this.processedFiles.filter(f => f.processing_status === 'completed').length;
    const pendingFiles = this.processedFiles.filter(f => f.processing_status === 'pending').length;
    const errorFiles = this.processedFiles.filter(f => f.processing_status === 'error').length;

    return {
      total_processed: processedFiles,
      queue_size: pendingFiles,
      current_processing: this.processedFiles.filter(f => f.processing_status === 'processing').length,
      errors: errorFiles,
      average_processing_time_ms: 1500, // Mock average
      last_processed_at: this.processedFiles.length > 0 ? new Date().toISOString() : undefined
    };
  }

  // Get file statistics
  getFileStats() {
    const stats = {
      total: this.processedFiles.length,
      byCategory: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      totalSize: 0
    };

    this.processedFiles.forEach(file => {
      // Count by category
      stats.byCategory[file.category || 'other'] = (stats.byCategory[file.category || 'other'] || 0) + 1;
      
      // Count by status
      stats.byStatus[file.processing_status] = (stats.byStatus[file.processing_status] || 0) + 1;
      
      // Total size
      stats.totalSize += file.size;
    });

    return stats;
  }

  // Start polling Tauri backend for real status updates
  private startTauriStatusPolling(): void {
    if (!isTauriApp()) return;

    setInterval(async () => {
      try {
        const status = await safeInvoke('get_processing_status');
        if (status && status.database) {
          // Update our internal state with real backend data
          console.log('Processing status update:', status);
          this.notifyListeners();
        }
      } catch (error) {
        console.warn('Failed to get processing status:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  // Get real search results from backend
  async searchFilesFromBackend(query: string): Promise<ProcessedFile[]> {
    if (!isTauriApp()) {
      return this.searchFiles(query);
    }

    try {
      const response = await safeInvoke('search_files', query, null);
      
      if (response && response.results) {
        // Convert backend results to ProcessedFile format
        const backendFiles: ProcessedFile[] = response.results.map((result: any) => ({
          id: result.file.id,
          path: result.file.path,
          name: result.file.name,
          extension: result.file.extension,
          size: result.file.size,
          created_at: result.file.created_at,
          modified_at: result.file.modified_at,
          mime_type: result.file.mime_type,
          content: result.snippet || '',
          processing_status: result.file.processing_status,
          ai_analysis: result.snippet,
          tags: result.highlights || [],
          category: this.getCategory(result.file.extension || ''),
          relevanceScore: result.score || 0.5,
        }));

        return backendFiles;
      }
    } catch (error) {
      console.error('Backend search failed:', error);
    }

    // Fallback to mock data
    return this.searchFiles(query);
  }

  // Get all processed files from backend
  async getProcessedFilesFromBackend(): Promise<ProcessedFile[]> {
    if (!isTauriApp()) {
      return this.getProcessedFiles();
    }

    try {
      // Use empty search to get all files
      const response = await safeInvoke('search_files', '', null);
      
      if (response && response.results) {
        const backendFiles: ProcessedFile[] = response.results.map((result: any) => ({
          id: result.file.id,
          path: result.file.path,
          name: result.file.name,
          extension: result.file.extension,
          size: result.file.size,
          created_at: result.file.created_at,
          modified_at: result.file.modified_at,
          mime_type: result.file.mime_type,
          content: result.snippet || '',
          processing_status: result.file.processing_status,
          ai_analysis: result.snippet,
          tags: result.highlights || [],
          category: this.getCategory(result.file.extension || ''),
        }));

        // Update our local cache
        this.processedFiles = backendFiles;
        return backendFiles;
      }
    } catch (error) {
      console.error('Failed to get files from backend:', error);
    }

    // Fallback to mock data
    return this.getProcessedFiles();
  }
}

// Export singleton instance
export const fileProcessingService = new FileProcessingService();