use serde::{Deserialize, Serialize};
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("File system error: {0}")]
    FileSystem(String),
    
    #[error("AI processing error: {0}")]
    AIProcessing(String),
    
    #[error("Search engine error: {0}")]
    Search(String),
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("System monitor error: {0}")]
    SystemMonitor(String),
    
    #[error("Serialization error: {0}")]
    Serialization(String),
    
    #[error("Network error: {0}")]
    Network(String),
    
    #[error("Permission denied: {0}")]
    Permission(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::FileSystem(err.to_string())
    }
}

impl From<notify::Error> for AppError {
    fn from(err: notify::Error) -> Self {
        AppError::FileSystem(err.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Network(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}