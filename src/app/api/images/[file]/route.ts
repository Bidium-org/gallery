import { NextResponse } from 'next/server'

import { readImage } from '@/lib/database'

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params

  try {
    const buffer = await readImage(file)
    if (!buffer) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const extension = file.split('.').pop()?.toLowerCase() ?? ''
    const contentType = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'

    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'immutable' },
    })
  } catch (error) {
    console.error('image_read_failed', file, error)
    return NextResponse.json({ error: 'Failed to read image' }, { status: 500 })
  }
}