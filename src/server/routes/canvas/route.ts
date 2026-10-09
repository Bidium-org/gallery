
import { createCanvas, getAllCanvasMeta } from '@/lib/database'
import type { CanvasContent } from '@/types/TCanvas'

export async function GET() {
  try {
    const canvases = await getAllCanvasMeta()
    return Response.json({ canvases })
  } catch (error) {
    console.error('canvas_list_failed', error)
    return Response.json(
      { error: 'Failed to list canvases' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const content = (await request.json()) as CanvasContent

    if (!content.name || !Array.isArray(content.nodes) || !Array.isArray(content.edges)) {
      return Response.json(
        { error: 'name, nodes and edges are required' },
        { status: 400 },
      )
    }

    const canvas = await createCanvas(content)
    return Response.json(canvas)
  } catch (error) {
    console.error('canvas_create_failed', error)
    return Response.json(
      { error: 'Failed to create canvas' },
      { status: 500 },
    )
  }
}