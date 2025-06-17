use std::sync::Arc;
use std::collections::VecDeque;
use tokio::sync::{RwLock, Semaphore};
use tokio::time::{interval, Duration, Instant};
use anyhow::Result;
use uuid::Uuid;

use crate::database::{Database, FileRecord};
use crate::content_extractor::ContentExtractor;
// use crate::ai_processor::AIProcessor; // Temporarily disabled

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
    // ai_processor: AIProcessor, // Temporarily disabled
    queue: Arc<RwLock<VecDeque<ProcessingJob>>>,
    processing_semaphore: Arc<Semaphore>,
    max_concurrent_jobs: usize,
    max_retries: u32,
}

impl ProcessingQueue {
    pub fn new(
        database: Database,
        max_concurrent_jobs: usize,
    ) -> Self {
        Self {
            database,
            // ai_processor, // Temporarily disabled
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
        // let ai_processor = self.ai_processor.clone(); // Temporarily disabled
        let semaphore = self.processing_semaphore.clone();
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
                    // Try to acquire semaphore for concurrent processing
                    let semaphore_clone = semaphore.clone();
                    if let Ok(permit) = semaphore_clone.try_acquire() {
                        let db = database.clone();
                        // let ai = ai_processor.clone(); // Temporarily disabled
                        let queue_for_retry = queue.clone();
                        
                        tokio::spawn(async move {
                            let _permit = permit; // Keep permit alive
                            
                            if let Err(e) = Self::process_job(&db, &job).await {
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
                    } else {
                        // Put job back in queue if no worker available
                        let mut queue_guard = queue.write().await;
                        queue_guard.push_front(job);
                    }
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
        job: &ProcessingJob,
    ) -> Result<()> {
        tracing::debug!("Processing job {} for file {}", job.id, job.file_path);
        
        // Update status to processing
        database.update_file_status(&job.file_id, "processing", None).await?;
        
        let start_time = Instant::now();
        
        // Extract content from file
        let extracted_content = ContentExtractor::extract_content(&job.file_path).await?;
        
        // Simple analysis without AI (for initial version)
        let simple_summary = if extracted_content.text.len() > 200 {
            format!("{}...", &extracted_content.text[..200])
        } else {
            extracted_content.text.clone()
        };
        
        let basic_tags = vec![extracted_content.file_type.clone()];
        let tags_json = serde_json::to_string(&basic_tags)?;
        
        // Update database with basic results
        database.update_file_analysis(
            &job.file_id,
            &simple_summary,
            Some(&tags_json),
            None, // No embeddings for now
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
        
        serde_json::json!({
            "total_queued": queue.len(),
            "active_workers": active_workers,
            "available_workers": available_workers,
            "priority_breakdown": priority_counts,
            "oldest_job_age_seconds": queue.front()
                .map(|job| job.created_at.elapsed().as_secs())
                .unwrap_or(0)
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
        
        Ok(serde_json::json!({
            "queue": queue_status,
            "database": db_stats,
            "ai_available": false // Temporarily disabled
        }))
    }
}