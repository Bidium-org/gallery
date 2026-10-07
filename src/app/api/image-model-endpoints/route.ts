import { NextResponse } from 'next/server'

import { OPENROUTER_BASE_URL } from '@/lib/constants'
import { getSettings } from '@/lib/database'
import type { ImageModelEndpointsResponse } from '@/types/TImageModelEndpoint'

export async function GET(request: Request) {
  const { openRouterApiKey } = await getSettings()

  if (!openRouterApiKey) {
    return NextResponse.json(
      { error: 'No API key configured — open Settings' },
      { status: 500 },
    )
  }

  const modelId = new URL(request.url).searchParams.get('model')

  if (!modelId) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `${OPENROUTER_BASE_URL}/images/models/${modelId}/endpoints`,
      { headers: { Authorization: `Bearer ${openRouterApiKey}` } },
    )

    if (!response.ok) {
      const body = await response.text()
      console.error('openrouter_endpoints_fetch_failed', response.status, body)
      return NextResponse.json(
        { error: 'Failed to fetch model endpoints' },
        { status: 502 },
      )
    }

    const result = (await response.json()) as ImageModelEndpointsResponse
    return NextResponse.json(result)
  } catch (error) {
    console.error('openrouter_endpoints_fetch_failed', error)
    return NextResponse.json(
      { error: 'Failed to fetch model endpoints' },
      { status: 502 },
    )
  }
}