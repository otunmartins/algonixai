"""
PubMed ingestion script.
Fetches abstracts for biologics/polymer stabilisation queries and loads them into ChromaDB.
Run once manually; in production this runs nightly via Temporal.io (Step 11).

Usage:
    python ingest_pubmed.py
"""
import time
import xml.etree.ElementTree as ET
import httpx
from dotenv import load_dotenv
from rag import ingest_documents

load_dotenv()

PUBMED_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_FETCH  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

QUERIES = [
    "insulin stabilization polymer excipient formulation",
    "biologics lyophilization trehalose sucrose stabilizer",
    "protein aggregation inhibitor excipient mechanism",
    "PEG polyethylene glycol protein stability",
    "biopolymer drug delivery controlled release",
]

MAX_PER_QUERY = 40


def fetch_ids(query: str) -> list[str]:
    r = httpx.get(PUBMED_SEARCH, params={
        "db": "pubmed", "term": query,
        "retmax": MAX_PER_QUERY, "retmode": "json",
    }, timeout=30)
    return r.json()["esearchresult"]["idlist"]


def fetch_abstracts(ids: list[str]) -> list[dict]:
    if not ids:
        return []
    r = httpx.get(PUBMED_FETCH, params={
        "db": "pubmed", "id": ",".join(ids),
        "rettype": "abstract", "retmode": "xml",
    }, timeout=30)
    root = ET.fromstring(r.text)
    results = []
    for article in root.iter("PubmedArticle"):
        pmid    = article.findtext(".//PMID", "")
        title   = article.findtext(".//ArticleTitle", "") or ""
        body    = " ".join(t.text or "" for t in article.findall(".//AbstractText"))
        year    = article.findtext(".//PubDate/Year", "")
        journal = article.findtext(".//Journal/Title", "") or ""
        if body.strip():
            results.append({
                "id":       f"pmid_{pmid}",
                "text":     f"{title}\n\n{body.strip()}",
                "metadata": {"pmid": pmid, "title": title, "year": year, "journal": journal},
            })
    return results


def main():
    total = 0
    for q in QUERIES:
        print(f"Fetching: {q}")
        ids = fetch_ids(q)
        print(f"  → {len(ids)} PMIDs")
        docs = fetch_abstracts(ids)
        ingested = ingest_documents(docs)
        total += ingested
        print(f"  → {ingested} new documents ingested")
        time.sleep(0.5)          # be polite to NCBI
    print(f"\nDone. Total new documents: {total}")


if __name__ == "__main__":
    main()
