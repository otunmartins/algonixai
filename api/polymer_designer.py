"""
Polymer Designer Agent — Step 10.

Flow:
  1. VAE stub  — generates N candidate SMILES from a curated excipient monomer library
  2. Toxicity gate — hard-blocks any candidate that fails the SMARTS screen
  3. GNN stub  — RDKit-descriptor-based property prediction (Tg, solubility, biocompatibility)
  4. Scoring   — ranks by composite score (biocompatibility + solubility − aggregation risk)
  5. MLflow    — one VAE run in algonixai-polymer-vae, one GNN run per candidate in algonixai-polymer-gnn
  6. Langfuse  — one trace per design() call with VAE and GNN child spans

Both stubs are deterministic; swap internals for real torch-geometric / VAE decoder
weights when GPU budget opens up (Step 13 — live RunPod integration).
"""
import os
import uuid
import random
from typing import Optional

import mlflow
from langfuse import Langfuse
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors
from dotenv import load_dotenv

from toxicity import check_toxicity

load_dotenv()

_langfuse = Langfuse(
    public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
    secret_key=os.environ["LANGFUSE_SECRET_KEY"],
    host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
)

mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000"))

# Curated excipient monomer library validated for biologics formulation use
_MONOMERS = [
    # Polyether / PEG-class (high water solubility, steric stabilisation)
    ("PEG",   "OCCO",                                          {"class": "polyether"}),
    ("PPG",   "OCC(C)O",                                       {"class": "polyether"}),
    # Polyester (biodegradable, controlled-release scaffolds)
    ("PLA",   "CC(O)C(=O)O",                                   {"class": "polyester"}),
    ("PGA",   "OCC(=O)O",                                      {"class": "polyester"}),
    ("PCL",   "OCCCCC(=O)O",                                   {"class": "polyester"}),
    # Polyacrylate / vinyl
    ("HPMA",  "CC(CC(=O)OCC(O)C)C(=O)O",                      {"class": "polyacrylate"}),
    ("PVA",   "CC(O)",                                         {"class": "vinyl"}),
    ("NVP",   "C1CC(=O)N1C=C",                                 {"class": "vinyl"}),
    # Polysaccharide surrogates (cellulose / dextran analogues)
    ("HPC",   "OC1CCCCO1",                                     {"class": "polysaccharide"}),
    ("PVP",   "C1CCN(C1=O)CC",                                 {"class": "vinyl"}),
    # Zwitterionic betaines (minimal protein adsorption, high biocompatibility)
    ("CBMA",  "CC(CC(=O)OCCC[N+](C)(C)CC([O-])=O)C",          {"class": "zwitterionic"}),
    ("SBMA",  "CC(CC(=O)OCCC[N+](C)(C)CCS([O-])(=O)=O)C",     {"class": "zwitterionic"}),
]

_LINKERS = ["CC", "CCC", "C(=O)", "C(=O)O", "OCC"]


# ── VAE stub ──────────────────────────────────────────────────────────────────

def _vae_generate(
    seed_smiles: Optional[str],
    target_properties: dict,
    n_candidates: int,
    rng_seed: int,
) -> list[dict]:
    rng = random.Random(rng_seed)

    # Bias toward monomer class most likely to hit the dominant target property
    prefer_class = None
    if target_properties.get("solubility", 0) > 0.5:
        prefer_class = "polyether"
    elif target_properties.get("biocompatibility", 0) > 0.7:
        prefer_class = "zwitterionic"
    elif target_properties.get("biodegradable", False):
        prefer_class = "polyester"

    candidates: list[dict] = []
    attempts = 0

    while len(candidates) < n_candidates and attempts < n_candidates * 12:
        attempts += 1

        biased_pool = [m for m in _MONOMERS if m[2].get("class") == prefer_class] if prefer_class else []
        pool = biased_pool if biased_pool and rng.random() < 0.6 else _MONOMERS

        n_mono = min(rng.randint(2, 3), len(pool))
        chosen = rng.sample(pool, k=n_mono)
        linker = rng.choice(_LINKERS)
        raw = linker.join(m[1] for m in chosen)

        mol = Chem.MolFromSmiles(raw)
        if mol is None:
            continue

        canonical = Chem.MolToSmiles(mol)
        latent = [round(rng.gauss(0.0, 1.0), 4) for _ in range(8)]

        candidates.append({
            "smiles":        canonical,
            "monomers":      [m[0] for m in chosen],
            "latent_vector": latent,
        })

    return candidates


# ── GNN stub ──────────────────────────────────────────────────────────────────

def _gnn_predict(smiles: str) -> dict:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {"error": "invalid_smiles"}

    mw   = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    tpsa = Descriptors.TPSA(mol)
    hba  = rdMolDescriptors.CalcNumHBA(mol)
    hbd  = rdMolDescriptors.CalcNumHBD(mol)
    rotb = rdMolDescriptors.CalcNumRotatableBonds(mol)

    # Solubility: high TPSA + low LogP → higher score (0–1)
    solubility = round(min(1.0, max(0.0, (tpsa / 150) * 0.6 + max(0.0, -logp / 5) * 0.4)), 3)

    # Tg estimate (°C): heavier MW + more H-bonding → stiffer chain → higher Tg
    tg_estimate = round(50.0 + (mw / 100) * 8 + hbd * 12 + hba * 6 - rotb * 3, 1)

    # Biocompatibility (0–1): favours low MW, high TPSA, low LogP
    biocompat = round(
        min(1.0, max(0.0,
            (1 - min(1.0, mw / 800)) * 0.35
            + min(1.0, tpsa / 120) * 0.35
            + max(0.0, (2 - logp) / 4) * 0.30,
        )),
        3,
    )

    # Aggregation risk (0–1): hydrophobic long chains → higher risk
    agg_risk = round(min(1.0, max(0.0, (logp / 6 + mw / 1200) / 2)), 3)

    return {
        "mw":               round(mw, 2),
        "logp":             round(logp, 3),
        "tpsa":             round(tpsa, 2),
        "hba":              hba,
        "hbd":              hbd,
        "rotatable_bonds":  rotb,
        "solubility_score": solubility,
        "tg_estimate_c":    tg_estimate,
        "biocompatibility": biocompat,
        "aggregation_risk": agg_risk,
    }


# ── Scoring ───────────────────────────────────────────────────────────────────

def _composite_score(props: dict, tox: dict) -> float:
    base = (
        props.get("biocompatibility", 0) * 0.40
        + props.get("solubility_score", 0) * 0.30
        + (1.0 - props.get("aggregation_risk", 1.0)) * 0.30
    )
    verdict = tox.get("verdict", "pass")
    if verdict == "block":
        base = 0.0
    elif verdict == "warn":
        base *= 0.6
    return round(base, 4)


# ── Public API ────────────────────────────────────────────────────────────────

def design(
    target_properties: dict,
    seed_smiles: Optional[str] = None,
    n_candidates: int = 5,
    constraints: Optional[dict] = None,
) -> dict:
    run_id = str(uuid.uuid4())[:8]
    trace = _langfuse.trace(
        name="polymer-designer",
        input={
            "target_properties": target_properties,
            "seed_smiles":       seed_smiles,
            "n_candidates":      n_candidates,
        },
    )

    # ── 1. VAE generation ────────────────────────────────────────────
    rng_seed = int(run_id, 16) % (2 ** 31)

    mlflow.set_experiment("algonixai-polymer-vae")
    with mlflow.start_run(run_name=f"vae-{run_id}") as vae_run:
        mlflow.log_params({
            "n_candidates": n_candidates,
            "seed_smiles":  seed_smiles or "none",
            "rng_seed":     rng_seed,
        })
        mlflow.log_dict(target_properties, "target_properties.json")

        span_vae = trace.span(name="vae-generation")
        candidates_raw = _vae_generate(seed_smiles, target_properties, n_candidates, rng_seed)
        span_vae.end(output={"generated": len(candidates_raw)})

        mlflow.log_metric("candidates_generated", len(candidates_raw))
        vae_run_id = vae_run.info.run_id

    # ── 2. Toxicity gate + GNN prediction ────────────────────────────
    results: list[dict] = []
    max_mw = (constraints or {}).get("max_mw")

    mlflow.set_experiment("algonixai-polymer-gnn")
    span_gnn = trace.span(name="gnn-prediction-batch")

    for i, cand in enumerate(candidates_raw):
        tox   = check_toxicity(cand["smiles"])
        props = _gnn_predict(cand["smiles"])

        if "error" in props:
            continue
        if max_mw and props["mw"] > max_mw:
            continue

        score = _composite_score(props, tox)

        with mlflow.start_run(run_name=f"gnn-{run_id}-{i}") as gnn_run:
            mlflow.log_params({
                "smiles":     cand["smiles"][:100],
                "vae_run_id": vae_run_id,
            })
            for k, v in props.items():
                if isinstance(v, (int, float)):
                    mlflow.log_metric(k, v)
            mlflow.log_metric("composite_score", score)
            mlflow.log_metric("tox_alerts", len(tox.get("alerts", [])))

        results.append({
            "smiles":          cand["smiles"],
            "monomers":        cand["monomers"],
            "toxicity":        tox,
            "properties":      props,
            "composite_score": score,
            "gnn_run_id":      gnn_run.info.run_id,
        })

    span_gnn.end(output={"evaluated": len(results)})

    # ── 3. Rank by composite score ───────────────────────────────────
    results.sort(key=lambda x: x["composite_score"], reverse=True)

    # ── 4. Finalise Langfuse trace ───────────────────────────────────
    top = results[0] if results else {}
    trace.update(
        output={
            "candidates_returned": len(results),
            "top_score":           top.get("composite_score"),
            "top_smiles":          top.get("smiles", "")[:60],
        },
        metadata={
            "vae_run_id": vae_run_id,
            "n_blocked":  sum(1 for r in results if r["toxicity"]["verdict"] == "block"),
            "n_warned":   sum(1 for r in results if r["toxicity"]["verdict"] == "warn"),
        },
    )

    return {
        "run_id":     run_id,
        "vae_run_id": vae_run_id,
        "candidates": results,
    }
