import { NextResponse } from 'next/server'

import { NAMING_MODEL, OPENROUTER_BASE_URL } from '@/lib/constants'
import { getSettings } from '@/lib/database'

type ChatCompletionsResponse = {
  choices: { message: { content: string } }[]
}

export async function POST(request: Request) {
  const { openRouterApiKey } = await getSettings()

  if (!openRouterApiKey) {
    return NextResponse.json(
      { error: 'No API key configured — open Settings' },
      { status: 500 },
    )
  }

  const { prompt } = (await request.json()) as { prompt?: string }

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NAMING_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You name image-generation outputs. You only ever receive the text prompt that produced the image — never the image itself, and that is expected. Never refuse, never mention missing images, never ask questions. Always reply with an ultra-short name (1 to 3 words) capturing the subject. Name only: no punctuation, no quotes, no explanation.',
          },
          { role: 'user', content: prompt.replaceAll('@', '') },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('openrouter_naming_failed', response.status, body)
      return NextResponse.json({ error: 'Naming failed' }, { status: 502 })
    }

    const result = (await response.json()) as ChatCompletionsResponse
    const name = result.choices[0]?.message.content.trim() ?? ''

    return NextResponse.json({ name })
  } catch (error) {
    console.error('openrouter_naming_failed', error)
    return NextResponse.json({ error: 'Naming failed' }, { status: 502 })
  }
}