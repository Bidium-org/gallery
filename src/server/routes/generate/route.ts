
import { OPENROUTER_BASE_URL } from '@/lib/constants'
import { getSettings, saveImage } from '@/lib/database'
import type {
  GenerateApiResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '@/types/TImageGeneration'

export async function POST(request: Request) {
  const { openRouterApiKey } = await getSettings()

  if (!openRouterApiKey) {
    return Response.json(
      { error: 'No API key configured — open Settings' },
      { status: 500 },
    )
  }

  const payload = (await request.json()) as ImageGenerationRequest

  if (!payload.model || !payload.prompt) {
    return Response.json(
      { error: 'model and prompt are required' },
      { status: 400 },
    )
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('openrouter_generation_failed', response.status, body)

      let message = 'Image generation failed'
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } }
        if (parsed.error?.message) message = parsed.error.message
      } catch {
      }

      return Response.json({ error: message }, { status: 502 })
    }

    const result = (await response.json()) as ImageGenerationResponse

    const images = await Promise.all(
      result.data.map(async (image) => {
        const mediaType = image.media_type ?? 'image/png'
        const extension = mediaType.split('/')[1] ?? 'png'
        const filename = await saveImage(
          Buffer.from(image.b64_json, 'base64'),
          extension,
        )
        return { url: `/api/images/${filename}` }
      }),
    )

    const body: GenerateApiResponse = { images, usage: result.usage }

    return Response.json(body)
  } catch (error) {
    console.error('openrouter_generation_failed', error)
    return Response.json(
      { error: 'Image generation failed' },
      { status: 502 },
    )
  }
}