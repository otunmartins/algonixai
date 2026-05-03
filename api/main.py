import os
import sys

# MLflow prints emoji run links to stdout; Windows terminals default to cp1252 which
# can't encode them. Reconfigure stdout to UTF-8 with safe fallback before any imports.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import sentry_sdk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from langfuse import Langfuse
from pydantic import BaseModel
from dotenv import load_dotenv

from toxicity import check_toxicity
from rag import query_rag
from literature_agent import answer as literature_answer
from polymer_designer import design as polymer_design

load_dotenv()

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    traces_sample_rate=1.0,
    environment=os.environ.get("ENVIRONMENT", "development"),
    send_default_pii=False,
)

langfuse = Langfuse(
    public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
    host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
)

app = FastAPI(
    title="AlgonixAI API",
    version="0.1.0",
    description="AI-driven biologics stabilisation — polymer excipient design pipeline",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator().instrument(app).expose(app)


class ToxicityRequest(BaseModel):
    smiles: str

class RAGRequest(BaseModel):
    query: str
    top_k: int = 5

class LiteratureRequest(BaseModel):
    query: str
    top_k: int = 5

class PolymerDesignRequest(BaseModel):
    target_properties: dict
    seed_smiles: str | None = None
    n_candidates: int = 5
    constraints: dict | None = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "algonixai-api"}


@app.post("/api/v1/toxicity/check")
async def toxicity_check(req: ToxicityRequest):
    trace = langfuse.trace(name="toxicity-check", input={"smiles": req.smiles})
    try:
        result = check_toxicity(req.smiles)
        if not result["valid"]:
            raise HTTPException(status_code=422, detail="Invalid SMILES string")
        trace.update(output=result, metadata={"verdict": result["verdict"]})
        return result
    except HTTPException:
        raise
    except Exception as e:
        trace.update(metadata={"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/query")
async def rag_query(req: RAGRequest):
    trace = langfuse.trace(name="rag-query", input={"query": req.query, "top_k": req.top_k})
    try:
        results = query_rag(req.query, top_k=req.top_k)
        trace.update(
            output={"chunks": len(results)},
            metadata={"top_chunk_id": results[0]["chunk_id"] if results else None},
        )
        return {"query": req.query, "results": results}
    except Exception as e:
        trace.update(metadata={"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/polymer/design")
async def polymer_design_endpoint(req: PolymerDesignRequest):
    trace = langfuse.trace(name="polymer-design-request", input=req.model_dump())
    try:
        result = polymer_design(
            target_properties=req.target_properties,
            seed_smiles=req.seed_smiles,
            n_candidates=req.n_candidates,
            constraints=req.constraints,
        )
        trace.update(
            output={
                "run_id":              result["run_id"],
                "candidates_returned": len(result["candidates"]),
                "top_score":           result["candidates"][0]["composite_score"] if result["candidates"] else None,
            }
        )
        return result
    except Exception as e:
        trace.update(metadata={"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/literature/answer")
async def literature_query(req: LiteratureRequest):
    try:
        result = literature_answer(req.query, top_k=req.top_k)
        if result["hallucination_rate"] > 0:
            raise HTTPException(
                status_code=422,
                detail=f"Hallucination detected (rate={result['hallucination_rate']:.2f}). Answer blocked.",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
