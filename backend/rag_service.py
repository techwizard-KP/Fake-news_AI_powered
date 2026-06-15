# backend/rag_service.py
import chromadb
from sentence_transformers import SentenceTransformer
from datetime import datetime
import asyncio
from typing import List, Dict, Any

class RAGService:
    def __init__(self):
        # Initialize embedding model (small, fast, works locally)
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize vector database
        self.client = chromadb.PersistentClient(path="./chroma_db")
        
        # Get or create collection for analysis history
        self.collection = self.client.get_or_create_collection(
            name="analysis_history",
            metadata={"hnsw:space": "cosine"}
        )
    
    async def add_analysis(self, analysis: Dict[str, Any]):
        """Add a new analysis to the vector database"""
        try:
            # Create text to embed (combine title, body, verdict)
            text_to_embed = f"""
            Title: {analysis.get('title', '')}
            Content: {analysis.get('body', '')[:1000]}
            Verdict: {analysis.get('verdict', '')}
            Confidence: {analysis.get('confidence', 0)}
            """
            
            # Generate embedding
            embedding = self.embedder.encode(text_to_embed).tolist()
            
            # Add to ChromaDB
            self.collection.add(
                ids=[analysis['id']],
                embeddings=[embedding],
                metadatas=[{
                    'id': analysis['id'],
                    'title': analysis.get('title', ''),
                    'verdict': analysis.get('verdict', ''),
                    'confidence': analysis.get('confidence', 0),
                    'created_at': analysis.get('created_at', ''),
                    'url': analysis.get('url', '')
                }],
                documents=[text_to_embed[:2000]]
            )
            print(f"✅ Added analysis {analysis['id']} to RAG index")
        except Exception as e:
            print(f"❌ Failed to add analysis to RAG: {e}")
    
    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar analyses"""
        try:
            # Embed the query
            query_embedding = self.embedder.encode(query).tolist()
            
            # Search in ChromaDB
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=limit
            )
            
            # Format results
            formatted_results = []
            if results['metadatas'] and results['metadatas'][0]:
                for i, metadata in enumerate(results['metadatas'][0]):
                    formatted_results.append({
                        'id': metadata.get('id', ''),
                        'title': metadata.get('title', ''),
                        'verdict': metadata.get('verdict', ''),
                        'confidence': metadata.get('confidence', 0),
                        'created_at': metadata.get('created_at', ''),
                        'similarity_score': results['distances'][0][i] if results['distances'] else 0,
                        'excerpt': results['documents'][0][i][:300] if results['documents'] else ''
                    })
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ Search failed: {e}")
            return []
    
    async def index_all_existing_analyses(self, db):
        """Index all existing analyses from MongoDB"""
        try:
            analyses = await db.analyses.find({}).to_list(length=1000)
            for analysis in analyses:
                analysis['id'] = analysis['_id'] if '_id' in analysis else analysis.get('id')
                await self.add_analysis(analysis)
            print(f"✅ Indexed {len(analyses)} existing analyses")
        except Exception as e:
            print(f"❌ Failed to index existing analyses: {e}")

# Create global instance
rag_service = RAGService()