# AlgonixAI — Platform Build Tracker

> Company: **AlgonixAI** | Stack: Next.js 15 · FastAPI · Supabase · Prisma · OpenMM · PyTorch · PSMILES · Temporal.io
> Design reference: extracted bundle at `..\.claude\projects\...\extracted\testing-claude-design\project\bioform\`
> Tech spec: `biologics_platform_tech_docs_v4-merged.pdf`

---

## Phase 0 — Design Canvas (HTML Prototypes)

These are the 28 prototype screens from the design tool. They are **reference only** — the real product is built in Phase 1+.

### Canvas Shell
- [x] `bioform/canvas.html` — pan/zoom/focus artboard canvas, 28 screens, 4 sections, branding updated to AlgonixAI ✓

### Section 01 — Authentication & Onboarding
| # | Screen | File | Prototype exists | Real page built |
|---|---|---|---|---|
| S01 | Sign In | signin.html | ✅ Design | ⬜ |
| S02 | Sign Up | signup.html | ✅ Design | ⬜ |
| S02b | Sign Up — Confirmed | signup.html | ✅ Design | ⬜ |
| S03a | Onboarding — 1 Profile | onboarding.html?step=0 | ✅ Design | ⬜ |
| S03b | Onboarding — 2 Persona | onboarding.html?step=1 | ✅ Design | ⬜ |
| S03c | Onboarding — 3 Scoring Weights | onboarding.html?step=2 | ✅ Design | ⬜ |
| S03d | Onboarding — 4 ELN Connect | onboarding.html?step=3 | ✅ Design | ⬜ |
| S03e | Onboarding — 5 Pipeline | onboarding.html?step=4 | ✅ Design | ⬜ |
| S03f | Onboarding — 6 Launch | onboarding.html?step=5 | ✅ Design | ⬜ |

### Section 02 — Core Platform
| # | Screen | File | Prototype exists | Real page built |
|---|---|---|---|---|
| S04 | Hub / Dashboard | index.html | ✅ Design | ⬜ |
| S05a | Chat — Experiment flow | chat.html?view=experiment | ✅ Design | ⬜ |
| S05b | Chat — Scientific Q&A | chat.html?view=qa | ✅ Design | ⬜ |
| S05c | Chat — Doc Q&A | chat.html?view=docqa | ✅ Design | ⬜ |
| S05d | Chat — Edit Params | chat.html?view=params | ✅ Design | ⬜ |
| S06 | Results | results.html | ✅ Design | ⬜ |
| S07 | Scoring Panel | scoring.html | ✅ Design | ⬜ |
| S14a | Polymer Studio — Idle | polymer-studio.html | ✅ Design | ⬜ |
| S14b | Polymer Studio — Candidates | polymer-studio.html?state=results&tab=candidates | ✅ Design | ⬜ |
| S14c | Polymer Studio — Chemical Space | polymer-studio.html?state=results&tab=umap | ✅ Design | ⬜ |
| S14d | Polymer Studio — Detail | polymer-studio.html?state=results&tab=detail | ✅ Design | ⬜ |
| S14e | Polymer Studio — MM Benchmarks | polymer-studio.html?state=results&tab=provenance | ✅ Design | ⬜ |

### Section 03 — Research & Regulatory
| # | Screen | File | Prototype exists | Real page built |
|---|---|---|---|---|
| S08 | Experiment History | history.html | ✅ Design | ⬜ |
| S09 | CMC Dossier | dossier.html | ✅ Design | ⬜ |
| S10 | The Corpus | corpus.html | ✅ Design | ⬜ |

### Section 04 — Platform & User
| # | Screen | File | Prototype exists | Real page built |
|---|---|---|---|---|
| S11 | Settings | settings.html | ✅ Design | ⬜ |
| S12 | Monitoring | monitoring.html | ✅ Design | ⬜ |
| S13 | Profile | profile.html | ✅ Design | ⬜ |
| S14f | Polymer Studio — Results | polymer-studio.html?state=results | ✅ Design | ⬜ |

---

## Phase 1 — Infrastructure & Services (Build Steps 1–11 from PDF §12)

> **Rule:** Monitoring before models. Zero GPU cost until physics layer needed.

| Step | Component | Status | Notes |
|---|---|---|---|
| 1 | Supabase project setup | ✅ DONE | DB ✓ · Connection strings ✓ · 5 buckets ✓ · Auth (Email) ✓ |
| 2 | Prisma schema + migrations | ✅ DONE | 12 tables created in Supabase ✓ · Prisma Client generated ✓ · lib/prisma.ts singleton ✓ |
| 3 | Sentry setup | ✅ DONE | sentry.client/server/edge.config.ts ✓ · instrumentation.ts ✓ · DSNs in both .env files ✓ · Build passes ✓ |
| 4 | Prometheus + Grafana | ✅ DONE | Grafana Cloud ✓ · Grafana Alloy scraping FastAPI /metrics ✓ · http_requests_total visible in Explore ✓ |
| 5 | Langfuse | ✅ DONE | Cloud account ✓ · SDK in FastAPI ✓ · Keys in .env ✓ · 3 test traces visible in dashboard ✓ |
| 6 | MLflow + model registry | ✅ DONE | MLflow server on :5000 ✓ · 3 model stubs registered (polymer-vae · polymer-gnn · cso-judge) ✓ |
| 7 | RDKit Toxicity Validator | ✅ DONE | POST /api/v1/toxicity/check ✓ · 14 SMARTS rules ✓ · block/warn/pass verdicts ✓ · Langfuse traces ✓ |
| 8 | Chroma RAG pipeline | ✅ DONE | 1,066 docs (PubMed · EuropePMC · Semantic Scholar · arXiv) ✓ · BM25 rerank ✓ · POST /api/v1/rag/query ✓ |
| 9 | Literature Research Agent | ✅ DONE | POST /api/v1/literature/answer ✓ · hallucination_rate=0.0 ✓ · chunk citations ✓ · Langfuse traces ✓ |
| 10 | Polymer Designer Agent + GNN/VAE | ⬜ NOT STARTED | VAE generation · GNN predictions · MLflow logging |
| 11 | Physics Validator — MOCKED | ⬜ NOT STARTED | Mocked MD · zero GPU · full Temporal.io pipeline test |

---

## Phase 2 — Frontend (Build Steps 12+)

| Step | Component | Status | Notes |
|---|---|---|---|
| 12 | Next.js App Router scaffold | 🔄 IN PROGRESS | app/ dir ✓ · 13 route stubs ✓ · layout + fonts ✓ · Tailwind + design tokens ✓ · lib/supabase ✓ |
| 12 | Chat interface | ⬜ NOT STARTED | Intent classification · extraction card · WebSocket · Supabase Auth |
| 13 | Physics Validator — live OpenMM | ⬜ NOT STARTED | RunPod RTX 4090 · trajectory → Supabase Storage |
| 14 | CSO Agent + faithfulness judge | ⬜ NOT STARTED | LLM judge · score → PostgreSQL · Langfuse |
| 15 | Evidently AI drift monitoring | ⬜ NOT STARTED | Reference datasets · drift reports · Grafana panels |
| 16 | Evaluation regression suite | ⬜ NOT STARTED | Golden set · benchmark excipient rankings · GitHub Actions gate |
| 17 | TanStack Query | 🔵 DEFERRED | Add only when stale client-side data is a real problem |
| 18 | Extended agents (Phase 2) | 🔵 DEFERRED | Synthetic Chemist · Regulatory Affairs · Formulation Expert |

---

## First Milestone Checklist
- [ ] Steps 1–11 complete
- [ ] Chat interface routing all 4 intent types
- [ ] Literature Agent + Toxicity Validator + Polymer Designer running end-to-end
- [ ] Mocked Physics Validator in place (no GPU cost)
- [ ] All 7 monitoring tools live (Langfuse · RAGAS · MLflow · Evidently · Prometheus · Grafana · Sentry)
- [ ] Langfuse traces visible
- [ ] Sentry errors visible
- [ ] Prometheus metrics visible

---

## Service Accounts Needed
| Service | Purpose | Status | Notes |
|---|---|---|---|
| Supabase | DB + Storage + Auth | ✅ DONE | DB · buckets · Auth all configured |
| Railway | FastAPI + Temporal.io hosting | ⬜ NOT SET UP | Free tier for dev |
| Vercel | Next.js hosting | ⬜ NOT SET UP | Free tier works |
| GitHub | Repo + CI/CD | ⬜ NOT SET UP | Free |
| Sentry | Error tracking | 🔄 PENDING DSN | Go to sentry.io → create algonixai-web (Next.js) + algonixai-api (Python) |
| Langfuse | RAG + agent traces | ⬜ NOT SET UP | Cloud free tier or self-host |
| MLflow | Model registry | ⬜ NOT SET UP | Self-hosted on Railway |
| RunPod | GPU dev (RTX 4090) | ⬜ NOT SET UP | On-demand, $0.74/hr |
| Redis | Cache + pub/sub | ⬜ NOT SET UP | Upstash free tier recommended |
| Chroma | Vector DB | ⬜ NOT SET UP | Self-hosted on Railway |

---

## Decisions & Notes
- Company name: **AlgonixAI** everywhere
- Design tokens live in `shared.css` — always import, never duplicate
- Space Grotesk (UI) + Space Mono (technical) + Instrument Serif (literature answers)
- Teal (#0D9488) = primary accent | Green (#A3E635) = CTA/positive ONLY | Amber = warnings | Purple = regulatory
- trehalose MUST rank above PEG 4000 for insulin at 40°C on every release (benchmark gate)
- Hallucination rate > 0% blocks output delivery immediately
- Precision@5 < 70% blocks next deployment
