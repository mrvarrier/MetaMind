use anyhow::{Result, anyhow};
use std::collections::BinaryHeap;
use std::cmp::Ordering;

/// Vector mathematics utilities for semantic search
pub struct VectorMath;

impl VectorMath {
    /// Calculate cosine similarity between two vectors
    /// Returns value between -1.0 and 1.0, where 1.0 is identical
    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> Result<f32> {
        if a.len() != b.len() {
            return Err(anyhow!("Vector dimensions don't match: {} vs {}", a.len(), b.len()));
        }

        if a.is_empty() {
            return Err(anyhow!("Cannot calculate similarity for empty vectors"));
        }

        let dot_product = Self::dot_product(a, b);
        let norm_a = Self::magnitude(a);
        let norm_b = Self::magnitude(b);

        if norm_a == 0.0 || norm_b == 0.0 {
            return Ok(0.0); // Return 0 for zero vectors
        }

        Ok(dot_product / (norm_a * norm_b))
    }

    /// Calculate Euclidean distance between two vectors
    /// Lower values indicate higher similarity
    pub fn euclidean_distance(a: &[f32], b: &[f32]) -> Result<f32> {
        if a.len() != b.len() {
            return Err(anyhow!("Vector dimensions don't match: {} vs {}", a.len(), b.len()));
        }

        let sum_squares: f32 = a.iter()
            .zip(b.iter())
            .map(|(x, y)| (x - y).powi(2))
            .sum();

        Ok(sum_squares.sqrt())
    }

    /// Calculate dot product of two vectors
    pub fn dot_product(a: &[f32], b: &[f32]) -> f32 {
        a.iter()
            .zip(b.iter())
            .map(|(x, y)| x * y)
            .sum()
    }

    /// Calculate magnitude (L2 norm) of a vector
    pub fn magnitude(vector: &[f32]) -> f32 {
        vector.iter()
            .map(|x| x * x)
            .sum::<f32>()
            .sqrt()
    }

    /// Normalize vector to unit length in-place
    pub fn normalize(vector: &mut [f32]) -> Result<()> {
        let magnitude = Self::magnitude(vector);
        
        if magnitude == 0.0 {
            return Err(anyhow!("Cannot normalize zero vector"));
        }

        for component in vector.iter_mut() {
            *component /= magnitude;
        }

        Ok(())
    }

    /// Create a normalized copy of a vector
    pub fn normalize_copy(vector: &[f32]) -> Result<Vec<f32>> {
        let mut normalized = vector.to_vec();
        Self::normalize(&mut normalized)?;
        Ok(normalized)
    }

    /// Find top-k most similar vectors using cosine similarity
    /// Returns (id, similarity_score) pairs sorted by similarity (highest first)
    pub fn find_similar_vectors(
        query: &[f32],
        candidates: &[(String, Vec<f32>)],
        k: usize,
        threshold: f32,
    ) -> Result<Vec<(String, f32)>> {
        if candidates.is_empty() {
            return Ok(Vec::new());
        }

        // Use a min-heap to keep track of top-k similarities
        let mut top_k = BinaryHeap::with_capacity(k + 1);

        for (id, candidate_vector) in candidates {
            let similarity = Self::cosine_similarity(query, candidate_vector)?;
            
            // Only consider vectors above threshold
            if similarity >= threshold {
                top_k.push(SimilarityScore {
                    id: id.clone(),
                    score: similarity,
                });

                // Keep only top k elements
                if top_k.len() > k {
                    top_k.pop(); // Remove smallest element
                }
            }
        }

        // Convert to sorted vector (highest similarity first)
        let mut results: Vec<(String, f32)> = top_k
            .into_iter()
            .map(|item| (item.id, item.score))
            .collect();

        // Sort in descending order of similarity
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));

        Ok(results)
    }

    /// Batch similarity calculation for multiple queries
    /// More efficient than individual calculations for multiple queries
    pub fn batch_similarity(
        queries: &[Vec<f32>],
        candidates: &[(String, Vec<f32>)],
        k: usize,
        threshold: f32,
    ) -> Result<Vec<Vec<(String, f32)>>> {
        let mut results = Vec::with_capacity(queries.len());

        for query in queries {
            let similar = Self::find_similar_vectors(query, candidates, k, threshold)?;
            results.push(similar);
        }

        Ok(results)
    }

    /// Calculate average vector from a collection of vectors
    /// Useful for folder-level aggregation
    pub fn average_vectors(vectors: &[Vec<f32>]) -> Result<Vec<f32>> {
        if vectors.is_empty() {
            return Err(anyhow!("Cannot average empty vector collection"));
        }

        let dimensions = vectors[0].len();
        
        // Verify all vectors have same dimensions
        for (i, vector) in vectors.iter().enumerate() {
            if vector.len() != dimensions {
                return Err(anyhow!(
                    "Vector {} has {} dimensions, expected {}",
                    i, vector.len(), dimensions
                ));
            }
        }

        let mut average = vec![0.0; dimensions];
        let count = vectors.len() as f32;

        for vector in vectors {
            for (i, &component) in vector.iter().enumerate() {
                average[i] += component / count;
            }
        }

        Ok(average)
    }

    /// Calculate weighted average of vectors
    /// weights.len() must equal vectors.len()
    pub fn weighted_average_vectors(
        vectors: &[Vec<f32>],
        weights: &[f32],
    ) -> Result<Vec<f32>> {
        if vectors.is_empty() {
            return Err(anyhow!("Cannot average empty vector collection"));
        }

        if vectors.len() != weights.len() {
            return Err(anyhow!(
                "Number of vectors ({}) doesn't match number of weights ({})",
                vectors.len(), weights.len()
            ));
        }

        let dimensions = vectors[0].len();
        let mut weighted_sum = vec![0.0; dimensions];
        let mut total_weight = 0.0;

        for (vector, &weight) in vectors.iter().zip(weights.iter()) {
            if vector.len() != dimensions {
                return Err(anyhow!("Vector dimension mismatch"));
            }

            total_weight += weight;
            
            for (i, &component) in vector.iter().enumerate() {
                weighted_sum[i] += component * weight;
            }
        }

        if total_weight == 0.0 {
            return Err(anyhow!("Total weight cannot be zero"));
        }

        // Normalize by total weight
        for component in weighted_sum.iter_mut() {
            *component /= total_weight;
        }

        Ok(weighted_sum)
    }

    /// Check if two vectors are approximately equal within tolerance
    pub fn vectors_equal_approx(a: &[f32], b: &[f32], tolerance: f32) -> bool {
        if a.len() != b.len() {
            return false;
        }

        a.iter()
            .zip(b.iter())
            .all(|(x, y)| (x - y).abs() < tolerance)
    }

    /// Quantize vector components to reduce memory usage
    /// Converts f32 to u8 values in range [0, 255]
    pub fn quantize_vector(vector: &[f32]) -> Vec<u8> {
        // Find min and max for scaling
        let min_val = vector.iter().fold(f32::INFINITY, |a, &b| a.min(b));
        let max_val = vector.iter().fold(f32::NEG_INFINITY, |a, &b| a.max(b));
        
        let range = max_val - min_val;
        
        if range == 0.0 {
            return vec![127; vector.len()]; // Return middle value for constant vectors
        }

        vector.iter()
            .map(|&x| {
                let normalized = (x - min_val) / range;
                (normalized * 255.0).round() as u8
            })
            .collect()
    }

    /// Dequantize vector back to f32 values
    /// Requires original min and max values for proper scaling
    pub fn dequantize_vector(quantized: &[u8], min_val: f32, max_val: f32) -> Vec<f32> {
        let range = max_val - min_val;
        
        quantized.iter()
            .map(|&x| {
                let normalized = x as f32 / 255.0;
                min_val + (normalized * range)
            })
            .collect()
    }
}

/// Helper struct for priority queue operations
#[derive(Debug, Clone)]
struct SimilarityScore {
    id: String,
    score: f32,
}

impl PartialEq for SimilarityScore {
    fn eq(&self, other: &Self) -> bool {
        self.score == other.score
    }
}

impl Eq for SimilarityScore {}

impl PartialOrd for SimilarityScore {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Reverse ordering for min-heap behavior (smallest similarity first)
        other.score.partial_cmp(&self.score)
    }
}

impl Ord for SimilarityScore {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap_or(Ordering::Equal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let similarity = VectorMath::cosine_similarity(&a, &b).unwrap();
        assert!((similarity - 1.0).abs() < 1e-6);

        let c = vec![1.0, 0.0, 0.0];
        let d = vec![0.0, 1.0, 0.0];
        let similarity = VectorMath::cosine_similarity(&c, &d).unwrap();
        assert!((similarity - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_euclidean_distance() {
        let a = vec![0.0, 0.0];
        let b = vec![3.0, 4.0];
        let distance = VectorMath::euclidean_distance(&a, &b).unwrap();
        assert!((distance - 5.0).abs() < 1e-6);
    }

    #[test]
    fn test_normalize() {
        let mut vector = vec![3.0, 4.0];
        VectorMath::normalize(&mut vector).unwrap();
        let magnitude = VectorMath::magnitude(&vector);
        assert!((magnitude - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_find_similar_vectors() {
        let query = vec![1.0, 0.0];
        let candidates = vec![
            ("id1".to_string(), vec![1.0, 0.0]),
            ("id2".to_string(), vec![0.0, 1.0]),
            ("id3".to_string(), vec![0.8, 0.6]),
        ];

        let results = VectorMath::find_similar_vectors(&query, &candidates, 2, 0.5).unwrap();
        
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "id1");
        assert!((results[0].1 - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_average_vectors() {
        let vectors = vec![
            vec![1.0, 2.0],
            vec![3.0, 4.0],
            vec![5.0, 6.0],
        ];

        let average = VectorMath::average_vectors(&vectors).unwrap();
        assert_eq!(average, vec![3.0, 4.0]);
    }

    #[test]
    fn test_weighted_average() {
        let vectors = vec![
            vec![1.0, 2.0],
            vec![3.0, 4.0],
        ];
        let weights = vec![1.0, 3.0];

        let weighted_avg = VectorMath::weighted_average_vectors(&vectors, &weights).unwrap();
        assert_eq!(weighted_avg, vec![2.5, 3.5]);
    }

    #[test]
    fn test_quantization() {
        let vector = vec![-1.0, 0.0, 1.0];
        let quantized = VectorMath::quantize_vector(&vector);
        assert_eq!(quantized, vec![0, 127, 255]);

        let dequantized = VectorMath::dequantize_vector(&quantized, -1.0, 1.0);
        assert!((dequantized[0] + 1.0).abs() < 0.01);
        assert!(dequantized[1].abs() < 0.01);
        assert!((dequantized[2] - 1.0).abs() < 0.01);
    }
}