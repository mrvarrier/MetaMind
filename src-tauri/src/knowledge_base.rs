use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Knowledge base system for MetaMind
pub struct KnowledgeBase {
    documents: Arc<RwLock<HashMap<Uuid, Document>>>,
    entities: Arc<RwLock<HashMap<Uuid, Entity>>>,
    relationships: Arc<RwLock<HashMap<Uuid, Relationship>>>,
    insights: Arc<RwLock<HashMap<Uuid, Insight>>>,
    config: Arc<RwLock<KnowledgeBaseConfig>>,
    graph: Arc<RwLock<KnowledgeGraph>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeBaseConfig {
    pub enabled: bool,
    pub auto_extract_entities: bool,
    pub auto_generate_insights: bool,
    pub relationship_threshold: f32,
    pub max_documents: usize,
    pub retention_days: u32,
}

impl Default for KnowledgeBaseConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_extract_entities: true,
            auto_generate_insights: true,
            relationship_threshold: 0.7,
            max_documents: 100_000,
            retention_days: 365,
        }
    }
}

/// Document in the knowledge base
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: Uuid,
    pub file_path: PathBuf,
    pub title: String,
    pub content: String,
    pub summary: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub metadata: DocumentMetadata,
    pub entities: Vec<Uuid>,
    pub topics: Vec<String>,
    pub importance_score: f32,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub file_type: String,
    pub size: u64,
    pub language: Option<String>,
    pub author: Option<String>,
    pub tags: Vec<String>,
    pub source: DocumentSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DocumentSource {
    LocalFile,
    WebPage,
    Email,
    Note,
    External(String),
}

/// Entity extracted from documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: Uuid,
    pub name: String,
    pub entity_type: EntityType,
    pub description: Option<String>,
    pub aliases: Vec<String>,
    pub confidence: f32,
    pub occurrences: Vec<EntityOccurrence>,
    pub created_at: DateTime<Utc>,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityType {
    Person,
    Organization,
    Location,
    Date,
    Event,
    Concept,
    Technology,
    Product,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityOccurrence {
    pub document_id: Uuid,
    pub position: usize,
    pub context: String,
    pub confidence: f32,
}

/// Relationship between entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub id: Uuid,
    pub from_entity: Uuid,
    pub to_entity: Uuid,
    pub relationship_type: RelationshipType,
    pub strength: f32,
    pub evidence: Vec<Evidence>,
    pub created_at: DateTime<Utc>,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    WorksAt,
    LocatedIn,
    RelatedTo,
    PartOf,
    CreatedBy,
    DependsOn,
    SimilarTo,
    OppositeOf,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub document_id: Uuid,
    pub excerpt: String,
    pub confidence: f32,
    pub position: usize,
}

/// AI-generated insights
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Insight {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub insight_type: InsightType,
    pub confidence: f32,
    pub related_documents: Vec<Uuid>,
    pub related_entities: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    pub data: InsightData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InsightType {
    Trend,
    Pattern,
    Anomaly,
    Connection,
    Summary,
    Recommendation,
    Prediction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsightData {
    pub metrics: HashMap<String, f32>,
    pub timeline: Vec<TimelineEvent>,
    pub recommendations: Vec<String>,
    pub visualizations: Vec<VisualizationData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub date: DateTime<Utc>,
    pub event: String,
    pub importance: f32,
    pub related_entities: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizationData {
    pub chart_type: String,
    pub data_points: Vec<DataPoint>,
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataPoint {
    pub x: f32,
    pub y: f32,
    pub label: Option<String>,
}

/// Knowledge graph for relationship mapping
pub struct KnowledgeGraph {
    nodes: HashMap<Uuid, GraphNode>,
    edges: HashMap<Uuid, GraphEdge>,
    clusters: Vec<Cluster>,
    centrality_scores: HashMap<Uuid, f32>,
}

#[derive(Debug, Clone)]
pub struct GraphNode {
    pub id: Uuid,
    pub node_type: GraphNodeType,
    pub label: String,
    pub properties: HashMap<String, String>,
    pub connections: HashSet<Uuid>,
}

#[derive(Debug, Clone)]
pub enum GraphNodeType {
    Document,
    Entity,
    Topic,
    Concept,
}

#[derive(Debug, Clone)]
pub struct GraphEdge {
    pub id: Uuid,
    pub from_node: Uuid,
    pub to_node: Uuid,
    pub edge_type: String,
    pub weight: f32,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct Cluster {
    pub id: Uuid,
    pub name: String,
    pub nodes: HashSet<Uuid>,
    pub coherence_score: f32,
    pub topics: Vec<String>,
}

impl KnowledgeBase {
    pub async fn new(config: KnowledgeBaseConfig) -> Result<Self> {
        Ok(Self {
            documents: Arc::new(RwLock::new(HashMap::new())),
            entities: Arc::new(RwLock::new(HashMap::new())),
            relationships: Arc::new(RwLock::new(HashMap::new())),
            insights: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(config)),
            graph: Arc::new(RwLock::new(KnowledgeGraph::new())),
        })
    }

    /// Add a document to the knowledge base
    pub async fn add_document(&self, file_path: PathBuf, content: String, metadata: DocumentMetadata) -> Result<Uuid> {
        let config = self.config.read().await;
        if !config.enabled {
            return Err(anyhow::anyhow!("Knowledge base is disabled"));
        }

        let document_id = Uuid::new_v4();
        let title = self.extract_title(&content, &file_path);
        let summary = if config.auto_generate_insights {
            Some(self.generate_summary(&content).await?)
        } else {
            None
        };

        let mut document = Document {
            id: document_id,
            file_path,
            title,
            content: content.clone(),
            summary,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata,
            entities: Vec::new(),
            topics: Vec::new(),
            importance_score: 0.5,
            embedding: None,
        };

        // Extract entities if enabled
        if config.auto_extract_entities {
            let entities = self.extract_entities(&content, document_id).await?;
            document.entities = entities;
        }

        // Extract topics
        document.topics = self.extract_topics(&content).await?;

        // Generate embedding
        document.embedding = self.generate_embedding(&content).await?;

        // Calculate importance score
        document.importance_score = self.calculate_importance_score(&document).await?;

        // Add to graph
        self.add_document_to_graph(&document).await?;

        // Store document
        self.documents.write().await.insert(document_id, document);

        // Generate insights if enabled
        if config.auto_generate_insights {
            self.generate_document_insights(document_id).await?;
        }

        tracing::info!("Document added to knowledge base: {:?}", document_id);
        Ok(document_id)
    }

    /// Extract title from content or file path
    fn extract_title(&self, content: &str, file_path: &PathBuf) -> String {
        // Try to extract title from content (first line, markdown headers, etc.)
        let lines: Vec<&str> = content.lines().collect();
        
        for line in lines.iter().take(10) {
            let trimmed = line.trim();
            
            // Markdown header
            if trimmed.starts_with('#') {
                return trimmed.trim_start_matches('#').trim().to_string();
            }
            
            // Non-empty line that looks like a title
            if !trimmed.is_empty() && trimmed.len() < 100 && !trimmed.contains('\t') {
                return trimmed.to_string();
            }
        }

        // Fallback to filename
        file_path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    }

    /// Generate summary using AI
    async fn generate_summary(&self, content: &str) -> Result<String> {
        // This would integrate with the AI processor
        // For now, return a simple truncated version
        let words: Vec<&str> = content.split_whitespace().take(50).collect();
        Ok(words.join(" ") + "...")
    }

    /// Extract entities from content
    async fn extract_entities(&self, content: &str, document_id: Uuid) -> Result<Vec<Uuid>> {
        let mut entity_ids = Vec::new();

        // Simple entity extraction (in production, this would use NLP models)
        let potential_entities = self.simple_entity_extraction(content);

        for (name, entity_type, confidence) in potential_entities {
            let entity_id = self.get_or_create_entity(name, entity_type, confidence, document_id).await?;
            entity_ids.push(entity_id);
        }

        Ok(entity_ids)
    }

    /// Simple entity extraction (placeholder for real NLP)
    fn simple_entity_extraction(&self, content: &str) -> Vec<(String, EntityType, f32)> {
        let mut entities = Vec::new();
        let words: Vec<&str> = content.split_whitespace().collect();

        for window in words.windows(2) {
            let phrase = window.join(" ");
            
            // Simple patterns for demonstration
            if phrase.chars().all(|c| c.is_alphabetic() || c.is_whitespace()) &&
               phrase.chars().any(|c| c.is_uppercase()) &&
               phrase.len() > 3 {
                entities.push((phrase, EntityType::Person, 0.6));
            }
        }

        // Look for dates
        for word in &words {
            if word.len() == 4 && word.chars().all(|c| c.is_numeric()) {
                if let Ok(year) = word.parse::<i32>() {
                    if (1900..=2100).contains(&year) {
                        entities.push((word.to_string(), EntityType::Date, 0.8));
                    }
                }
            }
        }

        entities
    }

    /// Get existing entity or create new one
    async fn get_or_create_entity(&self, name: String, entity_type: EntityType, confidence: f32, document_id: Uuid) -> Result<Uuid> {
        let entities = self.entities.read().await;
        
        // Check if entity already exists
        let existing_entity_id = entities.values()
            .find(|entity| {
                entity.name.to_lowercase() == name.to_lowercase() && 
                std::mem::discriminant(&entity.entity_type) == std::mem::discriminant(&entity_type)
            })
            .map(|entity| entity.id);
        
        drop(entities);

        if let Some(entity_id) = existing_entity_id {
            // Add occurrence to existing entity
            let mut entities_write = self.entities.write().await;
            if let Some(entity) = entities_write.get_mut(&entity_id) {
                entity.occurrences.push(EntityOccurrence {
                    document_id,
                    position: 0, // Would be calculated properly
                    context: name.clone(),
                    confidence,
                });
            }
            return Ok(entity_id);
        }

        // Create new entity
        let entity_id = Uuid::new_v4();
        let entity = Entity {
            id: entity_id,
            name: name.clone(),
            entity_type,
            description: None,
            aliases: Vec::new(),
            confidence,
            occurrences: vec![EntityOccurrence {
                document_id,
                position: 0,
                context: name,
                confidence,
            }],
            created_at: Utc::now(),
            properties: HashMap::new(),
        };

        self.entities.write().await.insert(entity_id, entity);
        Ok(entity_id)
    }

    /// Extract topics from content
    async fn extract_topics(&self, content: &str) -> Result<Vec<String>> {
        // Simple topic extraction using word frequency
        let lowercase_content = content.to_lowercase();
        let words: Vec<&str> = lowercase_content
            .split_whitespace()
            .filter(|w| w.len() > 4)
            .collect();

        let mut word_count: HashMap<&str, usize> = HashMap::new();
        for word in words {
            *word_count.entry(word).or_insert(0) += 1;
        }

        let mut topics: Vec<String> = word_count
            .into_iter()
            .filter(|(_, count)| *count > 2)
            .map(|(word, _)| word.to_string())
            .collect();

        topics.sort();
        topics.truncate(10);
        Ok(topics)
    }

    /// Generate embedding for content
    async fn generate_embedding(&self, _content: &str) -> Result<Option<Vec<f32>>> {
        // This would integrate with the AI processor for real embeddings
        // For now, return None
        Ok(None)
    }

    /// Calculate importance score for document
    async fn calculate_importance_score(&self, document: &Document) -> Result<f32> {
        let mut score = 0.5; // Base score

        // Boost based on content length
        let word_count = document.content.split_whitespace().count();
        if word_count > 1000 {
            score += 0.2;
        } else if word_count > 500 {
            score += 0.1;
        }

        // Boost based on entities found
        score += (document.entities.len() as f32 * 0.05).min(0.3);

        // Boost based on file type
        match document.metadata.file_type.as_str() {
            "pdf" | "doc" | "docx" => score += 0.1,
            "txt" | "md" => score += 0.05,
            _ => {}
        }

        Ok(score.min(1.0))
    }

    /// Add document to knowledge graph
    async fn add_document_to_graph(&self, document: &Document) -> Result<()> {
        let mut graph = self.graph.write().await;

        let node = GraphNode {
            id: document.id,
            node_type: GraphNodeType::Document,
            label: document.title.clone(),
            properties: {
                let mut props = HashMap::new();
                props.insert("file_path".to_string(), document.file_path.to_string_lossy().to_string());
                props.insert("importance".to_string(), document.importance_score.to_string());
                props
            },
            connections: HashSet::new(),
        };

        graph.nodes.insert(document.id, node);
        Ok(())
    }

    /// Generate insights for a document
    async fn generate_document_insights(&self, document_id: Uuid) -> Result<()> {
        // This would generate AI-powered insights
        // For now, create a simple insight
        let insight_id = Uuid::new_v4();
        let insight = Insight {
            id: insight_id,
            title: "Document Analysis".to_string(),
            description: "Basic document analysis completed".to_string(),
            insight_type: InsightType::Summary,
            confidence: 0.7,
            related_documents: vec![document_id],
            related_entities: Vec::new(),
            created_at: Utc::now(),
            data: InsightData {
                metrics: HashMap::new(),
                timeline: Vec::new(),
                recommendations: Vec::new(),
                visualizations: Vec::new(),
            },
        };

        self.insights.write().await.insert(insight_id, insight);
        Ok(())
    }

    /// Search documents by content
    pub async fn search_documents(&self, query: &str, limit: usize) -> Result<Vec<Document>> {
        let documents = self.documents.read().await;
        let mut results: Vec<Document> = documents
            .values()
            .filter(|doc| {
                doc.content.to_lowercase().contains(&query.to_lowercase()) ||
                doc.title.to_lowercase().contains(&query.to_lowercase()) ||
                doc.topics.iter().any(|topic| topic.to_lowercase().contains(&query.to_lowercase()))
            })
            .cloned()
            .collect();

        // Sort by importance score
        results.sort_by(|a, b| b.importance_score.partial_cmp(&a.importance_score).unwrap());
        results.truncate(limit);
        Ok(results)
    }

    /// Get entities related to a document
    pub async fn get_document_entities(&self, document_id: Uuid) -> Result<Vec<Entity>> {
        let documents = self.documents.read().await;
        let entities = self.entities.read().await;

        if let Some(document) = documents.get(&document_id) {
            let mut result = Vec::new();
            for entity_id in &document.entities {
                if let Some(entity) = entities.get(entity_id) {
                    result.push(entity.clone());
                }
            }
            Ok(result)
        } else {
            Err(anyhow::anyhow!("Document not found"))
        }
    }

    /// Get insights for a document
    pub async fn get_document_insights(&self, document_id: Uuid) -> Result<Vec<Insight>> {
        let insights = self.insights.read().await;
        let results: Vec<Insight> = insights
            .values()
            .filter(|insight| insight.related_documents.contains(&document_id))
            .cloned()
            .collect();
        Ok(results)
    }

    /// Find related documents
    pub async fn find_related_documents(&self, document_id: Uuid, limit: usize) -> Result<Vec<Document>> {
        let documents = self.documents.read().await;
        
        if let Some(source_doc) = documents.get(&document_id) {
            let mut scored_docs: Vec<(Document, f32)> = Vec::new();

            for (id, doc) in documents.iter() {
                if *id == document_id {
                    continue;
                }

                let similarity = self.calculate_document_similarity(source_doc, doc).await;
                if similarity > 0.3 {
                    scored_docs.push((doc.clone(), similarity));
                }
            }

            scored_docs.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
            scored_docs.truncate(limit);
            
            Ok(scored_docs.into_iter().map(|(doc, _)| doc).collect())
        } else {
            Err(anyhow::anyhow!("Document not found"))
        }
    }

    /// Calculate similarity between documents
    async fn calculate_document_similarity(&self, doc1: &Document, doc2: &Document) -> f32 {
        let mut similarity = 0.0;

        // Topic overlap
        let doc1_topics: HashSet<_> = doc1.topics.iter().collect();
        let doc2_topics: HashSet<_> = doc2.topics.iter().collect();
        let common_topics = doc1_topics.intersection(&doc2_topics).count();
        
        let total_topics = doc1.topics.len() + doc2.topics.len();
        if total_topics > 0 {
            similarity += (common_topics as f32 / total_topics as f32) * 0.5;
        }

        // Entity overlap
        let doc1_entities: HashSet<_> = doc1.entities.iter().collect();
        let doc2_entities: HashSet<_> = doc2.entities.iter().collect();
        let common_entities = doc1_entities.intersection(&doc2_entities).count();
        
        let total_entities = doc1.entities.len() + doc2.entities.len();
        if total_entities > 0 {
            similarity += (common_entities as f32 / total_entities as f32) * 0.5;
        }

        similarity.min(1.0)
    }

    /// Get knowledge graph statistics
    pub async fn get_graph_statistics(&self) -> Result<GraphStatistics> {
        let graph = self.graph.read().await;
        let documents = self.documents.read().await;
        let entities = self.entities.read().await;
        let relationships = self.relationships.read().await;

        Ok(GraphStatistics {
            total_documents: documents.len(),
            total_entities: entities.len(),
            total_relationships: relationships.len(),
            total_nodes: graph.nodes.len(),
            total_edges: graph.edges.len(),
            average_connections: if !graph.nodes.is_empty() {
                graph.nodes.values().map(|n| n.connections.len()).sum::<usize>() as f32 / graph.nodes.len() as f32
            } else {
                0.0
            },
        })
    }
}

impl KnowledgeGraph {
    fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
            clusters: Vec::new(),
            centrality_scores: HashMap::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphStatistics {
    pub total_documents: usize,
    pub total_entities: usize,
    pub total_relationships: usize,
    pub total_nodes: usize,
    pub total_edges: usize,
    pub average_connections: f32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_knowledge_base_creation() {
        let config = KnowledgeBaseConfig::default();
        let kb = KnowledgeBase::new(config).await.unwrap();
        let stats = kb.get_graph_statistics().await.unwrap();
        assert_eq!(stats.total_documents, 0);
    }

    #[tokio::test]
    async fn test_add_document() {
        let config = KnowledgeBaseConfig::default();
        let kb = KnowledgeBase::new(config).await.unwrap();
        
        let metadata = DocumentMetadata {
            file_type: "txt".to_string(),
            size: 100,
            language: Some("en".to_string()),
            author: None,
            tags: vec!["test".to_string()],
            source: DocumentSource::LocalFile,
        };

        let doc_id = kb.add_document(
            PathBuf::from("test.txt"),
            "This is a test document with some content.".to_string(),
            metadata,
        ).await.unwrap();

        assert!(!doc_id.is_nil());
    }

    #[tokio::test]
    async fn test_search_documents() {
        let config = KnowledgeBaseConfig::default();
        let kb = KnowledgeBase::new(config).await.unwrap();
        
        let results = kb.search_documents("test", 10).await.unwrap();
        assert!(results.is_empty()); // No documents added yet
    }
}