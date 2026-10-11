
import { resolveExtension, saveImage } from '@/lib/database'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)

    if (files.length === 0) {
      return Response.json({ error: 'files are required' }, { status: 400 })
    }

    const images = await Promise.all(
      files.map(async (file) => {
        const extension = resolveExtension(file.name, file.type)
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