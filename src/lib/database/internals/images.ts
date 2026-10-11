import fs from 'node:fs/promises'
import path from 'node:path'

import { IMAGES_FOLDER } from '@/lib/database/internals/paths'

const FILENAME_PATTERN = /^[\w-]+\.\w+$/

export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

// The extensions of the image types above, `jpeg` being the other spelling of `jpg`.
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([...Object.values(EXTENSION_BY_MIME), 'jpeg'])

export function resolveExtension(name: string, mimeType: string): string | null {
  const fromName = name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  return EXTENSION_BY_MIME[mimeType] ?? null
}

export function imagePath(filename: string): string {
  return path.join(IMAGES_FOLDER, filename)
}

export async function initializeImagesFolder(): Promise<void> {
  await fs.mkdir(IMAGES_FOLDER, { recursive: true })
}

export async function saveImage(buffer: Buffer, extension: string): Promise<string> {
  await initializeImagesFolder()

  const filename = `${crypto.randomUUID()}.${extension}`
  await fs.writeFile(path.join(IMAGES_FOLDER, filename), buffer)
  return filename
}

export async function readImage(filename: string): Promise<Buffer | null> {
  if (!FILENAME_PATTERN.test(filename)) return null

  try {
    return await fs.readFile(path.join(IMAGES_FOLDER, filename))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function deleteImages(filenames: string[]): Promise<void> {
  await Promise.all(
    filenames.map(async (filename) => {
      if (!FILENAME_PATTERN.test(filename)) return
      try {
        await fs.unlink(path.join(IMAGES_FOLDER, filename))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }),
  )
}