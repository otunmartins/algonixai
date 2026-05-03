import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'algonixai-web',
    timestamp: new Date().toISOString(),
  })
}
