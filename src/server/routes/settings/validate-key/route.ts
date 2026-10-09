
import { OPENROUTER_BASE_URL } from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const { apiKey } = (await request.json()) as { apiKey?: string }

    if (!apiKey) {
      return Response.json({ error: 'apiKey is required' }, { status: 400 })
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/credits`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      return Response.json(
        { error: 'Invalid API key' },
        { status: 401 },
      )
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error('openrouter_key_validation_failed', error)
    return Response.json(
      { error: 'Validation failed — check your network connection' },
      { status: 502 },
    )
  }
}