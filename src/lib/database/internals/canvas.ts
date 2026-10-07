import fs from 'node:fs/promises'
import path from 'node:path'

import { deleteImages } from '@/lib/database/internals/images'
import { CANVAS_FOLDER } from '@/lib/database/internals/paths'
import type { CanvasContent, CanvasFile, CanvasMeta } from '@/types/TCanvas'

const locks = new Map<string, Promise<void>>()

function withCanvasLock<T>(id: string, run: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve()
  const result = previous.then(run)
  locks.set(
    id,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
}

function canvasPath(id: string): string {
  return path.join(CANVAS_FOLDER, `${id}.json`)
}

export async function initializeCanvasFolder(): Promise<void> {
  await fs.mkdir(CANVAS_FOLDER, { recursive: true })
}

export async function getAllCanvasMeta(): Promise<CanvasMeta[]> {
  await initializeCanvasFolder()

  const files = await fs.readdir(CANVAS_FOLDER)
  const metas: CanvasMeta[] = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const data = await fs.readFile(path.join(CANVAS_FOLDER, file), 'utf-8')
      const canvas = JSON.parse(data) as CanvasFile
      metas.push({ id: canvas.id, name: canvas.name, updatedAt: canvas.updatedAt })
    } catch (error) {
      console.error(`canvas_read_failed ${file}`, error)
    }
  }

  return metas.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getCanvasById(id: string): Promise<CanvasFile | null> {
  try {
    const data = await fs.readFile(canvasPath(id), 'utf-8')
    return JSON.parse(data) as CanvasFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function createCanvas(content: CanvasContent): Promise<CanvasFile> {
  await initializeCanvasFolder()

  const now = Date.now()
  const canvas: CanvasFile = {
    id: crypto.randomUUID(),
    ...content,
    createdAt: now,
    updatedAt: now,
  }

  await fs.writeFile(canvasPath(canvas.id), JSON.stringify(canvas, null, 2), 'utf-8')
  return canvas
}

export async function updateCanvas(
  id: string,
  updates: Partial<CanvasContent>,
): Promise<CanvasFile> {
  return withCanvasLock(id, async () => {
    const canvas = await getCanvasById(id)
    if (!canvas) throw new Error(`Canvas ${id} not found`)

    const updated: CanvasFile = { ...canvas, ...updates, updatedAt: Date.now() }

    const filePath = canvasPath(id)
    const tempPath = `${filePath}.${Date.now()}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(updated, null, 2), 'utf-8')
    await fs.rename(tempPath, filePath)

    return updated
  })
}

export async function deleteCanvas(id: string): Promise<void> {
  const canvas = await getCanvasById(id)

  try {
    await fs.unlink(canvasPath(id))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  if (!canvas) return

  const filenames = canvas.nodes
    .filter((node) => node.type === 'image')
    .map((node) => node.data.imageUrl)
    .filter((url) => url.startsWith('/api/images/'))
    .map((url) => url.slice('/api/images/'.length))

  await deleteImages(filenames)
}