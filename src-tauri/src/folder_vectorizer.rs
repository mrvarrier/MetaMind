use anyhow::{Result, anyhow};
use std::collections::HashMap;
use std::path::Path;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use tokio::fs;

use crate::vector_math::VectorMath;
use crate::vector_storage::VectorStorageManager;
use crate::ai_processor::AIProcessor;

/// Manages folder-level vector aggregation and theme analysis
#[derive(Debug)]
pub struct FolderVectorizer {
    vector_storage: VectorStorageManager,
    ai_processor: AIProcessor,
    config: FolderVectorizerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderVectorizerConfig {
    pub min_files_for_aggregation: usize,
    pub max_files_per_folder: usize,
    pub enable_theme_extraction: bool,
    pub enable_recursive_aggregation: bool,
    pub weight_by_file_size: bool,
    pub include_subfolder_themes: bool,
    pub aggregation_method: AggregationMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AggregationMethod {
    Average,
    WeightedAverage,
    Centroid,
    RepresentativeSet,
}

impl Default for FolderVectorizerConfig {
    fn default() -> Self {
        Self {
            min_files_for_aggregation: 3,
            max_files_per_folder: 1000,
            enable_theme_extraction: true,
            enable_recursive_aggregation: true,
            weight_by_file_size: false,
            include_subfolder_themes: true,
            aggregation_method: AggregationMethod::WeightedAverage,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderAnalysis {
    pub folder_path: String,
    pub file_count: usize,
    pub total_size: u64,
    pub file_types: HashMap<String, usize>,
    pub aggregate_vector: Vec<f32>,
    pub theme_vector: Option<Vec<f32>>,
    pub theme_description: Option<String>,
    pub dominant_categories: Vec<String>,
    pub representative_files: Vec<String>,
    pub quality_score: f32,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderTheme {
    pub description: String,
    pub confidence: f32,
    pub key_concepts: Vec<String>,
    pub representative_content: Vec<String>,
}

impl FolderVectorizer {
    pub fn new(vector_storage: VectorStorageManager, ai_processor: AIProcessor) -> Self {
        Self {
            vector_storage,
            ai_processor,
            config: FolderVectorizerConfig::default(),
        }
    }

    pub fn with_config(mut self, config: FolderVectorizerConfig) -> Self {
        self.config = config;
        self
    }

    /// Process a folder and generate its aggregate vectors
    pub async fn process_folder(&self, folder_path: &str) -> Result<FolderAnalysis> {
        // Get all files in the folder with vectors
        let file_vectors = self.get_folder_file_vectors(folder_path).await?;
        
        if file_vectors.len() < self.config.min_files_for_aggregation {
            return Err(anyhow!(
                "Folder {} has only {} files with vectors, minimum {} required",
                folder_path, file_vectors.len(), self.config.min_files_for_aggregation
            ));
        }

        // Analyze folder structure and content
        let folder_stats = self.analyze_folder_structure(folder_path).await?;
        
        // Generate aggregate vector using configured method
        let aggregate_vector = self.generate_aggregate_vector(&file_vectors, &folder_stats).await?;
        
        // Generate theme vector and description if enabled
        let (theme_vector, theme_description) = if self.config.enable_theme_extraction {
            let theme = self.extract_folder_theme(folder_path, &file_vectors).await?;
            let theme_vector = if !theme.description.is_empty() {
                Some(self.ai_processor.generate_embedding(&theme.description).await?)
            } else {
                None
            };
            (theme_vector, Some(theme.description))
        } else {
            (None, None)
        };

        // Identify representative files
        let representative_files = self.identify_representative_files(&file_vectors, &aggregate_vector, 5).await?;
        
        // Calculate quality score
        let quality_score = self.calculate_folder_quality(&file_vectors, &folder_stats);

        let analysis = FolderAnalysis {
            folder_path: folder_path.to_string(),
            file_count: folder_stats.file_count,
            total_size: folder_stats.total_size,
            file_types: folder_stats.file_types,
            aggregate_vector,
            theme_vector,
            theme_description,
            dominant_categories: folder_stats.dominant_categories,
            representative_files,
            quality_score,
            last_updated: Utc::now(),
        };

        // Store the folder vectors
        self.vector_storage.store_folder_vector(
            folder_path,
            analysis.aggregate_vector.clone(),
            analysis.theme_vector.clone(),
            analysis.file_count,
            analysis.total_size,
            "nomic-embed-text", // TODO: Make configurable
        ).await?;

        Ok(analysis)
    }

    /// Process all folders in a directory tree
    pub async fn process_directory_tree(&self, root_path: &str) -> Result<Vec<FolderAnalysis>> {
        let folders = self.discover_folders(root_path).await?;
        let mut analyses = Vec::new();

        for folder_path in folders {
            match self.process_folder(&folder_path).await {
                Ok(analysis) => analyses.push(analysis),
                Err(e) => {
                    tracing::warn!("Failed to process folder {}: {}", folder_path, e);
                    continue;
                }
            }
        }

        // Process hierarchical aggregation if enabled
        if self.config.enable_recursive_aggregation {
            self.process_hierarchical_aggregation(&mut analyses, root_path).await?;
        }

        Ok(analyses)
    }

    /// Update folder vectors when files change
    pub async fn update_folder_on_file_change(&self, file_path: &str) -> Result<()> {
        let folder_path = Path::new(file_path)
            .parent()
            .and_then(|p| p.to_str())
            .ok_or_else(|| anyhow!("Could not determine folder for file: {}", file_path))?;

        // Re-process the folder
        match self.process_folder(folder_path).await {
            Ok(_) => tracing::debug!("Updated folder vectors for: {}", folder_path),
            Err(e) => tracing::warn!("Failed to update folder vectors for {}: {}", folder_path, e),
        }

        // Update parent folders if recursive aggregation is enabled
        if self.config.enable_recursive_aggregation {
            let mut current_path = Path::new(folder_path);
            while let Some(parent) = current_path.parent() {
                if let Some(parent_str) = parent.to_str() {
                    if parent_str.is_empty() || parent_str == "/" {
                        break;
                    }
                    
                    match self.process_folder(parent_str).await {
                        Ok(_) => tracing::debug!("Updated parent folder vectors for: {}", parent_str),
                        Err(_) => break, // Stop if parent can't be processed
                    }
                    
                    current_path = parent;
                } else {
                    break;
                }
            }
        }

        Ok(())
    }

    /// Get all file vectors within a folder
    async fn get_folder_file_vectors(&self, _folder_path: &str) -> Result<Vec<(String, Vec<f32>, u64)>> {
        // TODO: Query database for files in folder with their vectors and sizes
        // For now, return empty vector
        Ok(Vec::new())
    }

    /// Analyze folder structure and metadata
    async fn analyze_folder_structure(&self, _folder_path: &str) -> Result<FolderStats> {
        let file_count = 0;
        let total_size = 0;
        let file_types = HashMap::new();
        let dominant_categories = Vec::new();

        // TODO: Scan folder and collect statistics
        // For now, return basic stats
        Ok(FolderStats {
            file_count,
            total_size,
            file_types,
            dominant_categories,
        })
    }

    /// Generate aggregate vector using configured method
    async fn generate_aggregate_vector(
        &self,
        file_vectors: &[(String, Vec<f32>, u64)],
        _folder_stats: &FolderStats,
    ) -> Result<Vec<f32>> {
        if file_vectors.is_empty() {
            return Err(anyhow!("Cannot generate aggregate vector from empty file list"));
        }

        match self.config.aggregation_method {
            AggregationMethod::Average => {
                let vectors: Vec<Vec<f32>> = file_vectors.iter()
                    .map(|(_, vector, _)| vector.clone())
                    .collect();
                VectorMath::average_vectors(&vectors)
            },
            AggregationMethod::WeightedAverage => {
                let vectors: Vec<Vec<f32>> = file_vectors.iter()
                    .map(|(_, vector, _)| vector.clone())
                    .collect();
                
                let weights: Vec<f32> = if self.config.weight_by_file_size {
                    let total_size: u64 = file_vectors.iter().map(|(_, _, size)| size).sum();
                    file_vectors.iter()
                        .map(|(_, _, size)| *size as f32 / total_size as f32)
                        .collect()
                } else {
                    vec![1.0; file_vectors.len()]
                };

                VectorMath::weighted_average_vectors(&vectors, &weights)
            },
            AggregationMethod::Centroid => {
                // Use average for now, could implement more sophisticated centroid calculation
                let vectors: Vec<Vec<f32>> = file_vectors.iter()
                    .map(|(_, vector, _)| vector.clone())
                    .collect();
                VectorMath::average_vectors(&vectors)
            },
            AggregationMethod::RepresentativeSet => {
                // Select most representative vectors and average them
                let vectors: Vec<Vec<f32>> = file_vectors.iter()
                    .map(|(_, vector, _)| vector.clone())
                    .collect();
                
                // For now, just use all vectors
                VectorMath::average_vectors(&vectors)
            },
        }
    }

    /// Extract thematic description of folder content
    async fn extract_folder_theme(&self, folder_path: &str, _file_vectors: &[(String, Vec<f32>, u64)]) -> Result<FolderTheme> {
        // TODO: Analyze file content and generate theme description
        // For now, return basic theme
        Ok(FolderTheme {
            description: format!("Content collection in {}", folder_path),
            confidence: 0.5,
            key_concepts: Vec::new(),
            representative_content: Vec::new(),
        })
    }

    /// Identify files most representative of the folder's content
    async fn identify_representative_files(
        &self,
        file_vectors: &[(String, Vec<f32>, u64)],
        aggregate_vector: &[f32],
        count: usize,
    ) -> Result<Vec<String>> {
        if file_vectors.is_empty() {
            return Ok(Vec::new());
        }

        let candidates: Vec<(String, Vec<f32>)> = file_vectors.iter()
            .map(|(id, vector, _)| (id.clone(), vector.clone()))
            .collect();

        let similar_files = VectorMath::find_similar_vectors(
            aggregate_vector,
            &candidates,
            count,
            0.0, // No threshold for representative files
        )?;

        Ok(similar_files.into_iter().map(|(id, _)| id).collect())
    }

    /// Calculate quality score for folder vectorization
    fn calculate_folder_quality(&self, file_vectors: &[(String, Vec<f32>, u64)], _folder_stats: &FolderStats) -> f32 {
        if file_vectors.is_empty() {
            return 0.0;
        }

        // Basic quality calculation based on file count and consistency
        let file_count_score = (file_vectors.len().min(10) as f32) / 10.0;
        
        // TODO: Add vector consistency analysis
        let consistency_score = 0.8;

        (file_count_score + consistency_score) / 2.0
    }

    /// Discover all folders in a directory tree
    async fn discover_folders(&self, root_path: &str) -> Result<Vec<String>> {
        let mut folders = Vec::new();
        self.discover_folders_recursive(root_path, &mut folders).await?;
        Ok(folders)
    }

    /// Recursive folder discovery
    fn discover_folders_recursive<'a>(&'a self, current_path: &'a str, folders: &'a mut Vec<String>) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
            let mut dir_entries = fs::read_dir(current_path).await?;
            
            while let Some(entry) = dir_entries.next_entry().await? {
                let path = entry.path();
                
                if path.is_dir() {
                    if let Some(path_str) = path.to_str() {
                        folders.push(path_str.to_string());
                        
                        // Recurse into subdirectory
                        self.discover_folders_recursive(path_str, folders).await?;
                    }
                }
            }
            
            Ok(())
        })
    }

    /// Process hierarchical aggregation for parent folders
    async fn process_hierarchical_aggregation(&self, _analyses: &mut Vec<FolderAnalysis>, _root_path: &str) -> Result<()> {
        // TODO: Implement hierarchical aggregation
        // This would create parent folder vectors based on child folder vectors
        Ok(())
    }
}

#[derive(Debug, Clone)]
struct FolderStats {
    file_count: usize,
    total_size: u64,
    file_types: HashMap<String, usize>,
    dominant_categories: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn setup_test_vectorizer() -> FolderVectorizer {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        let vector_storage = VectorStorageManager::new(pool);
        let ai_processor = AIProcessor::new("http://localhost:11434".to_string(), "llama3.2".to_string());
        
        FolderVectorizer::new(vector_storage, ai_processor)
    }

    #[tokio::test]
    async fn test_folder_vectorizer_config() {
        let config = FolderVectorizerConfig::default();
        assert_eq!(config.min_files_for_aggregation, 3);
        assert_eq!(config.aggregation_method, AggregationMethod::WeightedAverage);
    }

    #[tokio::test]
    async fn test_folder_vectorizer_creation() {
        let vectorizer = setup_test_vectorizer().await;
        assert_eq!(vectorizer.config.min_files_for_aggregation, 3);
    }

    #[tokio::test]
    async fn test_folder_quality_calculation() {
        let vectorizer = setup_test_vectorizer().await;
        
        let file_vectors = vec![
            ("file1".to_string(), vec![1.0, 0.0], 1000),
            ("file2".to_string(), vec![0.0, 1.0], 2000),
        ];
        
        let folder_stats = FolderStats {
            file_count: 2,
            total_size: 3000,
            file_types: HashMap::new(),
            dominant_categories: Vec::new(),
        };
        
        let quality = vectorizer.calculate_folder_quality(&file_vectors, &folder_stats);
        assert!(quality > 0.0 && quality <= 1.0);
    }
}