import type { Metadata } from 'next'
import Link from 'next/link'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = { title: 'Hub' }

// ── Server-side API health check ──────────────────────────────────────────────

async function getApiStatus(): Promise<'online' | 'offline'> {
  try {
    const res = await fetch(`${process.env.API_URL ?? 'http://localhost:8000'}/health`, {
      next: { revalidate: 30 },
    })
    return res.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#0F1C2E] border border-[#192D46] rounded-xl p-5">
      <p className="font-mono text-[10px] text-[#304C68] tracking-widest uppercase mb-3">{label}</p>
      <p className={`font-mono text-2xl font-bold ${accent ?? 'text-[#D8E8F8]'}`}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-[#4A6A88] mt-1">{sub}</p>}
    </div>
  )
}

function QuickAction({ href, label, desc, accent }: { href: string; label: string; desc: string; accent: string }) {
  return (
    <Link
      href={href}
      className="bg-[#0F1C2E] border border-[#192D46] rounded-xl p-5 hover:border-[#213A58] hover:bg-[#132133] transition-all duration-150 group block"
    >
      <p className={`font-mono text-[11px] font-bold tracking-wide ${accent} mb-1.5`}>{label}</p>
      <p className="text-[13px] text-[#6888AA] group-hover:text-[#94A3B8] leading-snug">{desc}</p>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HubPage() {
  const apiStatus = await getApiStatus()

  return (
    <AppShell>
      <div className="p-8 max-w-[1100px]">

        {/* Header */}
        <div className="mb-8">
          <p className="font-mono text-[10px] text-[#304C68] tracking-widest uppercase mb-1">AlgonixAI — Hub</p>
          <h1 className="text-2xl font-semibold text-[#D8E8F8]">Your biologics lab</h1>
          <p className="text-[14px] text-[#6888AA] mt-1">Design, test, and validate polymer excipients for insulin stabilisation.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Experiments" value="0" sub="Run your first experiment" />
          <StatCard label="Compounds Designed" value="0" sub="via Polymer Studio" />
          <StatCard label="Avg Stability Score" value="—" sub="6-dimension composite" />
          <StatCard label="Corpus Documents" value="1,066" sub="PubMed + arXiv" accent="text-teal-400" />
        </div>

        {/* Quick actions */}
        <div className="mb-8">
          <p className="font-mono text-[10px] text-[#304C68] tracking-widest uppercase mb-4">Quick actions</p>
          <div className="grid grid-cols-3 gap-4">
            <QuickAction
              href="/chat"
              label="New Experiment"
              desc="Describe your stabilisation goal and let the pipeline design polymer candidates."
              accent="text-[#A3E635]"
            />
            <QuickAction
              href="/polymer-studio"
              label="Polymer Studio"
              desc="Browse, compare, and visualise designed polymer candidates across chemical space."
              accent="text-teal-400"
            />
            <QuickAction
              href="/corpus"
              label="Search Corpus"
              desc="Query 1,066 peer-reviewed documents with semantic + BM25 hybrid retrieval."
              accent="text-[#A78BFA]"
            />
          </div>
        </div>

        {/* Recent experiments */}
        <div className="mb-8">
          <p className="font-mono text-[10px] text-[#304C68] tracking-widest uppercase mb-4">Recent experiments</p>
          <div className="bg-[#0F1C2E] border border-[#192D46] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_160px_120px_120px_100px] px-5 py-3 border-b border-[#192D46]">
              {['Experiment', 'Top Polymer', 'Stability', 'Safety', 'Status'].map(h => (
                <span key={h} className="font-mono text-[10px] text-[#304C68] tracking-widest uppercase">{h}</span>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0C1526] border border-[#192D46] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#304C68" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m9.9 9.9 2.1 2.1M4.9 19.1l2.1-2.1m9.9-9.9 2.1-2.1"/>
                </svg>
              </div>
              <p className="text-[13px] text-[#6888AA]">No experiments yet</p>
              <Link
                href="/chat"
                className="font-mono text-[11px] font-bold text-[#A3E635] hover:text-[#BEF264] transition-colors"
              >
                Start your first experiment →
              </Link>
            </div>
          </div>
        </div>

        {/* System status */}
        <div className="flex items-center gap-6">
          <p className="font-mono text-[10px] text-[#304C68] tracking-widest uppercase">System status</p>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-[#A3E635]' : 'bg-[#F87171]'}`} />
            <span className="font-mono text-[11px] text-[#6888AA]">
              API {apiStatus === 'online' ? 'online' : 'offline'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span className="font-mono text-[11px] text-[#6888AA]">Chroma 1,066 docs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" />
            <span className="font-mono text-[11px] text-[#6888AA]">Langfuse tracing</span>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
