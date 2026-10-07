'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react'

import { ImageNode } from './nodes/image-node'
import { TextNode } from './nodes/text-node'
import { ErrorNode } from './nodes/error-node'
import { SideBar } from './sidebar'
import { useCanvasShortcuts } from '@/hooks/use-canvas-shortcuts'
import { isEdgeVisible } from '@/lib/versioning'
import { useCanvasStore } from '@/stores/canvas-store'

const nodeTypes = {
  image: ImageNode,
  text: TextNode,
  error: ErrorNode,
}

const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes('Files')

async function uploadImages(files: File[]): Promise<{ name: string; url: string }[]> {
  const formData = new FormData()
  for (const file of files) formData.append('files', file)

  const response = await fetch('/api/images', { method: 'POST', body: formData })
  if (!response.ok) throw new Error('Image upload failed')

  const { images } = (await response.json()) as { images: { url: string }[] }
  return images.map((image, index) => ({ name: files[index].name, url: image.url }))
}

function Flow() {
  const {
    nodes,
    edges,
    canvasId,
    viewport,
    initialize,
    setViewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addTextNode,
    addDroppedImages,
  } = useCanvasStore((state) => state)
  useCanvasShortcuts()

  const selectedNodeIds = new Set(
    nodes.filter((node) => node.selected).map((node) => node.id),
  )
  const displayEdges = edges
    .filter((edge) => isEdgeVisible(edge, nodes))
    .map((edge) => {
      const highlighted =
        (edge.selected ?? false) ||
        selectedNodeIds.has(edge.source) ||
        selectedNodeIds.has(edge.target)
      return {
        ...edge,
        style: highlighted ? { stroke: '#38bdf8', strokeWidth: 2 } : undefined,
      }
    })

  const [menuOpen, setMenuOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragDepth = useRef(0)
  const appliedCanvasRef = useRef<string | null | undefined>(undefined)
  const { screenToFlowPosition, setViewport: applyViewport } = useReactFlow()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (appliedCanvasRef.current === canvasId) return
    appliedCanvasRef.current = canvasId
    void applyViewport(viewport)
  }, [canvasId, viewport, applyViewport])

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setIsDragOver(true)
  }, [])

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setIsDragOver(false)
    }
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      dragDepth.current = 0
      setIsDragOver(false)

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/'),
      )
      if (files.length === 0) return

      uploadImages(files)
        .then((uploaded) => addDroppedImages(uploaded, position))
        .catch((error) => console.error('image_upload_failed', error))
    },
    [screenToFlowPosition, addDroppedImages],
  )

  const addTextAtCenter = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addTextNode(position)
    setMenuOpen(false)
  }, [screenToFlowPosition, addTextNode])

  return (
    <div
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={(_event, nextViewport) => setViewport(nextViewport)}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        minZoom={0.05}
        maxZoom={4}
        selectionOnDrag
        panOnDrag={false}
        panActivationKeyCode="Space"
        panOnScroll
        zoomOnScroll={false}
        selectionMode={SelectionMode.Partial}
        defaultEdgeOptions={{ style: { strokeWidth: 2 } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#333" />
        <Controls />
        <SideBar />
        <Panel position="bottom-center" className="mb-6">
          <div className="relative">
            {menuOpen && (
              <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl">
                <button
                  onClick={addTextAtCenter}
                  className="rounded-md px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  Text
                </button>
              </div>
            )}
            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-lg text-neutral-400 shadow-xl hover:bg-neutral-800 hover:text-neutral-200"
            >
              +
            </button>
          </div>
        </Panel>
      </ReactFlow>

      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-sky-500/10 ring-2 ring-inset ring-sky-500">
          <div className="rounded-lg border border-sky-500/40 bg-neutral-950/80 px-4 py-2 text-sm text-sky-300">
            Drop images to add them to the canvas
          </div>
        </div>
      )}
    </div>
  )
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}