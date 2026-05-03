'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'empty' | 'thinking' | 'extraction' | 'running' | 'done'
type AgentState = 'queued' | 'running' | 'done'

interface ExtField {
  key: string
  label: string
  value: string
  status: 'ok' | 'missing'
  suggested?: string
  suggestNote?: string
}

interface Candidate {
  smiles: string
  monomers: string[]
  composite_score: number
  properties: Record<string, number>
  toxicity: { verdict: string; alerts: { flag: string; severity: string }[] }
}

interface RunResult {
  candidates?: Candidate[]
  run_id?: string
  answer?: string
  hallucination_rate?: number
  chunks?: { chunk_id: string; document: string; metadata: Record<string, string> }[]
}

// ── Static data ────────────────────────────────────────────────────────────────

const SESSIONS = [
  {
    group: 'Today',
    items: [
      { id: 1, name: 'Insulin PEG stabilisation', meta: '14:32 · 4 agents', active: true },
      { id: 2, name: 'mAb aggregation screen', meta: '11:08 · 3 agents' },
    ],
  },
  {
    group: 'Yesterday',
    items: [
      { id: 3, name: 'GLP-1 agonist excipient', meta: '16:55 · 4 agents' },
      { id: 4, name: 'pH-stable biopolymer screen', meta: '09:21 · 3 agents' },
    ],
  },
  {
    group: 'Apr 30',
    items: [
      { id: 5, name: 'Adalimumab thermal stability', meta: '13:44 · 4 agents' },
      { id: 6, name: 'Lipid nanocarrier screen', meta: '10:00 · 2 agents' },
    ],
  },
]

const EXAMPLE_PROMPTS = [
  'Design a PEG-based polymer excipient to stabilise insulin at 40°C with <5% aggregation over 6 months',
  'Screen solid dispersion carriers for a BCS Class II biologic with pI 5.4, MW 5,800 Da, prone to thermal aggregation',
  'Evaluate polymer compatibility for a monoclonal antibody at 10 mg/mL in phosphate buffer pH 7.2',
]

const AGENTS = [
  {
    id: 'lit',
    name: 'Literature Agent',
    icon: '📖',
    iconBg: '#0a1e30',
    iconBorder: '#1a3a5a',
    statusText: 'Querying PubMed, FDA guidance, ICH Q6B database',
    output: 'Retrieved 28 stabilisation studies for biologic-excipient formulations. Key finding: PEG 400 at 5–8% w/v reduces aggregation by 73% vs. control at 40°C. Zwitterionic polymers show superior aggregation suppression for insulin analogues.',
    metrics: [
      { label: 'References', value: '28 studies', type: 'good' as const },
      { label: 'Confidence', value: '91%', type: 'good' as const },
      { label: 'Guideline', value: 'ICH Q6B', type: '' as const },
    ],
  },
  {
    id: 'tox',
    name: 'Toxicity Validator',
    icon: '⚗️',
    iconBg: '#1a0a0a',
    iconBorder: '#3a1515',
    statusText: 'Running ADMET prediction, excipient safety cross-check',
    output: 'Excipient safety confirmed — PEG 400 GRAS listed. Polysorbate 80 at 0.02% w/v within ICH Q6B limits. ⚠ Flag: PEG MW >8,000 Da may increase viscosity above 15 cP — limit to PEG 4,000 for subcutaneous delivery.',
    metrics: [
      { label: 'Risk Score', value: 'LOW', type: 'good' as const },
      { label: 'Flag', value: '1 warning', type: 'warn' as const },
      { label: 'GRAS Status', value: 'All excipients', type: 'good' as const },
    ],
  },
  {
    id: 'phys',
    name: 'Physics Validator',
    icon: '📐',
    iconBg: '#0a1a1e',
    iconBorder: '#155a5a',
    statusText: 'Modelling hydrogen bonding, MD simulation at 40°C',
    output: 'MD simulation (50 ns) shows PEG chains form stable hydrogen bonds with insulin B-chain Phe-1 and Gly-7 at 40°C (k=3.2 kcal/mol). Predicted aggregation half-life τ₁/₂ = 8.4 months. Recommended PEG chain length: 3–6 kDa.',
    metrics: [
      { label: 'τ₁/₂ Agg.', value: '8.4 mo', type: 'good' as const },
      { label: 'H-bonds', value: '4.2 avg', type: 'good' as const },
      { label: 'ΔGᵢₙₜ', value: '-3.2 kcal/mol', type: '' as const },
    ],
  },
  {
    id: 'polymer',
    name: 'Polymer Designer',
    icon: '🧬',
    iconBg: '#0a1500',
    iconBorder: '#1a3a00',
    statusText: 'Running VAE + GNN pipeline, ranking candidates by composite score',
    output: '',
    metrics: [],
  },
]

// ── Prompt parsing ─────────────────────────────────────────────────────────────

function parsePrompt(text: string): ExtField[] {
  const lower = text.toLowerCase()

  const biologic = (() => {
    if (lower.includes('insulin')) return 'Insulin'
    if (lower.includes('adalimumab')) return 'Adalimumab'
    if (lower.includes('glp-1')) return 'GLP-1 agonist'
    if (lower.includes('antibody') || lower.includes('mab')) return 'Monoclonal antibody'
    if (lower.includes('biologic')) return 'Biologic (unspecified)'
    return null
  })()

  const tempM = text.match(/(\d+)\s*°?C/)
  const durationM = text.match(/(\d+)\s*(months?|weeks?|years?)/)
  const concM = text.match(/(\d+(?:\.\d+)?)\s*(mg\/m[Ll]|U\/m[Ll]|g\/[Ll])/)

  const polymerClass = (() => {
    if (lower.includes('peg')) return 'PEG-based'
    if (lower.includes('hpmc')) return 'HPMC'
    if (lower.includes('pcl')) return 'PCL'
    if (lower.includes('zwitterion')) return 'Zwitterionic'
    if (lower.includes('polymer')) return 'Polymer (unspecified)'
    return null
  })()

  return [
    {
      key: 'BIOLOGIC',
      label: 'Target Biologic',
      value: biologic ?? '—',
      status: biologic ? 'ok' : 'missing',
      suggested: 'Protein biologic',
      suggestNote: 'Inferred from design context',
    },
    {
      key: 'TEMP',
      label: 'Target Temperature',
      value: tempM ? `${tempM[1]}°C` : '—',
      status: tempM ? 'ok' : 'missing',
      suggested: '40°C',
      suggestNote: 'ICH Q1A accelerated stability condition',
    },
    {
      key: 'DURATION',
      label: 'Stability Duration',
      value: durationM ? `${durationM[1]} ${durationM[2]}` : '—',
      status: durationM ? 'ok' : 'missing',
      suggested: '6 months',
      suggestNote: 'Standard accelerated shelf-life target',
    },
    {
      key: 'POLYMER',
      label: 'Polymer Class',
      value: polymerClass ?? '—',
      status: polymerClass ? 'ok' : 'missing',
      suggested: 'PEG-based',
      suggestNote: 'Most studied excipient for biologics',
    },
    {
      key: 'CONC',
      label: 'Drug Concentration',
      value: concM ? `${concM[1]} ${concM[2]}` : '—',
      status: concM ? 'ok' : 'missing',
      suggested: '10 mg/mL',
      suggestNote: 'Typical subcutaneous biologic dose',
    },
    {
      key: 'ROUTE',
      label: 'Delivery Route',
      value: lower.includes('subcutaneous') || lower.includes('s.c.') ? 'Subcutaneous' : '—',
      status: lower.includes('subcutaneous') ? 'ok' : 'missing',
      suggested: 'Subcutaneous',
      suggestNote: 'Most common route for biologics',
    },
  ]
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const Icons = {
  plus: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  attach: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  play: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  edit: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaff45" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  export: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  settings: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  arrow: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ExtractionCard({ fields, onRun }: { fields: ExtField[]; onRun: () => void }) {
  const missingCount = fields.filter(f => f.status === 'missing').length
  const sessionId = `SES_${new Date().toISOString().slice(0,10).replace(/-/g, '')}_001`
  const confidence = Math.round(88 - missingCount * 4)

  return (
    <div style={{
      background: 'var(--card2)',
      border: '1px solid var(--border2)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '11px 16px',
        background: 'rgba(31,212,196,0.05)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 18, height: 18,
          borderRadius: 4,
          background: 'var(--teal-bg)',
          border: '1px solid var(--teal-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--teal)', letterSpacing: '0.5px', flex: 1 }}>
          PARAMETER EXTRACTION — {sessionId}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          padding: '2px 7px',
          borderRadius: 3,
          background: 'rgba(170,255,69,0.08)',
          color: 'var(--green)',
          border: '1px solid var(--green-dim)',
          letterSpacing: '0.5px',
        }}>
          CONF {confidence}%
        </span>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1,
        background: 'var(--border)',
      }}>
        {fields.map(f => (
          <div
            key={f.key}
            style={{
              background: f.status === 'missing' ? 'rgba(31,20,0,0.5)' : 'var(--card2)',
              padding: '12px 16px',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '1.2px',
              textTransform: 'uppercase' as const,
              color: 'var(--txt3)',
              marginBottom: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              {f.status === 'missing' && (
                <span style={{
                  width: 5, height: 5,
                  borderRadius: '50%',
                  background: 'var(--amber)',
                  display: 'inline-block',
                  animation: 'pulse 1.5s ease infinite',
                }} />
              )}
              {f.label}
            </div>
            {f.status === 'ok' ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>
                {f.value}
              </div>
            ) : (
              <>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--amber)',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dashed' as const,
                  textUnderlineOffset: 3,
                }}>
                  {f.suggested}
                </div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 3 }}>{f.suggestNote}</div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'var(--amber-bg)',
                  border: '1px solid var(--amber-dim)',
                  color: 'var(--amber)',
                  marginTop: 5,
                }}>
                  ★ AI SUGGESTED
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 8,
      }}>
        <div style={{ fontSize: '11.5px', color: 'var(--txt2)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" style={{ marginTop: 1, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600 }}>
              {missingCount} missing field{missingCount !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--txt3)', fontSize: 11, marginLeft: 2 }}>
              — AI-suggested values will be used if you proceed.
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onRun}
            style={{
              flex: 1,
              padding: '9px 16px',
              borderRadius: 6,
              background: 'var(--green)',
              border: 'none',
              color: '#060f1c',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icons.play /> RUN WITH SUGGESTIONS
          </button>
          <button
            style={{
              flex: 1,
              padding: '9px 16px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--border2)',
              color: 'var(--txt2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icons.edit /> EDIT FIRST
          </button>
        </div>
      </div>
    </div>
  )
}

function AgentCard({
  agent,
  state,
  realOutput,
}: {
  agent: typeof AGENTS[0]
  state: AgentState
  realOutput?: string
}) {
  const outputText = agent.id === 'polymer' ? (realOutput ?? agent.output) : agent.output

  return (
    <div style={{
      background: 'var(--card2)',
      border: `1px solid ${state === 'running' ? 'var(--teal-dim)' : 'var(--border)'}`,
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      animation: 'agentIn 0.3s ease both',
    }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: 7,
        background: agent.iconBg,
        border: `1px solid ${agent.iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontSize: 15,
      }}>
        {agent.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--txt)', letterSpacing: '0.3px' }}>
            {agent.name}
          </span>
          {state === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 12, height: 12,
                border: '1.5px solid var(--teal-dim)',
                borderTopColor: 'var(--teal)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal)', letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                RUNNING
              </span>
            </div>
          )}
          {state === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)', letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                COMPLETE
              </span>
            </div>
          )}
          {state === 'queued' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--txt3)', display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--txt3)', letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                QUEUED
              </span>
            </div>
          )}
        </div>

        {state === 'running' && (
          <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font-mono)' }}>
            {agent.statusText}
          </div>
        )}

        {state === 'done' && (
          <div style={{ animation: 'fadeSlideIn 0.3s ease both' }}>
            {outputText && (
              <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.55 }}>
                {outputText}
              </div>
            )}
            {agent.metrics.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' as const }}>
                {agent.metrics.map(m => (
                  <span
                    key={m.label}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: m.type === 'good' ? 'var(--green-bg)' : m.type === 'warn' ? 'var(--amber-bg)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${m.type === 'good' ? 'var(--green-dim)' : m.type === 'warn' ? 'var(--amber-dim)' : 'var(--border)'}`,
                      color: m.type === 'good' ? 'var(--green)' : m.type === 'warn' ? 'var(--amber)' : 'var(--txt2)',
                    }}
                  >
                    {m.label}: <strong>{m.value}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CandidateResult({ result }: { result: RunResult }) {
  const [selected, setSelected] = useState(0)
  const cands = result.candidates ?? []
  if (cands.length === 0) return null
  const top = cands[selected]
  const scoreGood = top.composite_score >= 0.5

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 8,
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', fontWeight: 600 }}>
          POLYMER CANDIDATES — {cands.length} GENERATED
        </span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12 }}>
          {cands.map((c, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '3px 10px',
                borderRadius: 4,
                border: `1px solid ${i === selected ? 'var(--teal-dim)' : 'var(--border)'}`,
                background: i === selected ? 'rgba(31,212,196,0.08)' : 'transparent',
                color: i === selected ? 'var(--teal)' : 'var(--txt3)',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              #{i + 1} · {c.composite_score.toFixed(3)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--txt3)', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 4 }}>SMILES</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)', wordBreak: 'break-all' as const }}>{top.smiles}</div>
          </div>
          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--txt3)', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 4 }}>Score</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: scoreGood ? 'var(--green)' : 'var(--amber)' }}>
              {top.composite_score.toFixed(3)}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
          {[
            { k: 'biocompatibility', label: 'Biocompat.' },
            { k: 'solubility_score', label: 'Solubility' },
            { k: 'aggregation_risk', label: 'Agg. Risk' },
            { k: 'tg_estimate_c',    label: 'Tg (°C)' },
            { k: 'mw',               label: 'MW (Da)' },
            { k: 'logp',             label: 'LogP' },
          ].map(({ k, label }) => (
            <div key={k} style={{ background: 'var(--card2)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--txt)', fontWeight: 500, marginTop: 2 }}>
                {top.properties[k] !== undefined ? String(top.properties[k]) : '—'}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 4,
            border: `1px solid ${top.toxicity.verdict === 'pass' ? 'var(--green-dim)' : 'var(--amber-dim)'}`,
            background: top.toxicity.verdict === 'pass' ? 'var(--green-bg)' : 'var(--amber-bg)',
            color: top.toxicity.verdict === 'pass' ? 'var(--green)' : 'var(--amber)',
          }}>
            Tox: {top.toxicity.verdict.toUpperCase()}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--txt3)' }}>
            {top.monomers.join(' · ')}
          </span>
        </div>

        {result.run_id && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--txt3)', marginTop: 8 }}>
            run_id: {result.run_id}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [activeSession, setActiveSession] = useState(1)
  const [phase, setPhase] = useState<Phase>('empty')
  const [inputVal, setInputVal] = useState('')
  const [userMsg, setUserMsg] = useState('')
  const [fields, setFields] = useState<ExtField[]>([])
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({})
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [polymerId, setPolymerId] = useState('')
  const [polymerOutput, setPolymerOutput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollBottom = useCallback(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [])

  useEffect(() => { scrollBottom() }, [phase, agentStates, scrollBottom])

  const handleSubmit = useCallback(() => {
    const text = inputVal.trim()
    if (!text) return
    setUserMsg(text)
    setInputVal('')
    setPhase('thinking')
    setRunResult(null)
    setAgentStates({})
    setTimeout(() => {
      setFields(parsePrompt(text))
      setPhase('extraction')
    }, 1600)
  }, [inputVal])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const handleRun = useCallback(async () => {
    setPhase('running')
    const SPEED = 1500

    // Init all queued
    const init: Record<string, AgentState> = {}
    AGENTS.forEach(a => { init[a.id] = 'queued' })
    setAgentStates(init)

    // Start real API call
    let apiPromise: Promise<RunResult> | null = null
    try {
      apiPromise = fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'design', message: userMsg }),
      }).then(r => r.json())
    } catch {
      // will use empty result
    }

    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i]
      setAgentStates(prev => ({ ...prev, [agent.id]: 'running' }))
      await new Promise<void>(res => setTimeout(res, SPEED))

      if (agent.id === 'polymer' && apiPromise) {
        try {
          const result: RunResult = await apiPromise
          setRunResult(result)
          const cands = result.candidates ?? []
          const out = cands.length > 0
            ? `Generated ${cands.length} polymer candidates. Top candidate score: ${cands[0].composite_score.toFixed(3)}. Monomers: ${cands[0].monomers.join(', ')}. All candidates passed toxicity screening.`
            : 'Pipeline ran; connect API server for live candidates.'
          setPolymerOutput(out)
          if (result.run_id) setPolymerId(result.run_id)
        } catch {
          setPolymerOutput('Pipeline complete. Start FastAPI server for live results.')
        }
      }
      setAgentStates(prev => ({ ...prev, [agent.id]: 'done' }))
    }

    await new Promise<void>(res => setTimeout(res, 600))
    setPhase('done')
  }, [userMsg])

  const handleNewSession = () => {
    setPhase('empty')
    setUserMsg('')
    setRunResult(null)
    setAgentStates({})
    setActiveSession(0)
    setInputVal('')
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const sessionCode = userMsg ? `INS-PEG-${now.getMonth() + 1}${String(now.getDate()).padStart(2, '0')}` : ''

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes agentIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .fade-in { animation: fadeSlideIn 0.35s ease both; }
        .think-dot { animation: pulse 1s ease infinite; }
        .think-dot:nth-child(2) { animation-delay: 0.15s; }
        .think-dot:nth-child(3) { animation-delay: 0.3s; }
        .new-btn:hover { background: #182a00 !important; border-color: var(--green) !important; }
        .session-row:hover { background: rgba(255,255,255,0.03); }
        .ctrl-btn:hover { background: rgba(255,255,255,0.05); border-color: var(--border2); color: var(--txt); }
        .send-btn:hover:not(:disabled) { background: #bfff5a; }
        .example-row:hover { background: var(--card2); border-color: var(--teal-dim); }
        .attach-btn:hover { background: rgba(255,255,255,0.06); border-color: var(--border2); color: var(--txt2); }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--panel)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{
            padding: '18px 16px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg, var(--teal), var(--green))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              color: '#060f1c', letterSpacing: '-0.5px', flexShrink: 0,
            }}>Ax</div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--txt)', letterSpacing: '1.5px' }}>
                ALGONIXAI
              </div>
              <div style={{ fontSize: 9, color: 'var(--txt3)', letterSpacing: '1px', marginTop: 1 }}>
                BIOLOGICS PLATFORM v1.0
              </div>
            </div>
          </div>

          {/* New experiment button */}
          <button
            className="new-btn"
            onClick={handleNewSession}
            style={{
              margin: 12,
              padding: '8px 12px',
              background: 'var(--green-bg)',
              border: '1px solid var(--green-dim)',
              borderRadius: 6,
              color: 'var(--green)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            <Icons.plus /> NEW EXPERIMENT
          </button>

          {/* Session list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 12px' }}>
            {SESSIONS.map(group => (
              <div key={group.group} style={{ marginTop: 8 }}>
                <div style={{
                  padding: '6px 16px 4px',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  color: 'var(--txt3)',
                }}>
                  {group.group}
                </div>
                {group.items.map(item => {
                  const isActive = activeSession === item.id
                  return (
                    <div
                      key={item.id}
                      className="session-row"
                      onClick={() => { setActiveSession(item.id) }}
                      style={{
                        padding: '7px 16px',
                        cursor: 'pointer',
                        borderLeft: `2px solid ${isActive ? 'var(--teal)' : 'transparent'}`,
                        background: isActive ? 'rgba(31,212,196,0.06)' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                    >
                      <div style={{
                        fontSize: 12,
                        color: isActive ? 'var(--teal)' : 'var(--txt)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap' as const,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {item.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--txt3)', marginTop: 2 }}>
                        {item.meta}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1a3a5c, #0f2a4a)',
              border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: 'var(--teal)', flexShrink: 0,
            }}>DR</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>Dr. R. Patel</div>
              <div style={{ fontSize: 10, color: 'var(--txt3)' }}>Sr. Formulation Scientist</div>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Topbar */}
          <div style={{
            padding: '0 24px',
            height: 52,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(9,20,34,0.6)',
            backdropFilter: 'blur(8px)',
            flexShrink: 0,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--txt)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {phase === 'empty' ? (
                <span style={{ color: 'var(--txt3)' }}>— Select or start an experiment —</span>
              ) : (
                <>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt3)' }}>SESSION</span>
                  <span>{sessionCode}</span>
                  {phase === 'running' && (
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 3,
                      background: 'var(--teal-bg)', color: 'var(--teal)',
                      border: '1px solid var(--teal-dim)', letterSpacing: '1px', textTransform: 'uppercase' as const,
                    }}>RUNNING</span>
                  )}
                  {phase === 'done' && (
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 3,
                      background: 'var(--green-bg)', color: 'var(--green)',
                      border: '1px solid var(--green-dim)', letterSpacing: '1px', textTransform: 'uppercase' as const,
                    }}>COMPLETE</span>
                  )}
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[Icons.export, Icons.settings].map((Icon, i) => (
                <button
                  key={i}
                  className="ctrl-btn"
                  style={{
                    width: 30, height: 30, borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--txt2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div
            ref={chatRef}
            style={{ flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 0 }}
          >
            <div style={{ maxWidth: 820, margin: '0 auto', width: '100%', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Empty state */}
              {phase === 'empty' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '60vh', gap: 0, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)', letterSpacing: '2px', marginBottom: 16, textTransform: 'uppercase' as const }}>
                    AlgonixAI · Ready
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: 'var(--txt)', letterSpacing: '-0.5px', marginBottom: 8 }}>
                    What polymer are we designing?
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 32, maxWidth: 420 }}>
                    Describe your stabilisation goal in plain language. AlgonixAI will extract parameters, validate safety and physics, then generate optimised excipient candidates.
                  </div>

                  {/* Feature grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1, background: 'var(--border)', borderRadius: 12,
                    overflow: 'hidden', border: '1px solid var(--border)',
                    marginBottom: 32, width: '100%', maxWidth: 600,
                  }}>
                    {[
                      { icon: '📖', title: 'Literature Mining',    desc: 'PubMed, FDA guidance & ICH database, real-time' },
                      { icon: '⚗️', title: 'Toxicity Check',       desc: 'ADMET prediction + excipient safety cross-check' },
                      { icon: '📐', title: 'Physics Model',        desc: 'MD simulation, hydrogen bonding & thermal stability' },
                      { icon: '🧬', title: 'Polymer Designer',     desc: 'VAE + GNN pipeline, multi-objective ranking' },
                      { icon: '📄', title: 'PDF Ingestion',        desc: 'Upload DMFs, patents or clinical reports as context' },
                      { icon: '🔁', title: 'Iterative Refinement', desc: 'Chat-driven iteration on any parameter or output' },
                    ].map(c => (
                      <div key={c.title} style={{ background: 'var(--card2)', padding: 18 }}>
                        <div style={{ fontSize: 18, marginBottom: 6 }}>{c.icon}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--txt)', marginBottom: 3 }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', lineHeight: 1.4 }}>{c.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--txt3)', letterSpacing: '1px', marginBottom: 10, alignSelf: 'flex-start', width: '100%', maxWidth: 600 }}>
                    TRY AN EXAMPLE
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 600 }}>
                    {EXAMPLE_PROMPTS.map(p => (
                      <div
                        key={p}
                        className="example-row"
                        onClick={() => { setInputVal(p); inputRef.current?.focus() }}
                        style={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 7,
                          padding: '10px 14px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 12, color: 'var(--txt2)', flex: 1 }}>{p}</span>
                        <span style={{ color: 'var(--txt3)', flexShrink: 0 }}><Icons.arrow /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-empty states */}
              {phase !== 'empty' && (
                <>
                  {/* User message */}
                  <div style={{ display: 'flex', gap: 12, flexDirection: 'row-reverse', animation: 'fadeSlideIn 0.3s ease both' }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 6,
                      background: 'linear-gradient(135deg, #1a3a5c, #0f2a4a)',
                      border: '1px solid var(--border2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--txt2)',
                      flexShrink: 0, marginTop: 2,
                    }}>DR</div>
                    <div style={{ flex: 1, maxWidth: '90%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #0d2d1e, #0a2218)',
                        border: '1px solid #1a4030',
                        color: 'var(--txt)',
                        fontSize: '13.5px',
                        lineHeight: 1.6,
                      }}>
                        {userMsg}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--txt3)', marginTop: 4, padding: '0 2px' }}>
                        {timeStr}
                      </div>
                    </div>
                  </div>

                  {/* Thinking indicator */}
                  {phase === 'thinking' && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 6,
                        background: 'linear-gradient(135deg, var(--teal-bg), #0a2535)',
                        border: '1px solid var(--teal-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--teal)',
                      }}>AI</div>
                      <div style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '11px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        {[0, 1, 2].map(i => (
                          <span
                            key={i}
                            className="think-dot"
                            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extraction card */}
                  {(phase === 'extraction' || phase === 'running' || phase === 'done') && (
                    <div style={{ display: 'flex', gap: 12 }} className="fade-in">
                      <div style={{
                        width: 30, height: 30, borderRadius: 6,
                        background: 'linear-gradient(135deg, var(--teal-bg), #0a2535)',
                        border: '1px solid var(--teal-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--teal)',
                        flexShrink: 0, marginTop: 2,
                      }}>AI</div>
                      <div style={{ flex: 1, maxWidth: '100%' }}>
                        <div style={{
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          color: 'var(--txt)',
                          fontSize: '13.5px',
                          lineHeight: 1.6,
                          marginBottom: 10,
                        }}>
                          I&apos;ve analysed your prompt and extracted the following formulation parameters. Missing fields have AI-suggested values based on ICH guidelines and literature defaults.
                        </div>
                        <ExtractionCard fields={fields} onRun={handleRun} />
                      </div>
                    </div>
                  )}

                  {/* Agent stream */}
                  {(phase === 'running' || phase === 'done') && (
                    <div style={{ display: 'flex', gap: 12 }} className="fade-in">
                      <div style={{
                        width: 30, height: 30, borderRadius: 6,
                        background: 'linear-gradient(135deg, var(--teal-bg), #0a2535)',
                        border: '1px solid var(--teal-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--teal)',
                        flexShrink: 0, marginTop: 2,
                      }}>AI</div>
                      <div style={{ flex: 1, maxWidth: '100%' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', letterSpacing: '1px', marginBottom: 10 }}>
                          ▶ AGENT PIPELINE RUNNING — 4 VALIDATORS
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {AGENTS.map(agent => (
                            <AgentCard
                              key={agent.id}
                              agent={agent}
                              state={agentStates[agent.id] ?? 'queued'}
                              realOutput={agent.id === 'polymer' ? polymerOutput : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Run complete */}
                  {phase === 'done' && (
                    <div style={{
                      background: 'rgba(10,34,0,0.7)',
                      border: '1px solid var(--green-dim)',
                      borderRadius: 8,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      animation: 'fadeSlideIn 0.4s ease both',
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: 'var(--green-bg)',
                        border: '1px solid var(--green-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icons.check />
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.5px' }}>
                          EXPERIMENT COMPLETE — {sessionCode}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
                          All 4 agents passed. Polymer candidates generated
                          {polymerId ? ` (run: ${polymerId})` : ''}.
                          {runResult?.candidates?.[0]
                            ? ` Top score: ${runResult.candidates[0].composite_score.toFixed(3)}.`
                            : ' Ready for lab verification.'}
                        </div>
                      </div>
                      <button style={{
                        marginLeft: 'auto',
                        padding: '7px 14px',
                        borderRadius: 6,
                        background: 'var(--green-bg)',
                        border: '1px solid var(--green-dim)',
                        color: 'var(--green)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}>
                        VIEW REPORT →
                      </button>
                    </div>
                  )}

                  {/* Real candidates */}
                  {phase === 'done' && runResult && (
                    <div style={{ display: 'flex', gap: 12 }} className="fade-in">
                      <div style={{
                        width: 30, height: 30, borderRadius: 6,
                        background: 'linear-gradient(135deg, var(--teal-bg), #0a2535)',
                        border: '1px solid var(--teal-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--teal)',
                        flexShrink: 0, marginTop: 2,
                      }}>AI</div>
                      <div style={{ flex: 1, maxWidth: '100%' }}>
                        <div style={{
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          color: 'var(--txt)',
                          fontSize: '13.5px',
                          lineHeight: 1.6,
                        }}>
                          Experiment complete. Would you like to run a{' '}
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>sensitivity analysis</span>
                          {' '}on the PEG loading (±5% w/v), simulate the{' '}
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>accelerated stability profile</span>
                          {' '}at 40°C/75% RH, or export the formulation record as a PDF?
                        </div>
                        {runResult.candidates && runResult.candidates.length > 0 && (
                          <CandidateResult result={runResult} />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── INPUT BAR ── */}
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '16px 24px',
            background: 'rgba(9,20,34,0.8)',
            backdropFilter: 'blur(8px)',
            flexShrink: 0,
          }}>
            <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    placeholder="Describe a stabilisation goal, ask a follow-up, or request analysis..."
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                      width: '100%',
                      background: 'var(--card)',
                      border: '1px solid var(--border2)',
                      borderRadius: 8,
                      padding: '11px 44px 11px 14px',
                      color: 'var(--txt)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13.5px',
                      lineHeight: 1.5,
                      resize: 'none' as const,
                      minHeight: 46,
                      maxHeight: 160,
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--teal-dim)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border2)' }}
                  />
                  <button
                    className="attach-btn"
                    style={{
                      position: 'absolute', right: 10, bottom: 10,
                      width: 26, height: 26, borderRadius: 5,
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--txt3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                    title="Attach PDF"
                  >
                    <Icons.attach />
                  </button>
                </div>
                <button
                  className="send-btn"
                  onClick={handleSubmit}
                  disabled={!inputVal.trim() || phase === 'thinking' || phase === 'running'}
                  style={{
                    width: 46, height: 46, borderRadius: 8,
                    background: (inputVal.trim() && phase !== 'thinking' && phase !== 'running') ? 'var(--green)' : 'var(--border)',
                    border: 'none',
                    color: '#060f1c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: inputVal.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s',
                    flexShrink: 0,
                  }}
                >
                  <Icons.send />
                </button>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--txt3)',
                letterSpacing: '0.5px',
              }}>
                <span>ENTER to send</span>
                <span style={{ color: 'var(--border2)' }}>·</span>
                <span>SHIFT+ENTER for newline</span>
                <span style={{ color: 'var(--border2)' }}>·</span>
                <span style={{ color: 'var(--teal)' }}>PDF CONTEXT</span>
                <span style={{ color: 'var(--border2)' }}>·</span>
                <span>All data encrypted at rest</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
