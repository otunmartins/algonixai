import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Monitoring' }

export default function MonitoringPage() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-xs tracking-widest uppercase text-teal mb-3">AlgonixAI</p>
        <h1 className="text-2xl font-semibold mb-1">Monitoring</h1>
        <p className="text-sm text-[#475569]">S12 — Langfuse · Prometheus · Grafana · Evidently · MLflow</p>
        <p className="text-sm text-[#475569] mt-1">Full implementation in Phase 2</p>
      </div>
    </main>
  )
}
