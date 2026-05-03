"""
ChromaDB vector store + BM25 reranking for the Literature Research pipeline.
Collection: algonixai-literature
Embedding: ChromaDB default (all-MiniLM-L6-v2 via ONNX, no API key needed)
"""
import os
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from rank_bm25 import BM25Okapi

CHROMA_PATH = os.environ.get("CHROMA_PATH", "./chroma_db")
COLLECTION_NAME = "algonixai-literature"


def get_collection():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef = DefaultEmbeddingFunction()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )


def ingest_documents(docs: list[dict]) -> int:
    """
    docs: list of {id, text, metadata}
    Returns number of documents ingested.
    """
    collection = get_collection()
    existing = set(collection.get()["ids"])
    new_docs = [d for d in docs if d["id"] not in existing]
    if not new_docs:
        return 0
    collection.add(
        ids=[d["id"] for d in new_docs],
        documents=[d["text"] for d in new_docs],
        metadatas=[d["metadata"] for d in new_docs],
    )
    return len(new_docs)


def _bm25_rerank(query: str, results: list[dict], top_k: int) -> list[dict]:
    if not results:
        return []
    tokenised = [r["document"].lower().split() for r in results]
    bm25 = BM25Okapi(tokenised)
    scores = bm25.get_scores(query.lower().split())
    for i, r in enumerate(results):
        r["bm25_score"] = float(scores[i])
    return sorted(results, key=lambda x: x["bm25_score"], reverse=True)[:top_k]


def query_rag(query: str, n_candidates: int = 20, top_k: int = 5) -> list[dict]:
    """
    1. Semantic search → n_candidates
    2. BM25 rerank → top_k
    Returns list of {chunk_id, document, metadata, bm25_score}
    """
    collection = get_collection()
    count = collection.count()
    if count == 0:
        return []

    n_candidates = min(n_candidates, count)
    raw = collection.query(query_texts=[query], n_results=n_candidates)

    results = [
        {
            "chunk_id": raw["ids"][0][i],
            "document": raw["documents"][0][i],
            "metadata": raw["metadatas"][0][i],
            "distance": raw["distances"][0][i],
        }
        for i in range(len(raw["ids"][0]))
    ]
    return _bm25_rerank(query, results, top_k)
