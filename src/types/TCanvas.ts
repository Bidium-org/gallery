import type { Viewport } from '@xyflow/react'

import type { CanvasEdge, CanvasNode } from '@/types/TCanvasNode'

export type CanvasContent = {
  name: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  viewport: Viewport
}

export type CanvasFile = CanvasContent & {
  id: string
  createdAt: number
  updatedAt: number
}

export type CanvasMeta = {
  id: string
  name: string
  updatedAt: number
}