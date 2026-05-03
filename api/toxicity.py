"""
Polymer-specific toxicity SMARTS library.
Each entry: (name, SMARTS, severity)
Severity: "block" = reject outright | "warn" = flag for review
"""
from rdkit import Chem
from rdkit.Chem import Descriptors

TOXICITY_SMARTS = [
    # ── Reactive / alkylating ─────────────────────────────────────
    ("epoxide",               "[C;R1]1OC1",                         "block"),
    ("michael_acceptor",      "[CX3]=[CX3][CX3]=O",                 "warn"),
    ("acyl_halide",           "[CX3](=[OX1])[F,Cl,Br,I]",          "block"),
    ("aldehyde",              "[CH1](=O)",                          "warn"),
    # ── Known toxic functional groups ────────────────────────────
    ("nitro_aromatic",        "c[N+](=O)[O-]",                      "block"),
    ("nitroso",               "[N;!R]=[OX1]",                       "block"),
    ("hydrazine",             "[NX3][NX3]",                         "warn"),
    ("azo_dye",               "c-[N]=[N]-c",                        "warn"),
    ("quinone",               "O=C1C=CC(=O)C=C1",                   "warn"),
    # ── Heavy metals (polymer additives) ─────────────────────────
    ("lead",                  "[Pb]",                               "block"),
    ("mercury",               "[Hg]",                               "block"),
    ("cadmium",               "[Cd]",                               "block"),
    ("arsenic",               "[As]",                               "block"),
    # ── Biologics-specific concerns ──────────────────────────────
    ("thiol_reactive",        "[SX2H]",                             "warn"),
    ("peroxide",              "[OX2][OX2]",                         "block"),
    ("isocyanate",            "[NX2]=[C]=[OX1]",                    "block"),
]

_compiled = [
    (name, Chem.MolFromSmarts(smarts), severity)
    for name, smarts, severity in TOXICITY_SMARTS
]


def check_toxicity(smiles: str) -> dict:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {"valid": False, "alerts": [], "verdict": "invalid_smiles"}

    alerts = []
    for name, pattern, severity in _compiled:
        if pattern and mol.HasSubstructMatch(pattern):
            alerts.append({"flag": name, "severity": severity})

    has_block = any(a["severity"] == "block" for a in alerts)
    verdict = "block" if has_block else ("warn" if alerts else "pass")

    return {
        "valid": True,
        "smiles": smiles,
        "mw": round(Descriptors.MolWt(mol), 2),
        "alerts": alerts,
        "verdict": verdict,
    }
