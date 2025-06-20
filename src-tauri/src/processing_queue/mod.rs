use std::sync::Arc;
use std::collections::VecDeque;
use tokio::sync::{RwLock, Semaphore};
use tokio::time::{interval, Duration, Instant};
use anyhow::Result;
use uuid::Uuid;

use crate::database::{Database, FileRecord};
use crate::content_extractor::ContentExtractor;
use crate::ai_processor::AIProcessor;

#[derive(Debug, Clone)]
pub struct ProcessingJob {
    pub id: String,
    pub file_id: String,
    pub file_path: String,
    pub priority: JobPriority,
    pub created_at: Instant,
    pub retry_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum JobPriority {
    Low = 1,
    Normal = 2,
    High = 3,
    Critical = 4,
}

#[derive(Debug)]
pub struct ProcessingQueue {
    database: Database,
    ai_processor: AIProcessor,
    queue: Arc<RwLock<VecDeque<ProcessingJob>>>,
    processing_semaphore: Arc<Semaphore>,
    max_concurrent_jobs: usize,
    max_retries: u32,
}

impl ProcessingQueue {
    pub fn new(
        database: Database,
        ai_processor: AIProcessor,
        max_concurrent_jobs: usize,
    ) -> Self {
        Self {
            database,
            ai_processor,
            queue: Arc::new(RwLock::new(VecDeque::new())),
            processing_semaphore: Arc::new(Semaphore::new(max_concurrent_jobs)),
            max_concurrent_jobs,
            max_retries: 3,
        }
    }

    pub async fn start_processing(&self) -> Result<()> {
        // Start the main processing loop
        let queue = self.queue.clone();
        let database = self.database.clone();
        let ai_processor = self.ai_processor.clone();
        let _semaphore = self.processing_semaphore.clone();
        let max_retries = self.max_retries;

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_millis(100));
            
            loop {
                interval.tick().await;
                
                // Get next job from queue
                let job = {
                    let mut queue_guard = queue.write().await;
                    queue_guard.pop_front()
                };
                
                if let Some(job) = job {
                    // Simplified processing without semaphore for now
                    let db = database.clone();
                    let ai = ai_processor.clone();
                    let queue_for_retry = queue.clone();
                    
                    tokio::spawn(async move {
                        if let Err(e) = Self::process_job(&db, &ai, &job).await {
                            tracing::error!("Job {} failed: {}", job.id, e);
                            
                            // Retry logic
                            if job.retry_count < max_retries {
                                let mut retry_job = job.clone();
                                retry_job.retry_count += 1;
                                retry_job.created_at = Instant::now();
                                
                                // Add delay before retry
                                tokio::time::sleep(Duration::from_secs(2u64.pow(retry_job.retry_count))).await;
                                
                                let mut queue_guard = queue_for_retry.write().await;
                                queue_guard.push_back(retry_job);
                            } else {
                                // Mark as failed in database
                                if let Err(e) = db.update_file_status(&job.file_id, "error", Some(&e.to_string())).await {
                                    tracing::error!("Failed to update file status: {}", e);
                                }
                            }
                        }
                    });
                }
            }
        });

        // Start periodic queue maintenance
        self.start_queue_maintenance().await;
        
        tracing::info!("Processing queue started with {} workers", self.max_concurrent_jobs);
        Ok(())
    }

    async fn process_job(
        database: &Database,
        ai_processor: &AIProcessor,
        job: &ProcessingJob,
    ) -> Result<()> {
        tracing::debug!("Processing job {} for file {}", job.id, job.file_path);
        
        // Update status to processing
        database.update_file_status(&job.file_id, "processing", None).await?;
        
        let start_time = Instant::now();
        
        // Extract content from file
        let extracted_content = ContentExtractor::extract_content(&job.file_path).await?;
        
        tracing::debug!("Extracted content length: {} characters", extracted_content.text.len());
        
        // Limit content size to prevent database corruption (max 1MB of text)
        const MAX_CONTENT_SIZE: usize = 1_000_000;
        let truncated_content = if extracted_content.text.len() > MAX_CONTENT_SIZE {
            tracing::warn!("Content too large ({}), truncating to {} characters", 
                          extracted_content.text.len(), MAX_CONTENT_SIZE);
            format!("{}...\n\n[Content truncated due to size limit]", 
                   &extracted_content.text[..MAX_CONTENT_SIZE])
        } else {
            extracted_content.text.clone()
        };
        
        // Perform AI analysis if available
        let (summary, tags_json, embedding) = if ai_processor.is_available().await {
            tracing::debug!("Performing AI analysis for file {}", job.file_path);
            
            match ai_processor.analyze_content(&extracted_content).await {
                Ok(analysis) => {
                    let tags_json = serde_json::to_string(&analysis.tags)?;
                    (analysis.summary, Some(tags_json), analysis.embedding)
                }
                Err(e) => {
                    tracing::warn!("AI analysis failed for {}: {}, falling back to basic analysis", job.file_path, e);
                    
                    // Fallback to simple analysis
                    let simple_summary = if truncated_content.len() > 200 {
                        format!("{}...", &truncated_content[..200])
                    } else {
                        truncated_content.clone()
                    };
                    let basic_tags = vec![extracted_content.file_type.clone()];
                    let tags_json = serde_json::to_string(&basic_tags)?;
                    (simple_summary, Some(tags_json), None)
                }
            }
        } else {
            tracing::debug!("AI processor not available, using basic analysis for {}", job.file_path);
            
            // Simple analysis without AI
            let simple_summary = if truncated_content.len() > 200 {
                format!("{}...", &truncated_content[..200])
            } else {
                truncated_content.clone()
            };
            let basic_tags = vec![extracted_content.file_type.clone()];
            let tags_json = serde_json::to_string(&basic_tags)?;
            (simple_summary, Some(tags_json), None)
        };
        
        tracing::debug!("Updating database with content length: {}", truncated_content.len());
        
        // Update database with analysis results
        database.update_file_analysis(
            &job.file_id,
            &truncated_content, // Store truncated content to prevent corruption
            &summary,
            tags_json.as_deref(),
            embedding.as_deref(),
        ).await?;
        
        let processing_time = start_time.elapsed();
        tracing::info!(
            "Successfully processed file {} in {:?}",
            job.file_path,
            processing_time
        );
        
        Ok(())
    }

    pub async fn add_job(&self, file_record: &FileRecord, priority: JobPriority) -> Result<()> {
        let job = ProcessingJob {
            id: Uuid::new_v4().to_string(),
            file_id: file_record.id.clone(),
            file_path: file_record.path.clone(),
            priority,
            created_at: Instant::now(),
            retry_count: 0,
        };
        
        let mut queue = self.queue.write().await;
        
        // Insert job based on priority
        let insert_pos = queue
            .iter()
            .position(|existing_job| existing_job.priority < job.priority)
            .unwrap_or(queue.len());
        
        queue.insert(insert_pos, job);
        
        tracing::debug!("Added processing job for file: {}", file_record.path);
        Ok(())
    }

    pub async fn get_queue_status(&self) -> serde_json::Value {
        let queue = self.queue.read().await;
        let available_workers = self.processing_semaphore.available_permits();
        let active_workers = self.max_concurrent_jobs - available_workers;
        
        let priority_counts = queue.iter().fold(
            std::collections::HashMap::new(),
            |mut acc, job| {
                *acc.entry(format!("{:?}", job.priority)).or_insert(0) += 1;
                acc
            }
        );
        
        let avg_retry_count = if queue.is_empty() {
            0.0
        } else {
            queue.iter().map(|job| job.retry_count as f64).sum::<f64>() / queue.len() as f64
        };
        
        serde_json::json!({
            "total_queued": queue.len(),
            "active_workers": active_workers,
            "available_workers": available_workers,
            "priority_breakdown": priority_counts,
            "oldest_job_age_seconds": queue.front()
                .map(|job| job.created_at.elapsed().as_secs())
                .unwrap_or(0),
            "average_retry_count": avg_retry_count,
            "processing_efficiency": if queue.is_empty() { 100.0 } else { 
                (1.0 - avg_retry_count / self.max_retries as f64) * 100.0 
            }
        })
    }

    pub async fn clear_queue(&self) {
        let mut queue = self.queue.write().await;
        queue.clear();
        tracing::info!("Processing queue cleared");
    }

    pub async fn pause_processing(&self) {
        // Acquire all permits to effectively pause processing
        for _ in 0..self.max_concurrent_jobs {
            let _ = self.processing_semaphore.acquire().await;
        }
        tracing::info!("Processing paused");
    }

    pub fn resume_processing(&self) {
        // Release all permits to resume processing
        self.processing_semaphore.add_permits(self.max_concurrent_jobs);
        tracing::info!("Processing resumed");
    }

    async fn start_queue_maintenance(&self) {
        let queue = self.queue.clone();
        
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(300)); // Every 5 minutes
            
            loop {
                interval.tick().await;
                
                // Remove old failed jobs
                let mut queue_guard = queue.write().await;
                let original_len = queue_guard.len();
                
                queue_guard.retain(|job| {
                    // Remove jobs older than 1 hour that have max retries
                    !(job.retry_count >= 3 && job.created_at.elapsed() > Duration::from_secs(3600))
                });
                
                let removed = original_len - queue_guard.len();
                if removed > 0 {
                    tracing::info!("Queue maintenance: removed {} stale jobs", removed);
                }
            }
        });
    }

    pub async fn requeue_pending_files(&self) -> Result<()> {
        let pending_files = self.database.get_files_by_status("pending").await?;
        let count = pending_files.len();
        
        for file in pending_files {
            self.add_job(&file, JobPriority::Normal).await?;
        }
        
        tracing::info!("Requeued {} pending files", count);
        Ok(())
    }

    pub async fn get_statistics(&self) -> Result<serde_json::Value> {
        let queue_status = self.get_queue_status().await;
        let db_stats = self.database.get_processing_stats().await?;
        let ai_available = self.ai_processor.is_available().await;
        
        Ok(serde_json::json!({
            "queue": queue_status,
            "database": db_stats,
            "ai_available": ai_available,
            "performance": {
                "max_workers": self.max_concurrent_jobs,
                "max_retries": self.max_retries,
                "ai_analysis_enabled": ai_available
            }
        }))
    }

    pub async fn get_processing_insights(&self) -> Result<serde_json::Value> {
        let queue = self.queue.read().await;
        let ai_available = self.ai_processor.is_available().await;
        
        // Calculate processing insights
        let total_jobs = queue.len();
        let high_priority_jobs = queue.iter().filter(|job| matches!(job.priority, JobPriority::High | JobPriority::Critical)).count();
        let retry_jobs = queue.iter().filter(|job| job.retry_count > 0).count();
        
        let oldest_job_hours = queue.front()
            .map(|job| job.created_at.elapsed().as_secs() as f64 / 3600.0)
            .unwrap_or(0.0);
        
        Ok(serde_json::json!({
            "total_jobs_queued": total_jobs,
            "high_priority_jobs": high_priority_jobs,
            "retry_jobs": retry_jobs,
            "oldest_job_hours": oldest_job_hours,
            "ai_processing_enabled": ai_available,
            "estimated_completion_hours": if total_jobs == 0 { 0.0 } else {
                // Rough estimate: 2 seconds per file average
                (total_jobs as f64 * 2.0) / 3600.0
            },
            "recommendations": self.generate_recommendations(total_jobs, high_priority_jobs, retry_jobs, oldest_job_hours, ai_available)
        }))
    }

    fn generate_recommendations(&self, total_jobs: usize, high_priority_jobs: usize, retry_jobs: usize, oldest_job_hours: f64, ai_available: bool) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        if total_jobs > 100 {
            recommendations.push("Consider increasing worker count for faster processing".to_string());
        }
        
        if retry_jobs > total_jobs / 4 {
            recommendations.push("High retry rate detected - check file permissions and corruption".to_string());
        }
        
        if oldest_job_hours > 24.0 {
            recommendations.push("Jobs over 24 hours old detected - consider queue maintenance".to_string());
        }
        
        if !ai_available {
            recommendations.push("AI processing unavailable - install and start Ollama for enhanced analysis".to_string());
        }
        
        if high_priority_jobs > total_jobs / 2 {
            recommendations.push("Many high priority jobs - consider processing them first".to_string());
        }
        
        if recommendations.is_empty() {
            recommendations.push("Processing queue is healthy".to_string());
        }
        
        recommendations
    }
}