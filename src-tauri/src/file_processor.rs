use crate::ai_integration::AIManager;
use crate::database::{Database, FileRecord};
use crate::error::{AppError, AppResult};
use crate::search_engine::SearchEngine;
use crate::system_monitor::SystemMonitor;

use chrono::Utc;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::{mpsc, RwLock, Semaphore};
use tokio::time::{interval, sleep};
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct ProcessingJob {
    pub id: String,
    pub path: PathBuf,
    pub priority: Priority,
    pub retry_count: u32,
    pub created_at: SystemTime,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
}

#[derive(Debug)]
pub struct FileProcessor {
    database: Arc<Database>,
    ai_manager: Arc<AIManager>,
    search_engine: Arc<SearchEngine>,
    system_monitor: Arc<SystemMonitor>,
    job_queue: Arc<RwLock<VecDeque<ProcessingJob>>>,
    processing_semaphore: Arc<Semaphore>,
    watched_paths: Arc<RwLock<Vec<PathBuf>>>,
    watcher: Arc<RwLock<Option<RecommendedWatcher>>>,
    stats: Arc<RwLock<ProcessingStats>>,
}

#[derive(Debug, Default)]
pub struct ProcessingStats {
    pub total_files_processed: u64,
    pub files_in_queue: u64,
    pub current_processing: u64,
    pub errors: u64,
    pub average_processing_time_ms: f64,
    pub last_processed_at: Option<SystemTime>,
}

impl FileProcessor {
    pub async fn new(
        database: Arc<Database>,
        ai_manager: Arc<AIManager>,
        search_engine: Arc<SearchEngine>,
        system_monitor: Arc<SystemMonitor>,
    ) -> AppResult<Self> {
        let max_concurrent = num_cpus::get().min(8); // Limit concurrent processing
        
        Ok(Self {
            database,
            ai_manager,
            search_engine,
            system_monitor,
            job_queue: Arc::new(RwLock::new(VecDeque::new())),
            processing_semaphore: Arc::new(Semaphore::new(max_concurrent)),
            watched_paths: Arc::new(RwLock::new(Vec::new())),
            watcher: Arc::new(RwLock::new(None)),
            stats: Arc::new(RwLock::new(ProcessingStats::default())),
        })
    }

    pub async fn start_monitoring(&self, paths: Vec<String>) -> AppResult<()> {
        let mut watched_paths = self.watched_paths.write().await;
        watched_paths.clear();
        watched_paths.extend(paths.iter().map(PathBuf::from));

        // Start file system watcher
        self.setup_watcher(paths.clone()).await?;

        // Start initial scan
        self.start_initial_scan(paths).await?;

        // Start processing loop
        self.start_processing_loop().await;

        Ok(())
    }

    async fn setup_watcher(&self, paths: Vec<String>) -> AppResult<()> {
        let (tx, mut rx) = mpsc::channel(1000);
        
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.try_send(event);
            }
        })?;

        // Watch all provided paths
        for path in &paths {
            let path = Path::new(path);
            if path.exists() {
                watcher.watch(path, RecursiveMode::Recursive)?;
                tracing::info!("Started watching: {}", path.display());
            }
        }

        *self.watcher.write().await = Some(watcher);

        // Spawn task to handle file system events
        let job_queue = self.job_queue.clone();
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                Self::handle_fs_event(event, job_queue.clone()).await;
            }
        });

        Ok(())
    }

    async fn handle_fs_event(event: Event, job_queue: Arc<RwLock<VecDeque<ProcessingJob>>>) {
        match event.kind {
            EventKind::Create(_) | EventKind::Modify(_) => {
                for path in event.paths {
                    if path.is_file() {
                        let job = ProcessingJob {
                            id: Uuid::new_v4().to_string(),
                            path,
                            priority: Priority::Medium,
                            retry_count: 0,
                            created_at: SystemTime::now(),
                        };
                        
                        let mut queue = job_queue.write().await;
                        queue.push_back(job);
                    }
                }
            }
            EventKind::Remove(_) => {
                // Handle file deletion - remove from database
                // This would be implemented based on specific requirements
            }
            _ => {}
        }
    }

    async fn start_initial_scan(&self, paths: Vec<String>) -> AppResult<()> {
        let job_queue = self.job_queue.clone();
        
        tokio::spawn(async move {
            for path in paths {
                let path = Path::new(&path);
                if path.exists() {
                    Self::scan_directory(path, job_queue.clone()).await;
                }
            }
        });

        Ok(())
    }

    async fn scan_directory(dir: &Path, job_queue: Arc<RwLock<VecDeque<ProcessingJob>>>) {
        let walker = WalkDir::new(dir)
            .follow_links(false)
            .max_depth(20);

        for entry in walker.into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                // Check if file should be excluded
                if Self::should_exclude_file(path) {
                    continue;
                }

                let job = ProcessingJob {
                    id: Uuid::new_v4().to_string(),
                    path: path.to_path_buf(),
                    priority: Priority::Low, // Initial scan has low priority
                    retry_count: 0,
                    created_at: SystemTime::now(),
                };

                let mut queue = job_queue.write().await;
                queue.push_back(job);
            }
        }
    }

    fn should_exclude_file(path: &Path) -> bool {
        let excluded_patterns = [
            ".DS_Store", ".git", "node_modules", "target", ".tmp", ".temp",
            ".log", ".cache", "thumbs.db", "desktop.ini"
        ];

        let path_str = path.to_string_lossy().to_lowercase();
        excluded_patterns.iter().any(|pattern| path_str.contains(pattern))
    }

    async fn start_processing_loop(&self) {
        let job_queue = self.job_queue.clone();
        let database = self.database.clone();
        let ai_manager = self.ai_manager.clone();
        let search_engine = self.search_engine.clone();
        let system_monitor = self.system_monitor.clone();
        let processing_semaphore = self.processing_semaphore.clone();
        let stats = self.stats.clone();

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_millis(100));
            
            loop {
                interval.tick().await;

                // Check system load before processing
                let system_info = system_monitor.get_current_load().await;
                if system_info.cpu_usage > 80.0 || system_info.memory_usage > 80.0 {
                    sleep(Duration::from_secs(5)).await;
                    continue;
                }

                // Get next job from queue
                let job = {
                    let mut queue = job_queue.write().await;
                    queue.pop_front()
                };

                if let Some(job) = job {
                    let permit = processing_semaphore.clone().acquire_owned().await;
                    if permit.is_ok() {
                        let database = database.clone();
                        let ai_manager = ai_manager.clone();
                        let search_engine = search_engine.clone();
                        let stats = stats.clone();
                        let job_queue_retry = job_queue.clone();

                        tokio::spawn(async move {
                            let _permit = permit.unwrap();
                            
                            match Self::process_file(job.clone(), database, ai_manager, search_engine).await {
                                Ok(_) => {
                                    let mut stats = stats.write().await;
                                    stats.total_files_processed += 1;
                                    stats.last_processed_at = Some(SystemTime::now());
                                }
                                Err(e) => {
                                    tracing::error!("Failed to process file {}: {}", job.path.display(), e);
                                    
                                    let mut stats = stats.write().await;
                                    stats.errors += 1;

                                    // Retry logic
                                    if job.retry_count < 3 {
                                        let mut retry_job = job;
                                        retry_job.retry_count += 1;
                                        retry_job.priority = Priority::High; // Increase priority for retries
                                        
                                        let mut queue = job_queue_retry.write().await;
                                        queue.push_front(retry_job); // Add to front for priority
                                    }
                                }
                            }
                        });
                    }
                }
            }
        });
    }

    async fn process_file(
        job: ProcessingJob,
        database: Arc<Database>,
        ai_manager: Arc<AIManager>,
        search_engine: Arc<SearchEngine>,
    ) -> AppResult<()> {
        let path = &job.path;
        
        // Check if file exists
        if !path.exists() {
            return Err(AppError::FileSystem(format!("File not found: {}", path.display())));
        }

        // Get file metadata
        let metadata = tokio::fs::metadata(path).await?;
        
        // Check file size limit (100MB default)
        if metadata.len() > 100 * 1024 * 1024 {
            return Err(AppError::FileSystem("File too large".to_string()));
        }

        // Create file record
        let file_record = FileRecord {
            id: Uuid::new_v4().to_string(),
            path: path.to_string_lossy().to_string(),
            name: path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            extension: path.extension()
                .map(|e| e.to_string_lossy().to_string()),
            size: metadata.len() as i64,
            created_at: metadata.created()
                .map(|t| t.into())
                .unwrap_or_else(|_| Utc::now()),
            modified_at: metadata.modified()
                .map(|t| t.into())
                .unwrap_or_else(|_| Utc::now()),
            last_accessed: metadata.accessed()
                .ok()
                .map(|t| t.into()),
            mime_type: Self::detect_mime_type(path),
            hash: None, // Could be computed if needed
            tags: None,
            metadata: None,
            ai_analysis: None,
            embedding: None,
            indexed_at: None,
            processing_status: "processing".to_string(),
            error_message: None,
        };

        // Insert into database
        database.insert_file(&file_record).await?;

        // Process with AI
        match ai_manager.analyze_file(path).await {
            Ok(analysis) => {
                let analysis_json = serde_json::to_string(&analysis)?;
                let embedding = analysis.embedding.as_ref().map(|e| {
                    e.iter().flat_map(|f| f.to_le_bytes()).collect::<Vec<u8>>()
                });

                database.update_file_ai_analysis(
                    &file_record.id,
                    &analysis_json,
                    embedding.as_deref(),
                ).await?;

                // Update search index
                search_engine.index_file(&file_record, &analysis).await?;
            }
            Err(e) => {
                database.update_file_status(
                    &file_record.id,
                    "error",
                    Some(&e.to_string()),
                ).await?;
                return Err(e);
            }
        }

        Ok(())
    }

    fn detect_mime_type(path: &Path) -> Option<String> {
        match path.extension().and_then(|e| e.to_str()) {
            Some("txt") => Some("text/plain".to_string()),
            Some("pdf") => Some("application/pdf".to_string()),
            Some("docx") => Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string()),
            Some("jpg") | Some("jpeg") => Some("image/jpeg".to_string()),
            Some("png") => Some("image/png".to_string()),
            Some("mp3") => Some("audio/mpeg".to_string()),
            Some("mp4") => Some("video/mp4".to_string()),
            _ => None,
        }
    }

    pub async fn get_status(&self) -> serde_json::Value {
        let stats = self.stats.read().await;
        let queue_size = self.job_queue.read().await.len();
        
        serde_json::json!({
            "total_processed": stats.total_files_processed,
            "queue_size": queue_size,
            "current_processing": stats.current_processing,
            "errors": stats.errors,
            "average_processing_time_ms": stats.average_processing_time_ms,
            "last_processed_at": stats.last_processed_at
        })
    }

    pub async fn stop(&self) -> AppResult<()> {
        // Stop the watcher
        let mut watcher = self.watcher.write().await;
        *watcher = None;
        
        // Clear the queue
        let mut queue = self.job_queue.write().await;
        queue.clear();
        
        Ok(())
    }
}