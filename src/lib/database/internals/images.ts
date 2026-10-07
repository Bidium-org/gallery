import fs from 'node:fs/promises'
import path from 'node:path'

import { IMAGES_FOLDER } from '@/lib/database/internals/paths'

const FILENAME_PATTERN = /^[\w-]+\.\w+$/

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