import type {
    GenerateApiResponse,
    ImageInputReference,
  } from '@/types/TImageGeneration'
  import type { ParamValue } from '@/types/TImageModel'
  
  export type GenerationImageInput = {
    label: string
    imageUrl: string
  }
  
  export type GenerationTextInput = {
    label: string
    content: string
  }
  
  export type GenerationInput = {
    model: string
    prompt: string
    params?: Record<string, ParamValue>
    images?: GenerationImageInput[]
    texts?: GenerationTextInput[]
    maxReferences?: number | null
  }
  
  export type GenerationResult = {
    images: { url: string }[]
    cost?: number
  }
  
  async function toDataUrl(imageUrl: string): Promise<string> {
    if (imageUrl.startsWith('data:')) return imageUrl
  
    const blob = await fetch(imageUrl).then((response) => response.blob())
  
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(blob)
    })
  }
  
  function resolvePrompt(prompt: string, texts: GenerationTextInput[]): string {
    let resolved = prompt
    const ordered = [...texts].sort((a, b) => b.label.length - a.label.length)
    for (const text of ordered) {
      resolved = resolved.split(`@${text.label}`).join(text.content)
    }
    return resolved
  }
  
  async function resolveReferences(
    images: GenerationImageInput[],
    maxReferences: number | null | undefined,
  ): Promise<ImageInputReference[]> {
    const capped = maxReferences != null ? images.slice(0, maxReferences) : images
  
    return Promise.all(
      capped.map(async (image) => ({
        type: 'image_url' as const,
        image_url: { url: await toDataUrl(image.imageUrl) },
      })),
    )
  }
  
  export async function generateImage(
    input: GenerationInput,
  ): Promise<GenerationResult> {
    const params = { ...input.params }
    delete params['input_references']
  
    const references = await resolveReferences(
      input.images ?? [],
      input.maxReferences,
    )
  
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        prompt: resolvePrompt(input.prompt, input.texts ?? []),
        ...params,
        ...(references.length > 0 ? { input_references: references } : {}),
      }),
    })
  
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(body?.error ?? 'Image generation failed')
    }
  
    const result = (await response.json()) as GenerateApiResponse
  
    return { images: result.images, cost: result.usage?.cost }
  }