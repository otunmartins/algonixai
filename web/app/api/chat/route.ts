import { NextRequest, NextResponse } from 'next/server'

const API = process.env.API_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    intent: 'qa' | 'design'
    message: string
    top_k?: number
    target_properties?: Record<string, number | boolean>
    n_candidates?: number
    constraints?: Record<string, number>
  }

  const { intent, message } = body

  if (intent === 'qa') {
    const res = await fetch(`${API}/api/v1/literature/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message, top_k: body.top_k ?? 5 }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Literature agent error' }))
      return NextResponse.json({ error: err.detail }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json({ type: 'qa', ...data })
  }

  if (intent === 'design') {
    const res = await fetch(`${API}/api/v1/polymer/design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_properties: body.target_properties ?? { solubility: 0.7, biocompatibility: 0.8 },
        n_candidates: body.n_candidates ?? 5,
        constraints: body.constraints,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Polymer design error' }))
      return NextResponse.json({ error: err.detail }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json({ type: 'design', ...data })
  }

  return NextResponse.json({ error: 'Unknown intent' }, { status: 400 })
}
