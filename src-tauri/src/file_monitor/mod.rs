use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
// use std::time::SystemTime; // Unused import

use anyhow::{Result, anyhow};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher, Config};
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, Duration};
use walkdir::WalkDir;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::database::{Database, FileRecord};
use crate::processing_queue::{ProcessingQueue, JobPriority};

#[derive(Debug, Clone)]
pub struct FileMonitor {
    database: Database,
    processing_queue: Option<Arc<tokio::sync::Mutex<ProcessingQueue>>>,
    watched_paths: Arc<RwLock<HashSet<PathBuf>>>,
    excluded_patterns: Arc<RwLock<Vec<String>>>,
    max_file_size: u64,
}

#[derive(Debug)]
pub struct FileEvent {
    pub path: PathBuf,
    pub event_type: FileEventType,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug)]
pub enum FileEventType {
    Created,
    Modified,
    Deleted,
    Renamed { from: PathBuf, to: PathBuf },
}

impl FileMonitor {
    pub fn new(database: Database) -> Self {
        Self {
            database,
            processing_queue: None,
            watched_paths: Arc::new(RwLock::new(HashSet::new())),
            excluded_patterns: Arc::new(RwLock::new(vec![
                ".git".to_string(),
                "node_modules".to_string(),
                ".DS_Store".to_string(),
                "Thumbs.db".to_string(),
                ".tmp".to_string(),
                ".temp".to_string(),
            ])),
            max_file_size: 100 * 1024 * 1024, // 100MB default
        }
    }
    
    pub fn with_processing_queue(mut self, processing_queue: Arc<tokio::sync::Mutex<ProcessingQueue>>) -> Self {
        self.processing_queue = Some(processing_queue);
        self
    }

    pub async fn add_watch_path<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref().to_path_buf();
        
        if !path.exists() {
            return Err(anyhow!("Path does not exist: {}", path.display()));
        }

        let mut watched_paths = self.watched_paths.write().await;
        watched_paths.insert(path.clone());
        
        // Perform initial scan of the path
        self.scan_directory(&path).await?;
        
        tracing::info!("Added watch path: {}", path.display());
        Ok(())
    }

    pub async fn remove_watch_path<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref().to_path_buf();
        let mut watched_paths = self.watched_paths.write().await;
        watched_paths.remove(&path);
        
        tracing::info!("Removed watch path: {}", path.display());
        Ok(())
    }

    pub async fn start_monitoring(&self) -> Result<()> {
        let (tx, mut rx) = mpsc::channel::<FileEvent>(1000);
        
        // Start file watcher
        let _watcher_handle = self.start_file_watcher(tx.clone()).await?;
        
        // Start processing events
        let database = self.database.clone();
        let processing_queue = self.processing_queue.clone();
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                if let Err(e) = Self::process_file_event(&database, &processing_queue, event).await {
                    tracing::error!("Failed to process file event: {}", e);
                }
            }
        });

        // Start periodic rescan
        self.start_periodic_rescan().await;

        tracing::info!("File monitoring started");
        Ok(())
    }

    async fn start_file_watcher(&self, tx: mpsc::Sender<FileEvent>) -> Result<RecommendedWatcher> {
        let watched_paths = self.watched_paths.clone();
        let excluded_patterns = self.excluded_patterns.clone();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                let tx = tx.clone();
                let watched_paths = watched_paths.clone();
                let excluded_patterns = excluded_patterns.clone();
                
                tokio::spawn(async move {
                    match res {
                        Ok(event) => {
                            if let Err(e) = Self::handle_notify_event(event, tx, watched_paths, excluded_patterns).await {
                                tracing::error!("Failed to handle file event: {}", e);
                            }
                        }
                        Err(e) => tracing::error!("File watcher error: {}", e),
                    }
                });
            },
            Config::default(),
        )?;

        // Watch all configured paths
        let paths = self.watched_paths.read().await;
        for path in paths.iter() {
            watcher.watch(path, RecursiveMode::Recursive)?;
            tracing::info!("Watching path: {}", path.display());
        }

        Ok(watcher)
    }

    async fn handle_notify_event(
        event: Event,
        tx: mpsc::Sender<FileEvent>,
        _watched_paths: Arc<RwLock<HashSet<PathBuf>>>,
        excluded_patterns: Arc<RwLock<Vec<String>>>,
    ) -> Result<()> {
        let patterns = excluded_patterns.read().await;
        
        for path in event.paths {
            // Check if path should be excluded
            if Self::should_exclude_path(&path, &patterns) {
                continue;
            }

            let file_event = match event.kind {
                EventKind::Create(_) => FileEvent {
                    path: path.clone(),
                    event_type: FileEventType::Created,
                    timestamp: Utc::now(),
                },
                EventKind::Modify(_) => FileEvent {
                    path: path.clone(),
                    event_type: FileEventType::Modified,
                    timestamp: Utc::now(),
                },
                EventKind::Remove(_) => FileEvent {
                    path: path.clone(),
                    event_type: FileEventType::Deleted,
                    timestamp: Utc::now(),
                },
                _ => continue,
            };

            if let Err(e) = tx.send(file_event).await {
                tracing::error!("Failed to send file event: {}", e);
            }
        }

        Ok(())
    }

    async fn process_file_event(
        database: &Database,
        processing_queue: &Option<Arc<tokio::sync::Mutex<ProcessingQueue>>>,
        event: FileEvent,
    ) -> Result<()> {
        match event.event_type {
            FileEventType::Created | FileEventType::Modified => {
                if event.path.is_file() {
                    Self::process_file_with_queue(database, processing_queue, &event.path).await?;
                }
            }
            FileEventType::Deleted => {
                // Remove from database if it exists
                if let Some(file) = database.get_file_by_path(&event.path.to_string_lossy()).await? {
                    // Mark as deleted or remove entirely
                    database.update_file_status(&file.id, "deleted", None).await?;
                }
            }
            FileEventType::Renamed { from: _, to } => {
                if to.is_file() {
                    Self::process_file_with_queue(database, processing_queue, &to).await?;
                }
            }
        }

        Ok(())
    }

    async fn process_file_with_queue(
        database: &Database,
        processing_queue: &Option<Arc<tokio::sync::Mutex<ProcessingQueue>>>,
        path: &Path,
    ) -> Result<()> {
        // Get file metadata
        let metadata = tokio::fs::metadata(path).await?;
        
        // Skip if file is too large
        if metadata.len() > 100 * 1024 * 1024 {
            tracing::debug!("Skipping large file: {} ({} bytes)", path.display(), metadata.len());
            return Ok(());
        }

        // Create file record
        let file_id = Uuid::new_v4().to_string();
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        
        let extension = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase());

        let mime_type = mime_guess::from_path(path).first()
            .map(|m| m.to_string());

        let created_at = metadata.created()
            .map(|t| DateTime::<Utc>::from(t))
            .unwrap_or_else(|_| Utc::now());

        let modified_at = metadata.modified()
            .map(|t| DateTime::<Utc>::from(t))
            .unwrap_or_else(|_| Utc::now());

        let file_record = FileRecord {
            id: file_id,
            path: path.to_string_lossy().to_string(),
            name: file_name,
            extension,
            size: metadata.len() as i64,
            created_at,
            modified_at,
            last_accessed: None,
            mime_type,
            hash: None,
            content: None, // Will be populated during processing
            tags: None,
            metadata: None,
            ai_analysis: None,
            embedding: None,
            indexed_at: None,
            processing_status: "pending".to_string(),
            error_message: None,
        };

        // Check if file already exists in database
        match database.file_exists(&file_record.path).await {
            Ok(true) => {
                tracing::info!("File already exists in database, skipping: {}", path.display());
                return Ok(());
            }
            Ok(false) => {
                // File doesn't exist, continue with insertion
            }
            Err(e) => {
                tracing::warn!("Could not check if file exists (database might be corrupted), continuing: {}", e);
                // Continue anyway, INSERT OR REPLACE will handle duplicates
            }
        }
        
        // Insert or update file record
        tracing::debug!("Inserting file record into database: {}", path.display());
        match database.insert_file(&file_record).await {
            Ok(()) => {
                tracing::debug!("Successfully inserted file record: {}", path.display());
            }
            Err(e) => {
                tracing::error!("Failed to insert file record for {}: {:?}", path.display(), e);
                return Err(e);
            }
        }
        
        // Add to processing queue if available
        if let Some(queue) = processing_queue {
            tracing::debug!("Adding file to processing queue: {}", path.display());
            let queue_guard = queue.lock().await;
            if let Err(e) = queue_guard.add_job(&file_record, JobPriority::Normal).await {
                tracing::error!("Failed to add file to processing queue: {}", e);
                // Don't fail the entire operation if queue addition fails
            } else {
                tracing::debug!("Successfully added file to processing queue: {}", path.display());
            }
        } else {
            tracing::warn!("No processing queue available for file: {}", path.display());
        }
        
        tracing::debug!("Successfully processed file: {}", path.display());
        Ok(())
    }

    pub async fn scan_directory<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();
        let excluded_patterns = self.excluded_patterns.read().await;
        let mut processed_count = 0;

        tracing::info!("Starting directory scan: {}", path.display());

        for entry in WalkDir::new(path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();
            
            // Skip if should be excluded
            if Self::should_exclude_path(entry_path, &excluded_patterns) {
                continue;
            }

            // Only process files
            if entry_path.is_file() {
                if let Err(e) = Self::process_file_with_queue(&self.database, &self.processing_queue, entry_path).await {
                    tracing::error!("Failed to process file {}: {}", entry_path.display(), e);
                } else {
                    processed_count += 1;
                    
                    // Log progress every 100 files
                    if processed_count % 100 == 0 {
                        tracing::info!("Scanned {} files...", processed_count);
                    }
                }
            }
        }

        tracing::info!("Directory scan completed. Processed {} files from {}", 
                      processed_count, path.display());
        Ok(())
    }

    async fn start_periodic_rescan(&self) {
        let watched_paths = self.watched_paths.clone();
        let database = self.database.clone();
        let excluded_patterns = self.excluded_patterns.clone();

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(3600)); // Rescan every hour
            
            loop {
                interval.tick().await;
                
                let paths = watched_paths.read().await.clone();
                for path in paths {
                    tracing::info!("Starting periodic rescan of: {}", path.display());
                    
                    // Create a temporary FileMonitor for the rescan
                    let monitor = FileMonitor {
                        database: database.clone(),
                        processing_queue: None, // No queue for periodic rescans
                        watched_paths: watched_paths.clone(),
                        excluded_patterns: excluded_patterns.clone(),
                        max_file_size: 100 * 1024 * 1024,
                    };
                    
                    if let Err(e) = monitor.scan_directory(&path).await {
                        tracing::error!("Periodic rescan failed for {}: {}", path.display(), e);
                    }
                }
            }
        });
    }

    pub async fn process_single_file_public(&self, path: &str) -> Result<()> {
        tracing::debug!("Starting single file processing for: {}", path);
        let path = std::path::Path::new(path);
        
        match Self::process_file_with_queue(&self.database, &self.processing_queue, path).await {
            Ok(()) => {
                tracing::debug!("Successfully processed single file: {}", path.display());
                Ok(())
            }
            Err(e) => {
                tracing::error!("Error in process_file_with_queue for {}: {:?}", path.display(), e);
                Err(e)
            }
        }
    }

    fn should_exclude_path(path: &Path, excluded_patterns: &[String]) -> bool {
        let path_str = path.to_string_lossy();
        
        for pattern in excluded_patterns {
            if path_str.contains(pattern) {
                return true;
            }
        }
        
        // Skip hidden files and directories
        if let Some(name) = path.file_name() {
            if name.to_string_lossy().starts_with('.') {
                return true;
            }
        }
        
        false
    }
}