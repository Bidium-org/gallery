
import { OPENROUTER_BASE_URL } from '@/lib/constants'
import { getSettings } from '@/lib/database'
import type { ImageModelsResponse } from '@/types/TImageModel'

export async function GET() {
  const { openRouterApiKey } = await getSettings()

  if (!openRouterApiKey) {
    return Response.json(
      { error: 'No API key configured — open Settings' },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/images/models`, {
      headers: { Authorization: `Bearer ${openRouterApiKey}` },
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('openrouter_models_fetch_failed', response.status, body)
      return Response.json(
        { error: 'Failed to fetch image models' },
        { status: 502 },
      )
    }

    const { data } = (await response.json()) as ImageModelsResponse
    const models = data.filter((model) =>
      model.architecture.output_modalities.includes('image'),
    )

    return Response.json({ data: models })
  } catch (error) {
    console.error('openrouter_models_fetch_failed', error)
    return Response.json(
      { error: 'Failed to fetch image models' },
      { status: 502 },
    )
  }
}