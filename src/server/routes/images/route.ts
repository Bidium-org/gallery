
import { saveImage } from '@/lib/database'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

function resolveExtension(file: File): string | null {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  return EXTENSION_BY_MIME[file.type] ?? null
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)

    if (files.length === 0) {
      return Response.json({ error: 'files are required' }, { status: 400 })
    }

    const images = await Promise.all(
      files.map(async (file) => {
        const extension = resolveExtension(file)
        if (!extension) throw new Error(`Unsupported image type: ${file.type}`)

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = await saveImage(buffer, extension)
        return { url: `/api/images/${filename}` }
      }),
    )

    return Response.json({ images })
  } catch (error) {
    console.error('image_upload_failed', error)
    return Response.json(
      { error: 'Failed to save images' },
      { status: 500 },
    )
  }
}