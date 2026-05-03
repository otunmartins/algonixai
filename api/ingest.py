"""
Multi-source literature ingestion for AlgonixAI RAG corpus.

Sources (all free, no API keys required):
  - PubMed         — biomedical abstracts via NCBI E-utilities
  - Europe PMC     — broader biomedical + chemistry coverage
  - Semantic Scholar — polymer / materials science papers
  - arXiv          — q-bio + cond-mat preprints

In production this runs nightly via Temporal.io (Step 11).
Run manually: python ingest.py
"""
import time
import xml.etree.ElementTree as ET
import httpx
from dotenv import load_dotenv
from rag import ingest_documents

load_dotenv()

QUERIES = [
    "insulin stabilization polymer excipient formulation",
    "biologics lyophilization trehalose sucrose stabilizer",
    "protein aggregation inhibitor excipient mechanism",
    "polyethylene glycol PEG protein stability biologics",
    "biopolymer drug delivery controlled release",
    "hydroxypropyl methylcellulose HPMC protein formulation",
    "polysorbate 80 monoclonal antibody stability",
    "cyclodextrin protein stabilization pharmaceutical",
    "polyvinylpyrrolidone PVP excipient protein",
    "excipient screening biologic drug product stability",
]


# ─────────────────────────────────────────────────────────────────
# PubMed
# ─────────────────────────────────────────────────────────────────
def _pubmed_ids(query: str, n: int = 40) -> list[str]:
    r = httpx.get(
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
        params={"db": "pubmed", "term": query, "retmax": n, "retmode": "json"},
        timeout=30,
    )
    return r.json()["esearchresult"]["idlist"]


def _pubmed_fetch(ids: list[str]) -> list[dict]:
    if not ids:
        return []
    r = httpx.get(
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
        params={"db": "pubmed", "id": ",".join(ids), "rettype": "abstract", "retmode": "xml"},
        timeout=30,
    )
    root = ET.fromstring(r.text)
    docs = []
    for article in root.iter("PubmedArticle"):
        pmid    = article.findtext(".//PMID", "")
        title   = article.findtext(".//ArticleTitle", "") or ""
        body    = " ".join(t.text or "" for t in article.findall(".//AbstractText"))
        year    = article.findtext(".//PubDate/Year", "")
        journal = article.findtext(".//Journal/Title", "") or ""
        if body.strip():
            docs.append({
                "id":       f"pubmed_{pmid}",
                "text":     f"{title}\n\n{body.strip()}",
                "metadata": {"source": "pubmed", "pmid": pmid, "title": title,
                             "year": year, "journal": journal},
            })
    return docs


def ingest_pubmed(query: str, n: int = 40) -> int:
    ids  = _pubmed_ids(query, n)
    docs = _pubmed_fetch(ids)
    return ingest_documents(docs)


# ─────────────────────────────────────────────────────────────────
# Europe PMC
# ─────────────────────────────────────────────────────────────────
def ingest_europe_pmc(query: str, n: int = 40) -> int:
    try:
        r = httpx.get(
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            params={"query": query, "format": "json", "pageSize": n,
                    "resultType": "core", "synonym": "true"},
            timeout=30,
        )
        items = r.json().get("resultList", {}).get("result", [])
        docs  = []
        for item in items:
            pmid    = item.get("pmid", item.get("id", ""))
            title   = item.get("title", "")
            abstract = item.get("abstractText", "")
            year    = str(item.get("pubYear", ""))
            journal = item.get("journalTitle", "")
            if abstract.strip():
                docs.append({
                    "id":       f"eupmc_{pmid or item.get('id', '')}",
                    "text":     f"{title}\n\n{abstract.strip()}",
                    "metadata": {"source": "europe_pmc", "pmid": pmid, "title": title,
                                 "year": year, "journal": journal},
                })
        return ingest_documents(docs)
    except Exception as e:
        print(f"  ⚠ Europe PMC error: {e}")
        return 0


# ─────────────────────────────────────────────────────────────────
# Semantic Scholar
# ─────────────────────────────────────────────────────────────────
def ingest_semantic_scholar(query: str, n: int = 40) -> int:
    try:
        r = httpx.get(
            "https://api.semanticscholar.org/graph/v1/paper/search",
            params={
                "query": query,
                "fields": "title,abstract,year,journal,externalIds",
                "limit": n,
            },
            timeout=30,
        )
        items = r.json().get("data", [])
        docs  = []
        for item in items:
            if not item.get("abstract"):
                continue
            paper_id = item.get("paperId", "")
            title    = item.get("title", "")
            abstract = item.get("abstract", "")
            year     = str(item.get("year", ""))
            journal  = (item.get("journal") or {}).get("name", "")
            docs.append({
                "id":       f"s2_{paper_id}",
                "text":     f"{title}\n\n{abstract.strip()}",
                "metadata": {"source": "semantic_scholar", "paper_id": paper_id,
                             "title": title, "year": year, "journal": journal},
            })
        return ingest_documents(docs)
    except Exception as e:
        print(f"  ⚠ Semantic Scholar error: {e}")
        return 0


# ─────────────────────────────────────────────────────────────────
# arXiv
# ─────────────────────────────────────────────────────────────────
def ingest_arxiv(query: str, n: int = 25) -> int:
    try:
        r = httpx.get(
            "https://export.arxiv.org/api/query",
            params={
                "search_query": f"all:{query}",
                "max_results": n,
                "sortBy": "relevance",
            },
            timeout=30,
        )
        root  = ET.fromstring(r.text)
        ns    = {"atom": "http://www.w3.org/2005/Atom"}
        docs  = []
        for entry in root.findall("atom:entry", ns):
            arxiv_id = (entry.findtext("atom:id", "", ns) or "").split("/")[-1]
            title    = (entry.findtext("atom:title", "", ns) or "").replace("\n", " ").strip()
            abstract = (entry.findtext("atom:summary", "", ns) or "").strip()
            year     = (entry.findtext("atom:published", "", ns) or "")[:4]
            if abstract:
                docs.append({
                    "id":       f"arxiv_{arxiv_id}",
                    "text":     f"{title}\n\n{abstract}",
                    "metadata": {"source": "arxiv", "arxiv_id": arxiv_id,
                                 "title": title, "year": year, "journal": "arXiv"},
                })
        return ingest_documents(docs)
    except Exception as e:
        print(f"  ⚠ arXiv error: {e}")
        return 0


# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────
def main():
    grand_total = 0
    sources = [
        ("PubMed",           ingest_pubmed,           40),
        ("Europe PMC",       ingest_europe_pmc,        40),
        ("Semantic Scholar", ingest_semantic_scholar,  40),
        ("arXiv",            ingest_arxiv,             25),
    ]

    for query in QUERIES:
        print(f"\n-- Query: {query[:60]}")
        for source_name, fn, n in sources:
            try:
                added = fn(query, n)
                print(f"   {source_name:<22} +{added}")
                grand_total += added
            except Exception as e:
                print(f"   {source_name:<22} error: {e}")
            time.sleep(0.4)

    print(f"\nIngestion complete. Total new documents added: {grand_total}")


if __name__ == "__main__":
    main()
