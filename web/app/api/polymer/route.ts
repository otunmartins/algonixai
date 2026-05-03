import { NextRequest, NextResponse } from 'next/server'

const API = process.env.API_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    target_properties: Record<string, number | boolean>
    seed_smiles?: string | null
    n_candidates?: number
    constraints?: Record<string, number> | null
  }

  const res = await fetch(`${API}/api/v1/polymer/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_properties: body.target_properties,
      seed_smiles:       body.seed_smiles ?? null,
      n_candidates:      body.n_candidates ?? 5,
      constraints:       body.constraints ?? null,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Polymer design error' }))
    return NextResponse.json({ error: err.detail }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
