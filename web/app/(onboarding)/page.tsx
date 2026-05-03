import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Onboarding' }

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-xs tracking-widest uppercase text-teal mb-3">AlgonixAI</p>
        <h1 className="text-2xl font-semibold mb-1">Onboarding</h1>
        <p className="text-sm text-[#475569]">S03a–f — 6-step flow: Profile · Persona · Scoring · ELN · Pipeline · Launch</p>
        <p className="text-sm text-[#475569] mt-1">Full implementation in Phase 2</p>
      </div>
    </main>
  )
}
