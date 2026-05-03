'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

// ── BioForm design tokens (hardcoded – globals.css uses FormulAI tokens) ───────
const BG       = '#060C18'
const SB_BG    = '#080F1E'
const PANEL    = '#0C1526'
const CARD     = '#0F1C2E'
const CARD2    = '#0B1524'
const BORDER   = '#192D46'
const BORDER2  = '#213A58'
const TEAL     = '#0D9488'
const TEAL_BRT = '#2DD4BF'
const TEAL_DIM = '#0A4A44'
const TEAL_BG  = '#021A18'
const GREEN     = '#A3E635'
const GREEN_BG  = '#0A1800'
const GREEN_DIM = '#3D6B00'
const AMBER     = '#F59E0B'
const AMBER_BG  = '#1A0E00'
const AMBER_DIM = '#6B3E00'
const PURPLE    = '#A78BFA'
const PURPLE_DIM = '#4C2A8A'
const TXT  = '#D8E8F8'
const TXT2 = '#6888AA'
const TXT3 = '#304C68'

const MONO = "var(--font-space-mono),'Space Mono','JetBrains Mono',monospace"
const SANS = "var(--font-space-sans),'Space Grotesk','Plus Jakarta Sans',system-ui,sans-serif"
const SB_W = 260

// ── Candidate data ─────────────────────────────────────────────────────────────
interface Candidate {
  id: string; rank: number; score: number; novelty: number
  psmiles: string; name: string; mw: number; logp: number
  tg: number; solubility: number; admet: string
  tags: string[]; delta: string; models: string[]
}

const CANDIDATES: Candidate[] = [
  { id: 'GEN-001', rank: 1, score: 94.1, novelty: 87,
    psmiles: '[n+]1(CC)(CC)C(=O)OCC[NH]1', name: 'PEtOx-NH₂ variant',
    mw: 11.2, logp: -1.3, tg: 62, solubility: 47, admet: 'Low risk',
    tags: ['Novel', 'GRAS-probable', 'Subcutaneous'], delta: '+12.4',
    models: ['BioForm-MM v1.2', 'PolyDiff v2'] },
  { id: 'GEN-002', rank: 2, score: 91.7, novelty: 79,
    psmiles: 'PEtOx-OH-b-PMPC · Mn 14,800 Da', name: 'PEtOx-OH-b-PMPC',
    mw: 14.8, logp: -2.1, tg: 58, solubility: 63, admet: 'Low risk',
    tags: ['Novel', 'Zwitterionic'], delta: '+9.8',
    models: ['BioForm-MM v1.2'] },
  { id: 'GEN-003', rank: 3, score: 88.4, novelty: 93,
    psmiles: 'PSar-g-EtOx hybrid', name: 'PSar-g-EtOx hybrid',
    mw: 9.6, logp: -1.8, tg: 45, solubility: 38, admet: 'Moderate',
    tags: ['High novelty', 'PEG-free', 'Stealth'], delta: '+6.5',
    models: ['PolyDiff v2', 'GPT-Polymer-7B'] },
  { id: 'GEN-004', rank: 4, score: 85.2, novelty: 64,
    psmiles: 'PEBuOx variant · Mn 12,400 Da', name: 'PEBuOx variant',
    mw: 12.4, logp: -0.9, tg: 71, solubility: 28, admet: 'Low risk',
    tags: ['Stable'], delta: '+3.3',
    models: ['BioForm-MM v1.2'] },
  { id: 'GEN-005', rank: 5, score: 82.9, novelty: 71,
    psmiles: 'PEtOx-Ar · Mn 8,900 Da', name: 'PEtOx-Ar',
    mw: 8.9, logp: -1.1, tg: 53, solubility: 52, admet: 'Low risk',
    tags: ['Scalable'], delta: '+1.0',
    models: ['FragNet', 'PolyVAE'] },
]

function rankColor(rank: number) {
  if (rank === 1) return '#F59E0B'
  if (rank === 2) return '#94A3B8'
  if (rank === 3) return '#CD7F32'
  return TXT3
}

// ── UMAP background cloud (seeded LCG) ────────────────────────────────────────
function bgCloud(n: number) {
  const pts: { x: number; y: number }[] = []
  let s = 42
  const r = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296 }
  for (let i = 0; i < n; i++) pts.push({ x: r(), y: r() })
  return pts
}
const BG_PTS = bgCloud(180)
const UMAP_COORDS = [
  { x: 0.62, y: 0.38 }, { x: 0.55, y: 0.52 },
  { x: 0.71, y: 0.61 }, { x: 0.48, y: 0.44 },
  { x: 0.58, y: 0.29 },
]
const SEED_XY = { x: 0.52, y: 0.45 }

// ── Generation steps ───────────────────────────────────────────────────────────
const GEN_STEPS = [
  { label: 'Initializing generative models…',  pct: 12 },
  { label: 'Sampling latent space (VAE)…',     pct: 28 },
  { label: 'Applying mutation strategies…',    pct: 45 },
  { label: 'GNN property prediction…',         pct: 62 },
  { label: 'Toxicity gating (Ames/hERG)…',    pct: 78 },
  { label: 'Scoring and ranking candidates…', pct: 91 },
  { label: 'Finalizing results…',              pct: 100 },
]

// ── Session sidebar ────────────────────────────────────────────────────────────
const SESSIONS = [
  { label: 'PEtOx variants — Jun 2025', active: true },
  { label: 'mAb stabilisers — May 2025', active: false },
  { label: 'Lyophilisation series — Apr 2025', active: false },
  { label: 'PEG-free screen — Mar 2025', active: false },
]

function SessionSidebar({ onNew }: { onNew: () => void }) {
  return (
    <aside style={{ width: SB_W, flexShrink: 0, background: SB_BG, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: SANS }}>
      <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${TEAL}, ${GREEN})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#060C18', flexShrink: 0 }}>Ax</div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: TXT, letterSpacing: '1.5px' }}>ALGONIXAI</div>
          <div style={{ fontSize: 9, color: TXT3, letterSpacing: '1px', marginTop: 1 }}>BIOLOGICS PLATFORM v1.0</div>
        </div>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <button
          onClick={onNew}
          style={{ width: '100%', background: GREEN, color: '#060C18', border: 'none', borderRadius: 8, padding: '9px 0', fontFamily: SANS, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px' }}
        >
          + New Experiment
        </button>
      </div>

      <div style={{ padding: '4px 16px 6px', fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', textTransform: 'uppercase' }}>Sessions</div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {SESSIONS.map((s, i) => (
          <div key={i} style={{ padding: '7px 16px', borderLeft: `2px solid ${s.active ? TEAL : 'transparent'}`, background: s.active ? 'rgba(13,148,136,0.06)' : 'transparent', color: s.active ? TEAL_BRT : TXT2, fontFamily: SANS, fontSize: 12, cursor: 'pointer', lineHeight: 1.4 }}>
            {s.label}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1a3a5c, #0f2a4a)', border: `1px solid ${BORDER2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: TEAL_BRT, flexShrink: 0 }}>DR</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: TXT }}>Dr. R. Patel</div>
          <div style={{ fontSize: 10, color: TXT3 }}>Sr. Formulation Scientist</div>
        </div>
      </div>
    </aside>
  )
}

// ── Design panel ───────────────────────────────────────────────────────────────
interface DesignState {
  prompt: string; psmiles: string
  mw: number; logp: number; tg: number; solubility: number
  mutations: string[]; models: string[]
}

const DEFAULT_DESIGN: DesignState = {
  prompt: '', psmiles: '[n+]1(CC)(CC)C(=O)OCC1',
  mw: 12, logp: -1, tg: 60, solubility: 45,
  mutations: ['Side-chain swap', 'PEG-free variant'],
  models: ['BioForm-MM v1.2', 'PolyDiff v2'],
}

const ALL_MUTATIONS = ['Side-chain swap', 'Backbone extension', 'PEG-free variant', 'Charge modification', 'MW reduction', 'Branching']
const ALL_MODELS    = ['BioForm-MM v1.2', 'PolyDiff v2', 'GPT-Polymer-7B', 'SchNet-3D', 'FragNet', 'PolyVAE']

function RangeSlider({ label, unit, value, min, max, step, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: TXT2 }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: TEAL_BRT }}>{value}<span style={{ color: TXT3, fontSize: 9, marginLeft: 3 }}>{unit}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: TEAL, cursor: 'pointer', margin: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: TXT3 }}>{min}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: TXT3 }}>{max}</span>
      </div>
    </div>
  )
}

function DesignPanel({ design, setDesign, generating, onGenerate }: {
  design: DesignState; setDesign: (d: DesignState) => void
  generating: boolean; onGenerate: () => void
}) {
  const s: React.CSSProperties = { padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }
  const lbl: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 10, display: 'block' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', fontFamily: SANS }}>

      {/* 1. Prompt */}
      <div style={s}>
        <span style={lbl}>Natural Language Prompt</span>
        <textarea value={design.prompt} onChange={e => setDesign({ ...design, prompt: e.target.value })}
          placeholder="e.g. PEG-free polymer with strong aggregation suppression for subcutaneous mAb at 40 mg/mL…"
          rows={3}
          style={{ width: '100%', background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', fontFamily: SANS, fontSize: 11, color: TXT, resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
      </div>

      {/* 2. Seed Structure */}
      <div style={s}>
        <span style={lbl}>Seed Structure</span>
        <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, marginBottom: 3 }}>PSMILES</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: TEAL_BRT, wordBreak: 'break-all' }}>{design.psmiles}</div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {['Edit PSMILES', 'Draw structure', 'Clear seed'].map(btn => (
            <button key={btn} style={{ flex: 1, background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 5, padding: '5px 0', fontFamily: SANS, fontSize: 9, color: TXT2, cursor: 'pointer' }}>{btn}</button>
          ))}
        </div>
      </div>

      {/* 3. Property Targets */}
      <div style={s}>
        <span style={lbl}>Property Targets</span>
        <RangeSlider label="MW" unit="kDa" value={design.mw} min={5} max={50} step={0.5} onChange={v => setDesign({ ...design, mw: v })} />
        <RangeSlider label="LogP" unit="" value={design.logp} min={-5} max={2} step={0.1} onChange={v => setDesign({ ...design, logp: v })} />
        <RangeSlider label="Tg" unit="°C" value={design.tg} min={-40} max={80} step={1} onChange={v => setDesign({ ...design, tg: v })} />
        <RangeSlider label="Solubility" unit="mg/mL" value={design.solubility} min={5} max={100} step={1} onChange={v => setDesign({ ...design, solubility: v })} />
      </div>

      {/* 4. Mutation Strategies */}
      <div style={s}>
        <span style={lbl}>Mutation Strategies</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {ALL_MUTATIONS.map(m => {
            const on = design.mutations.includes(m)
            return (
              <button key={m} onClick={() => setDesign({ ...design, mutations: on ? design.mutations.filter(x => x !== m) : [...design.mutations, m] })}
                style={{ background: on ? 'rgba(13,148,136,0.12)' : CARD2, border: `1px solid ${on ? TEAL_DIM : BORDER}`, borderRadius: 6, padding: '6px 8px', fontFamily: SANS, fontSize: 11, color: on ? TEAL_BRT : TXT2, cursor: 'pointer', textAlign: 'left' }}>
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* 5. Generative Models */}
      <div style={s}>
        <span style={lbl}>Generative Model</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ALL_MODELS.map(m => {
            const on = design.models.includes(m)
            return (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => setDesign({ ...design, models: on ? design.models.filter(x => x !== m) : [...design.models, m] })}
                  style={{ accentColor: TEAL, width: 13, height: 13 }} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: on ? TXT : TXT2 }}>{m}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* 6. Training Context */}
      <div style={s}>
        <span style={lbl}>Training Context</span>
        {[
          { n: '3,240 papers',    sub: 'Polymer science literature' },
          { n: '47 EXPs',         sub: 'Internal experiments' },
          { n: '12 MD-validated', sub: 'Molecular dynamics' },
          { n: '12,400 ChEMBL',   sub: 'ChEMBL compounds' },
        ].map(r => (
          <div key={r.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, color: TXT2 }}>{r.sub}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TEAL_BRT }}>{r.n}</span>
          </div>
        ))}
      </div>

      {/* Sticky generate button */}
      <div style={{ padding: 14, borderTop: `1px solid ${BORDER}`, background: SB_BG, position: 'sticky', bottom: 0 }}>
        <button onClick={onGenerate} disabled={generating}
          style={{ width: '100%', background: generating ? TXT3 : GREEN, color: '#060C18', border: 'none', borderRadius: 8, padding: '10px 0', fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer' }}>
          {generating ? 'Generating…' : 'Generate Variants'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 6, fontFamily: MONO, fontSize: 9, color: TXT3 }}>Est. cost: ~$0.80 · ~45 seconds</div>
      </div>
    </div>
  )
}

// ── Topbar ─────────────────────────────────────────────────────────────────────
function Topbar({ studio, elapsed }: { studio: string; elapsed: number }) {
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return (
    <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: `1px solid ${BORDER}`, background: PANEL, fontFamily: SANS }}>
      <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: TXT2, cursor: 'pointer', fontFamily: SANS, fontSize: 12 }}>← Back to results</button>
      <div style={{ width: 1, height: 16, background: BORDER }} />
      <span style={{ fontFamily: MONO, fontSize: 11, color: TXT3 }}>⏱ {mm}:{ss}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: TXT }}>Polymer Studio</span>
        <span style={{ fontFamily: SANS, fontSize: 12, color: TXT3, marginLeft: 8 }}>— Generative Design</span>
      </div>
      <span style={{ background: TEAL_BG, border: `1px solid ${TEAL_DIM}`, borderRadius: 20, padding: '3px 10px', fontFamily: MONO, fontSize: 10, color: TEAL_BRT }}>🌱 PEtOx seed</span>
      <span style={{ background: AMBER_BG, border: `1px solid ${AMBER_DIM}`, borderRadius: 20, padding: '3px 10px', fontFamily: MONO, fontSize: 10, color: AMBER }}>EXP-042</span>
      {studio === 'results' && (
        <span style={{ background: GREEN_BG, border: `1px solid ${GREEN_DIM}`, borderRadius: 20, padding: '3px 10px', fontFamily: MONO, fontSize: 10, color: GREEN }}>5 candidates</span>
      )}
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────
type Tab = 'candidates' | 'space' | 'detail' | 'benchmarks'

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'candidates', label: 'CANDIDATES' },
    { id: 'space',      label: 'CHEMICAL SPACE' },
    { id: 'detail',     label: 'DETAIL' },
    { id: 'benchmarks', label: 'MODEL & BENCHMARKS' },
  ]
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, paddingLeft: 20, flexShrink: 0, background: PANEL }}>
      {tabs.map(t => {
        const a = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: `2px solid ${a ? TEAL : 'transparent'}`, marginBottom: -1, background: 'none', color: a ? TEAL_BRT : TXT3, fontFamily: MONO, fontSize: 10, fontWeight: a ? 700 : 400, letterSpacing: '0.5px', cursor: 'pointer' }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Idle view ──────────────────────────────────────────────────────────────────
function IdleView() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>⚗️</div>
      <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600, color: TXT }}>Polymer Studio</div>
      <div style={{ fontFamily: SANS, fontSize: 13, color: TXT2, maxWidth: 380, lineHeight: 1.6 }}>
        Configure target properties and mutation strategies, then click{' '}
        <strong style={{ color: GREEN }}>Generate Variants</strong> to start.
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: TXT3 }}>ALGONIXAI GENERATIVE POLYMER DESIGN · v1.0</div>
    </div>
  )
}

// ── Generating view ────────────────────────────────────────────────────────────
function GeneratingView({ progress, stepIdx }: { progress: number; stepIdx: number }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, color: TXT3, letterSpacing: '2px' }}>GENERATING VARIANTS</div>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: SANS, fontSize: 13, color: TXT }}>{GEN_STEPS[stepIdx]?.label ?? ''}</span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: TEAL_BRT }}>{progress}%</span>
        </div>
        <div style={{ width: '100%', height: 4, background: BORDER, borderRadius: 2 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${TEAL}, ${GREEN})`, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 500 }}>
        {GEN_STEPS.slice(0, 6).map((step, i) => {
          const done = progress >= step.pct
          return (
            <div key={i} style={{ background: done ? TEAL_BG : CARD2, border: `1px solid ${done ? TEAL_DIM : BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: done ? TEAL_BRT : TXT3, marginBottom: 4 }}>{done ? '✓' : String(i + 1).padStart(2, '0')}</div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: done ? TXT : TXT3, lineHeight: 1.3 }}>{step.label.replace('…', '')}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Candidates tab ─────────────────────────────────────────────────────────────
function CandidatesTab({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: TXT2 }}>5 generated · sorted by composite score</span>
        <select style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 8px', fontFamily: MONO, fontSize: 10, color: TXT2, cursor: 'pointer', outline: 'none' }}>
          <option>Sort: Composite Score</option>
          <option>Sort: Novelty</option>
          <option>Sort: MW</option>
        </select>
      </div>
      {CANDIDATES.map((c, i) => {
        const rc = rankColor(c.rank)
        const sel = i === selected
        return (
          <div key={c.id} onClick={() => onSelect(i)}
            style={{ display: 'flex', alignItems: 'stretch', background: sel ? 'rgba(13,148,136,0.06)' : CARD, border: `1px solid ${sel ? TEAL_DIM : BORDER}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden', cursor: 'pointer' }}>

            {/* Rank */}
            <div style={{ width: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${BORDER}`, background: CARD2 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: rc }}>#{c.rank}</span>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: TXT3 }}>{c.id}</span>
                <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: TXT }}>{c.name}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: TXT2, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.psmiles}</div>
              {/* Property chips */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {[{ k: 'Tg', v: `${c.tg}°C` }, { k: 'MW', v: `${c.mw} kDa` }, { k: 'LogP', v: String(c.logp) }, { k: 'Sol', v: `${c.solubility} mg/mL` }, { k: 'ADMET', v: c.admet }].map(p => (
                  <span key={p.k} style={{ background: PANEL, border: `1px solid ${BORDER2}`, borderRadius: 4, padding: '2px 7px', fontFamily: MONO, fontSize: 9, color: TXT2 }}>
                    <span style={{ color: TXT3 }}>{p.k}: </span>{p.v}
                  </span>
                ))}
              </div>
              {/* Novelty bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TXT3, width: 44 }}>NOVELTY</span>
                <div style={{ flex: 1, height: 3, background: BORDER, borderRadius: 2 }}>
                  <div style={{ width: `${c.novelty}%`, height: '100%', background: PURPLE, borderRadius: 2 }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 9, color: PURPLE }}>{c.novelty}%</span>
              </div>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {c.tags.map(t => (
                  <span key={t} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '2px 8px', fontFamily: SANS, fontSize: 10, color: TXT3 }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Score + actions */}
            <div style={{ width: 110, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: rc, lineHeight: 1 }}>{c.score}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, marginTop: 2 }}>composite</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: c.rank <= 2 ? GREEN : TXT3, marginTop: 4 }}>{c.delta} vs seed</div>
              </div>
              <button style={{ width: '100%', background: TEAL_BG, border: `1px solid ${TEAL_DIM}`, borderRadius: 5, padding: '5px 0', fontFamily: SANS, fontSize: 10, color: TEAL_BRT, cursor: 'pointer' }}>→ Pipeline</button>
              <button style={{ width: '100%', background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 5, padding: '5px 0', fontFamily: SANS, fontSize: 10, color: TXT2, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Chemical Space tab ─────────────────────────────────────────────────────────
function ChemicalSpaceTab({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const W = 540, H = 380, PAD = 44
  const tx = (nx: number) => PAD + nx * (W - PAD * 2)
  const ty = (ny: number) => PAD + ny * (H - PAD * 2)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: TXT3, marginBottom: 12 }}>
        UMAP Chemical Space · background: 180 reference polymers from training corpus
      </div>
      <svg width={W} height={H} style={{ background: CARD2, borderRadius: 10, border: `1px solid ${BORDER}`, display: 'block' }}>
        {BG_PTS.map((p, i) => <circle key={i} cx={tx(p.x)} cy={ty(p.y)} r={2} fill={TXT3} opacity={0.3} />)}
        {(() => {
          const x = tx(SEED_XY.x), y = ty(SEED_XY.y)
          return (
            <g>
              <circle cx={x} cy={y} r={8} fill="none" stroke={AMBER} strokeWidth={1.5} />
              <circle cx={x} cy={y} r={4} fill={AMBER} opacity={0.7} />
              <text x={x} y={y - 13} textAnchor="middle" fontFamily="Space Mono,monospace" fontSize={9} fill={AMBER}>SEED</text>
            </g>
          )
        })()}
        {CANDIDATES.map((c, i) => {
          const coord = UMAP_COORDS[i]
          const x = tx(coord.x), y = ty(coord.y)
          const rc = rankColor(c.rank)
          const sel = i === selected
          return (
            <g key={c.id} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
              {sel && <circle cx={x} cy={y} r={16} fill="none" stroke={rc} strokeWidth={1.5} opacity={0.45} />}
              <circle cx={x} cy={y} r={sel ? 9 : 6} fill={rc} opacity={sel ? 1 : 0.8} />
              <text x={x} y={y - 14} textAnchor="middle" fontFamily="Space Mono,monospace" fontSize={9} fill={rc}>{c.id}</text>
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
        {[['#F59E0B', 'Rank 1 (Gold)'], ['#94A3B8', 'Rank 2 (Silver)'], ['#CD7F32', 'Rank 3 (Bronze)'], [TXT2, 'Rank 4–5'], [AMBER, 'Seed']].map(([color, label]) => (
          <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color as string, display: 'inline-block' }} />
            <span style={{ fontFamily: MONO, fontSize: 9, color: TXT3 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Detail tab ─────────────────────────────────────────────────────────────────
const SCORE_DIMS = [
  { label: 'Thermal Stability',       score: 91, color: GREEN },
  { label: 'Aggregation Suppression', score: 96, color: GREEN },
  { label: 'Excipient Safety',        score: 89, color: GREEN },
  { label: 'Synthetic Accessibility', score: 83, color: AMBER },
  { label: 'Regulatory Precedent',    score: 78, color: AMBER },
  { label: 'Literature Support',      score: 94, color: GREEN },
]

const MD_PTS = [0.12, 0.18, 0.14, 0.22, 0.19, 0.25, 0.21, 0.18, 0.20, 0.17, 0.19, 0.16]

function Sparkline({ pts }: { pts: number[] }) {
  const W = 130, H = 34, P = 4
  const mn = Math.min(...pts), mx = Math.max(...pts)
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - P * 2)
  const y = (v: number) => H - P - ((v - mn) / (mx - mn)) * (H - P * 2)
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H}>
      <path d={d} fill="none" stroke={TEAL_BRT} strokeWidth={1.5} />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r={2.5} fill={TEAL_BRT} />
    </svg>
  )
}

function DetailTab({ candidate }: { candidate: Candidate }) {
  const rc = rankColor(candidate.rank)
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: TXT3, marginBottom: 4 }}>{candidate.id} · {candidate.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 38, fontWeight: 700, color: rc, lineHeight: 1 }}>{candidate.score}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: TXT3, marginTop: 2 }}>composite score</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: `linear-gradient(135deg, ${TEAL}, ${GREEN})`, border: 'none', borderRadius: 8, padding: '8px 18px', fontFamily: SANS, fontSize: 12, fontWeight: 700, color: '#060C18', cursor: 'pointer' }}>→ Send to Pipeline</button>
          <button style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 18px', fontFamily: SANS, fontSize: 12, color: TXT2, cursor: 'pointer' }}>Save</button>
        </div>
      </div>

      {/* Scoring breakdown */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', marginBottom: 14 }}>SCORING BREAKDOWN</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {SCORE_DIMS.map(d => (
            <div key={d.label} style={{ background: CARD2, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontFamily: SANS, fontSize: 11, color: TXT2, marginBottom: 6 }}>{d.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: d.color, lineHeight: 1 }}>{d.score}</div>
              <div style={{ marginTop: 6, height: 3, background: BORDER, borderRadius: 2 }}>
                <div style={{ width: `${d.score}%`, height: '100%', background: d.color, borderRadius: 2, opacity: 0.7 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Physicochemical */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', marginBottom: 14 }}>PHYSICOCHEMICAL PROPERTIES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { k: 'MW', v: `${candidate.mw} kDa` }, { k: 'LogP', v: String(candidate.logp) },
            { k: 'Tg', v: `${candidate.tg} °C` }, { k: 'Solubility', v: `${candidate.solubility} mg/mL` },
            { k: 'Novelty', v: `${candidate.novelty}%` }, { k: 'ADMET', v: candidate.admet },
          ].map(p => (
            <div key={p.k} style={{ background: CARD2, borderRadius: 6, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: TXT3 }}>{p.k}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: TXT }}>{p.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MD Simulation */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', marginBottom: 14 }}>MD SIMULATION (200 ns)</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, marginBottom: 6 }}>RMSD (nm)</div>
            <Sparkline pts={MD_PTS} />
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[{ k: 'Stable', v: 'Yes' }, { k: 'Avg RMSD', v: '0.19 nm' }, { k: 'Rg', v: '2.8 nm' }, { k: 'SASA', v: '148 nm²' }, { k: 'H-bonds', v: '12 avg' }, { k: 'Traj', v: '200 ns' }].map(m => (
              <div key={m.k} style={{ background: CARD2, borderRadius: 6, padding: '7px 10px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TXT3 }}>{m.k}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: TXT }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Structural Novelty */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', marginBottom: 10 }}>STRUCTURAL NOVELTY</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: BORDER, borderRadius: 4 }}>
            <div style={{ width: `${candidate.novelty}%`, height: '100%', background: `linear-gradient(90deg, ${PURPLE_DIM}, ${PURPLE})`, borderRadius: 4 }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: PURPLE }}>{candidate.novelty}%</span>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: TXT3, marginTop: 8 }}>
          Tanimoto distance vs training set: {(0.4 + candidate.novelty * 0.005).toFixed(2)} · Scaffold novel: Yes
        </div>
      </div>
    </div>
  )
}

// ── Model & Benchmarks tab ─────────────────────────────────────────────────────
const BENCH = [
  { metric: 'Property Prediction R²',    bioform: 0.94, base: 0.81 },
  { metric: 'ADMET Accuracy',            bioform: 0.91, base: 0.74 },
  { metric: 'Novelty (Avg Tanimoto)',    bioform: 0.78, base: 0.62 },
  { metric: 'Synthetic Validity',        bioform: 0.97, base: 0.88 },
  { metric: 'Diversity Score',           bioform: 0.83, base: 0.71 },
  { metric: 'Literature Grounding',      bioform: 0.89, base: 0.60 },
]

function ModelBenchmarksTab() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      {/* Model card */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', marginBottom: 6 }}>ACTIVE MODEL</div>
            <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: TXT }}>BioForm-MM v1.2</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: TXT2, marginTop: 2 }}>Multi-modal polymer generative model · trained Jun 2025</div>
          </div>
          <span style={{ background: 'rgba(163,230,53,0.1)', border: `1px solid ${GREEN_DIM}`, borderRadius: 20, padding: '4px 12px', fontFamily: MONO, fontSize: 10, color: GREEN }}>Active</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[{ k: 'Architecture', v: 'Transformer-VAE' }, { k: 'Parameters', v: '1.2B' }, { k: 'Training data', v: '3.2M polymers' }, { k: 'Context window', v: '2048 tokens' }, { k: 'Fine-tune EXPs', v: '47 internal' }, { k: 'Last updated', v: 'Jun 2025' }].map(c => (
            <div key={c.k} style={{ background: CARD2, borderRadius: 6, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: TXT3 }}>{c.k}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: TXT }}>{c.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark table */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', marginBottom: 14 }}>BENCHMARK METRICS vs BASELINE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr' }}>
          {['Metric', 'BioForm-MM v1.2', 'Baseline (PolyVAE)'].map(h => (
            <div key={h} style={{ fontFamily: MONO, fontSize: 9, color: TXT3, padding: '6px 10px', borderBottom: `1px solid ${BORDER}` }}>{h}</div>
          ))}
          {BENCH.map(r => [
            <div key={r.metric + 'k'} style={{ fontFamily: SANS, fontSize: 12, color: TXT2, padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>{r.metric}</div>,
            <div key={r.metric + 'b'} style={{ fontFamily: MONO, fontSize: 12, color: r.bioform > r.base ? GREEN : AMBER, padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, fontWeight: 700 }}>{r.bioform.toFixed(2)}</div>,
            <div key={r.metric + 'bl'} style={{ fontFamily: MONO, fontSize: 12, color: TXT3, padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>{r.base.toFixed(2)}</div>,
          ])}
        </div>
      </div>

      {/* Training corpus */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', marginBottom: 14 }}>TRAINING CORPUS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { src: 'Polymer literature',  n: '3,240 papers',      color: TEAL_BRT },
            { src: 'ChEMBL compounds',    n: '12,400 records',    color: TEAL_BRT },
            { src: 'Internal EXPs',       n: '47 formulations',   color: GREEN },
            { src: 'MD simulations',      n: '12 validated',      color: GREEN },
            { src: 'Patent corpus',       n: '8,100 claims',      color: AMBER },
            { src: 'FDA excipient DB',    n: '340 approved',      color: AMBER },
          ].map(s => (
            <div key={s.src} style={{ background: CARD2, borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: SANS, fontSize: 11, color: TXT2 }}>{s.src}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: s.color }}>{s.n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function PolymerStudioPage() {
  const [studio,   setStudio]   = useState<'idle' | 'generating' | 'results'>('idle')
  const [tab,      setTab]      = useState<Tab>('candidates')
  const [design,   setDesign]   = useState<DesignState>(DEFAULT_DESIGN)
  const [selected, setSelected] = useState(0)
  const [leftW,    setLeftW]    = useState(340)
  const [progress, setProgress] = useState(0)
  const [stepIdx,  setStepIdx]  = useState(0)
  const [elapsed,  setElapsed]  = useState(0)

  const dragging  = useRef(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clockRef  = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Elapsed clock
  useEffect(() => {
    if (studio === 'generating') {
      setElapsed(0)
      clockRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      clearInterval(clockRef.current)
    }
    return () => clearInterval(clockRef.current)
  }, [studio])

  // Generation simulation
  const handleGenerate = useCallback(() => {
    setStudio('generating')
    setProgress(0)
    setStepIdx(0)
    let i = 0
    const tick = () => {
      if (i >= GEN_STEPS.length) { setStudio('results'); setTab('candidates'); return }
      setProgress(GEN_STEPS[i].pct)
      setStepIdx(i)
      i++
      timerRef.current = setTimeout(tick, 550 + Math.random() * 350)
    }
    timerRef.current = setTimeout(tick, 250)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Resize drag
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setLeftW(Math.max(240, Math.min(600, ev.clientX - SB_W)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const selectCandidate = useCallback((i: number) => {
    setSelected(i)
    setTab('detail')
  }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; height: 100%; background: ${BG}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BORDER2}; border-radius: 2px; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 3px; background: ${BORDER}; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${TEAL}; cursor: pointer; margin-top: -5px; }
        input[type=range]::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; }
        textarea::placeholder { color: ${TXT3}; }
        select option { background: ${CARD2}; }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', background: BG, overflow: 'hidden' }}>
        <SessionSidebar onNew={() => { setStudio('idle'); setProgress(0); setElapsed(0) }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Topbar studio={studio} elapsed={elapsed} />

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left design panel */}
            <div style={{ width: leftW, flexShrink: 0, background: SB_BG, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px 8px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: TXT3, letterSpacing: '2px', textTransform: 'uppercase' }}>Design Panel</span>
              </div>
              <DesignPanel design={design} setDesign={setDesign} generating={studio === 'generating'} onGenerate={handleGenerate} />
            </div>

            {/* Drag handle */}
            <div
              onMouseDown={onDragStart}
              style={{ width: 5, flexShrink: 0, cursor: 'col-resize', background: BORDER }}
              onMouseEnter={e => (e.currentTarget.style.background = TEAL_DIM)}
              onMouseLeave={e => (e.currentTarget.style.background = BORDER)}
            />

            {/* Right results panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: PANEL }}>
              {studio === 'idle'       && <IdleView />}
              {studio === 'generating' && <GeneratingView progress={progress} stepIdx={stepIdx} />}
              {studio === 'results'    && (
                <>
                  <TabBar active={tab} onChange={setTab} />
                  {tab === 'candidates' && <CandidatesTab selected={selected} onSelect={selectCandidate} />}
                  {tab === 'space'      && <ChemicalSpaceTab selected={selected} onSelect={selectCandidate} />}
                  {tab === 'detail'     && <DetailTab candidate={CANDIDATES[selected]} />}
                  {tab === 'benchmarks' && <ModelBenchmarksTab />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
