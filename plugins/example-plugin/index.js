/**
 * Example MetaMind Plugin
 * Demonstrates the plugin API and capabilities
 */

class ExamplePlugin {
    constructor(api) {
        this.api = api;
        this.name = 'example-plugin';
        this.version = '1.0.0';
    }

    /**
     * Hook: Called when a file is processed
     */
    async onFileProcessed(context, data) {
        const { file } = data;
        
        try {
            // Log file processing
            console.log(`[${this.name}] File processed: ${file.path}`);
            
            // Analyze text files
            if (file.extension === '.txt' || file.extension === '.md') {
                const analysis = await this.analyzeTextFile(file);
                
                // Show notification for important files
                if (analysis.importance > 0.8) {
                    await this.api.showNotification(
                        'Important File Detected',
                        `The file "${file.name}" appears to be important based on its content.`
                    );
                }
                
                return {
                    success: true,
                    data: analysis
                };
            }
            
            return { success: true };
        } catch (error) {
            console.error(`[${this.name}] Error processing file:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Hook: Called when a search is started
     */
    onSearchStarted(context, data) {
        const { query } = data;
        console.log(`[${this.name}] Search started: "${query}"`);
        
        // Add search enhancement
        if (query.includes('important')) {
            return {
                success: true,
                data: {
                    enhanced_query: query + ' priority:high',
                    suggestion: 'Searching for important files with high priority'
                }
            };
        }
        
        return { success: true };
    }

    /**
     * Analyze text file content
     */
    async analyzeTextFile(file) {
        try {
            // Use the API to analyze the file
            const analysisResult = await this.api.analyzeFile(file.path);
            
            // Calculate importance score based on keywords
            const importantKeywords = [
                'important', 'urgent', 'critical', 'deadline',
                'meeting', 'presentation', 'project', 'todo'
            ];
            
            const content = analysisResult.content || '';
            const wordCount = content.split(/\s+/).length;
            const importantWordCount = importantKeywords.reduce((count, keyword) => {
                return count + (content.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
            }, 0);
            
            const importance = Math.min(importantWordCount / Math.max(wordCount * 0.01, 1), 1);
            
            return {
                wordCount,
                importantWordCount,
                importance,
                keywords: this.extractKeywords(content),
                summary: this.generateSummary(content),
                analysisTime: new Date().toISOString()
            };
        } catch (error) {
            console.error('Analysis failed:', error);
            return {
                error: error.message,
                importance: 0
            };
        }
    }

    /**
     * Extract keywords from text
     */
    extractKeywords(text) {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count }));
    }

    /**
     * Generate a simple summary
     */
    generateSummary(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length <= 2) {
            return text.substring(0, 200);
        }
        
        // Take first and last sentences
        const summary = sentences[0].trim() + '. ' + sentences[sentences.length - 1].trim() + '.';
        return summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    }

    /**
     * Plugin lifecycle: Initialize
     */
    async initialize() {
        console.log(`[${this.name}] Plugin initialized`);
        
        // Register custom UI components
        await this.registerUIComponents();
        
        return { success: true };
    }

    /**
     * Plugin lifecycle: Cleanup
     */
    async cleanup() {
        console.log(`[${this.name}] Plugin cleanup`);
        return { success: true };
    }

    /**
     * Register UI components
     */
    async registerUIComponents() {
        // This would register the ExamplePanel component
        // In a real implementation, this would use the plugin API
        console.log(`[${this.name}] Registering UI components`);
    }

    /**
     * Handle custom search provider
     */
    async search(query, options = {}) {
        console.log(`[${this.name}] Custom search: "${query}"`);
        
        try {
            // Use the main search API with custom enhancements
            const results = await this.api.searchFiles(query);
            
            // Add custom scoring based on our analysis
            const enhancedResults = results.map(result => {
                if (result.file.extension === '.txt' || result.file.extension === '.md') {
                    // Boost score for text files that match our criteria
                    result.score *= 1.2;
                }
                return result;
            });
            
            return {
                success: true,
                results: enhancedResults,
                provider: this.name,
                enhanced: true
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Plugin entry point
function createPlugin(api) {
    return new ExamplePlugin(api);
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createPlugin };
} else if (typeof window !== 'undefined') {
    window.MetaMindExamplePlugin = { createPlugin };
}