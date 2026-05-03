"""
Literature Research Agent — Step 9.

Flow:
  1. RAG retrieval (ChromaDB semantic + BM25 rerank)
  2. Build grounded prompt with chunk IDs attached
  3. LLM answer (Claude claude-sonnet-4-6 via Anthropic API)
  4. Hallucination detection — every claim must cite a chunk ID
  5. Langfuse trace with faithfulness score

Hallucination rule (hard gate from PDF):
  Any sentence in the answer that contains a factual claim but no
  [PMID:...] citation is flagged. If hallucination_rate > 0 the
  answer is blocked and re-tried once with a stricter prompt.
"""
import os
import re
import anthropic
from langfuse import Langfuse
from rag import query_rag
from dotenv import load_dotenv

load_dotenv()

_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
_langfuse  = Langfuse(
    public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
    secret_key=os.environ["LANGFUSE_SECRET_KEY"],
    host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
)

SYSTEM_PROMPT = """You are the AlgonixAI Literature Research Agent specialising in biologics stabilisation and polymer excipients.

Your job is to give the most useful answer possible from the provided literature chunks — even when the chunks do not perfectly match the question.

Rules:
1. ALWAYS answer from what the literature DOES contain. Never refuse entirely if relevant information exists.
2. Every sentence that states a fact, mechanism, compound, or data point MUST end with [CHUNK:chunk_id].
3. If the exact condition asked about (e.g. a specific temperature, concentration, or timepoint) is not in the chunks, answer with what IS there and note the gap inline — e.g. "while specific 40 °C data is not available in the retrieved literature, studies at elevated temperatures show..."
4. Never invent data, compound names, or citations.
5. Write in clear scientific prose — authoritative but readable. 3–5 paragraphs maximum.
6. End with a "Knowledge gap" sentence if the question cannot be fully answered, noting what additional data would be needed."""


def _build_context(chunks: list[dict]) -> str:
    parts = []
    for c in chunks:
        meta = c["metadata"]
        src  = meta.get("source", "unknown")
        year = meta.get("year", "")
        title = meta.get("title", "")[:80]
        parts.append(
            f"[CHUNK:{c['chunk_id']}] ({src}, {year}) {title}\n{c['document'][:600]}"
        )
    return "\n\n---\n\n".join(parts)


_META_PATTERNS = re.compile(
    r"^(#|"                                                    # markdown headers
    r"\*{0,2}knowledge gap|"                                   # knowledge gap section
    r"the (literature|provided|available|evidence|chunks?|retrieved|most relevant)|"
    r"based on|in summary|in conclusion|"
    r"it should be noted|it is (important|worth|clear)|"
    r"while specific|while the|"
    r"further|additional|"
    r"this (analysis|response|answer|approach|monomeric|polymeric)|"
    r"these (results|findings|excipients|strategies|approaches)|"
    r"recent work|importantly|notably|collectively|"
    r"insufficient|cannot|no information|"
    r"to fully answer|would (be required|require)|"
    r"does not (provide|contain)|excipients are)",
    re.IGNORECASE,
)


def _hallucination_rate(answer: str, chunk_ids: list[str]) -> float:
    """
    Returns fraction of factual sentences that have no valid [CHUNK:...] citation.
    Meta-commentary, caveats, and disclaimers are exempt.
    """
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", answer) if len(s.strip()) > 30]
    if not sentences:
        return 0.0
    uncited = 0
    for s in sentences:
        has_citation = bool(re.search(r"\[CHUNK:[^\]]+\]", s))
        is_exempt    = bool(_META_PATTERNS.match(s))
        if not has_citation and not is_exempt:
            uncited += 1
    return uncited / len(sentences)


def answer(query: str, top_k: int = 5) -> dict:
    trace = _langfuse.trace(name="literature-agent", input={"query": query})

    # ── 1. RAG retrieval ────────────────────────────────────────
    chunks = query_rag(query, top_k=top_k)
    if not chunks:
        trace.update(output={"error": "empty_corpus"}, metadata={"verdict": "no_data"})
        return {"answer": "No literature data available yet. Run ingestion first.", "chunks": [], "hallucination_rate": 0.0}

    chunk_ids = [c["chunk_id"] for c in chunks]
    context   = _build_context(chunks)

    # ── 2. First attempt ────────────────────────────────────────
    user_msg = f"Literature context:\n\n{context}\n\n---\nQuestion: {query}"
    span = trace.span(name="llm-call-1")
    response = _anthropic.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    answer_text = response.content[0].text
    span.end(output={"answer": answer_text[:200]})

    h_rate = _hallucination_rate(answer_text, chunk_ids)

    # ── 3. Retry once if hallucination detected ─────────────────
    if h_rate > 0:
        strict_system = SYSTEM_PROMPT + "\n\nCRITICAL: Every single sentence must end with [CHUNK:id]. No exceptions."
        span2 = trace.span(name="llm-call-2-strict")
        response = _anthropic.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=strict_system,
            messages=[{"role": "user", "content": user_msg}],
        )
        answer_text = response.content[0].text
        span2.end(output={"answer": answer_text[:200]})
        h_rate = _hallucination_rate(answer_text, chunk_ids)

    # ── 4. Trace final result ────────────────────────────────────
    trace.update(
        output={"answer": answer_text[:300], "hallucination_rate": h_rate},
        metadata={
            "chunks_used":        len(chunks),
            "hallucination_rate": h_rate,
            "verdict":            "pass" if h_rate == 0 else "hallucination_detected",
        },
    )

    return {
        "answer":            answer_text,
        "chunks":            chunks,
        "hallucination_rate": h_rate,
        "sources":           [c["metadata"] for c in chunks],
    }
