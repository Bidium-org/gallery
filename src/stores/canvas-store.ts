'use client'

import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from '@xyflow/react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { generateImage } from '@/lib/generation'
import {
  applyRedo,
  applyUndo,
  EMPTY_HISTORY,
  pushSnapshot,
  takeSnapshot,
  type HistoryStacks,
} from '@/lib/history'
import { nameGeneration } from '@/lib/naming'
import { cloneSubgraph, extractSelection, type Subgraph } from '@/lib/subgraph'
import {
  anyVersionCites,
  appendVersion,
  citesLabel,
  currentVersion,
  edgeVersionId,
  isTextNode,
  navigateToVersion,
  patchCurrentVersion,
  prepareLoadedCanvas,
  renameMention,
  stripDisconnectedMentions,
  versionInputNodes,
} from '@/lib/versioning'
import { defaultCanvasName, newId } from '@/stores/canvas-init'
import type { CanvasFile, CanvasMeta } from '@/types/TCanvas'
import type {
  CanvasEdge,
  CanvasImageNode,
  CanvasNode,
  CanvasTextNode,
  TextNodeData,
  TextVersion,
} from '@/types/TCanvasNode'
import type { ImageModel, ParamValue } from '@/types/TImageModel'
import { settingsStore } from '@/stores/settings-store'

export type DroppedImage = {
  name: string
  url: string
}

export type GenerateInput = {
  prompt: string
  model: ImageModel
  maxReferences: number | null
}

export type CanvasStoreState = {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  canvasId: string | null
  canvasName: string
  viewport: Viewport
  canvasList: CanvasMeta[]
  past: HistoryStacks['past']
  future: HistoryStacks['future']
  clipboard: Subgraph | null
  initialize: () => Promise<void>
  fetchCanvasList: () => Promise<void>
  newCanvas: () => Promise<void>
  loadCanvas: (id: string) => Promise<void>
  renameCanvas: (id: string, name: string) => Promise<void>
  removeCanvas: (id: string) => Promise<void>
  setViewport: (viewport: Viewport) => void
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void
  onConnect: (connection: Connection) => void
  addTextNode: (position: XYPosition, data?: Partial<TextNodeData>) => void
  addDroppedImages: (files: DroppedImage[], position: XYPosition) => void
  connectMention: (sourceId: string, targetId: string) => void
  renameNode: (id: string, nextLabel: string) => void
  updateTextContent: (id: string, content: string) => void
  selectModel: (id: string, modelId: string) => void
  setParam: (id: string, name: string, value: ParamValue | null) => void
  createVersion: (id: string) => void
  createVersionForSelection: () => void
  navigateVersion: (id: string, direction: -1 | 1) => void
  generateFromTextNode: (id: string, input: GenerateInput) => Promise<void>
  copySelection: () => void
  pasteClipboard: () => void
  duplicateSelection: () => void
  undo: () => void
  redo: () => void
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }
const ARTIFACT_GAP = 60
const ARTIFACT_STACK_GAP = 260
const FALLBACK_NODE_WIDTH = 300
const SAVE_DEBOUNCE_MS = 800
const PASTE_OFFSET = 40
const INTERNAL_CLIPBOARD_MARKER = 'image-canvas:nodes'

let saveTimer: ReturnType<typeof setTimeout> | null = null
let promotionPromise: Promise<void> | null = null
let historyCoalesced = false
let isDragging = false

const withData = <N extends CanvasNode>(node: N, data: N['data']): N => ({
  ...node,
  data,
})

function findTextNode(
  nodes: CanvasNode[],
  id: string,
): CanvasTextNode | undefined {
  return nodes.find(
    (candidate): candidate is CanvasTextNode =>
      candidate.type === 'text' && candidate.id === id,
  )
}

export const canvasStore = createStore<CanvasStoreState>()((set, get) => {
  const pushHistory = () => {
    if (historyCoalesced) return
    historyCoalesced = true
    queueMicrotask(() => {
      historyCoalesced = false
    })

    const { nodes, edges, past } = get()
    set({ ...pushSnapshot({ past, future: [] }, takeSnapshot(nodes, edges)) })
  }

  const serializeContent = () => {
    const { nodes, edges, viewport, canvasName } = get()
    return { name: canvasName, ...takeSnapshot(nodes, edges), viewport }
  }

  const flushSave = async () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await promotionPromise

    const { canvasId } = get()
    if (!canvasId) return

    try {
      await fetch(`/api/canvas/${canvasId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeContent()),
      })
    } catch (error) {
      console.error('canvas_save_failed', error)
    }
  }

  const scheduleSave = () => {
    if (!get().canvasId) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void flushSave()
    }, SAVE_DEBOUNCE_MS)
  }

  const ensurePromoted = () => {
    if (get().canvasId || promotionPromise) return

    promotionPromise = (async () => {
      try {
        const response = await fetch('/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serializeContent()),
        })
        if (!response.ok) throw new Error('promotion failed')

        const canvas = (await response.json()) as CanvasFile
        set((state) => ({
          canvasId: canvas.id,
          canvasList: [
            { id: canvas.id, name: canvas.name, updatedAt: canvas.updatedAt },
            ...state.canvasList,
          ],
        }))
        scheduleSave()
      } catch (error) {
        console.error('canvas_promotion_failed', error)
      } finally {
        promotionPromise = null
      }
    })()
  }

  const resetToDraft = () => {
    isDragging = false
    set({
      nodes: [],
      edges: [],
      canvasId: null,
      canvasName: defaultCanvasName(),
      viewport: DEFAULT_VIEWPORT,
      clipboard: null,
      ...EMPTY_HISTORY,
    })
  }

  const patchTextNode = (
    id: string,
    patch: Partial<Omit<TextVersion, 'id'>>,
  ) => {
    pushHistory()
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.type === 'text' && node.id === id
          ? withData(node, patchCurrentVersion(node.data, patch))
          : node,
      ),
    }))
    scheduleSave()
  }

  const insertSubgraph = (subgraph: Subgraph) => {
    pushHistory()
    set((state) => {
      const nodes = [
        ...state.nodes.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
        ...subgraph.nodes,
      ]
      const nodeIds = new Set(nodes.map((node) => node.id))
      const edges = [
        ...state.edges,
        ...subgraph.edges.filter(
          (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
        ),
      ]
      return { nodes, edges }
    })
    ensurePromoted()
    scheduleSave()
  }

  return {
    nodes: [],
    edges: [],
    canvasId: null,
    canvasName: defaultCanvasName(),
    viewport: DEFAULT_VIEWPORT,
    canvasList: [],
    clipboard: null,
    ...EMPTY_HISTORY,

    initialize: async () => {
        await Promise.all([
          get().fetchCanvasList(),
          settingsStore.getState().loadSettings(),
        ])
    },

    fetchCanvasList: async () => {
      try {
        const response = await fetch('/api/canvas')
        if (!response.ok) throw new Error('fetch failed')

        const { canvases } = (await response.json()) as { canvases: CanvasMeta[] }
        set({ canvasList: canvases })
      } catch (error) {
        console.error('canvas_list_failed', error)
      }
    },

    newCanvas: async () => {
      await flushSave()
      resetToDraft()
    },

    loadCanvas: async (id) => {
      await flushSave()

      try {
        const response = await fetch(`/api/canvas/${id}`)
        if (!response.ok) throw new Error('fetch failed')

        const canvas = (await response.json()) as CanvasFile
        const prepared = prepareLoadedCanvas(canvas.nodes, canvas.edges)
        isDragging = false
        set({
          nodes: prepared.nodes,
          edges: prepared.edges,
          viewport: canvas.viewport,
          canvasId: canvas.id,
          canvasName: canvas.name,
          clipboard: null,
          ...EMPTY_HISTORY,
        })
      } catch (error) {
        console.error('canvas_load_failed', id, error)
      }
    },

    renameCanvas: async (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return

      const existing = get().canvasList.find((meta) => meta.id === id)
      if (!existing || existing.name === trimmed) return

      set((state) => ({
        canvasList: state.canvasList.map((meta) =>
          meta.id === id ? { ...meta, name: trimmed } : meta,
        ),
        ...(state.canvasId === id ? { canvasName: trimmed } : {}),
      }))

      if (get().canvasId === id) {
        scheduleSave()
        return
      }

      try {
        const response = await fetch(`/api/canvas/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        })
        if (!response.ok) throw new Error('rename failed')
      } catch (error) {
        console.error('canvas_rename_failed', id, error)
      }
    },

    removeCanvas: async (id) => {
      try {
        const response = await fetch(`/api/canvas/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('delete failed')

        set((state) => ({
          canvasList: state.canvasList.filter((meta) => meta.id !== id),
        }))
        if (get().canvasId === id) resetToDraft()
      } catch (error) {
        console.error('canvas_delete_failed', id, error)
      }
    },

    setViewport: (viewport) => {
      set({ viewport })
      scheduleSave()
    },

    onNodesChange: (changes) => {
      const isDragChange = changes.some((change) => change.type === 'position')

      if (isDragChange) {
        const dragEnding = changes.some(
          (change) => change.type === 'position' && change.dragging === false,
        )
        if (!isDragging) {
          isDragging = true
          pushHistory()
        }
        if (dragEnding) isDragging = false
      } else if (changes.some((change) => change.type === 'remove')) {
        pushHistory()
      }

      set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }))
      scheduleSave()
    },

    onEdgesChange: (changes) => {
      const removals = changes.filter((change) => change.type === 'remove')
      if (removals.length > 0) {
        pushHistory()
      }

      set((state) => {
        const nextEdges = applyEdgeChanges(changes, state.edges)
        let nodes = state.nodes

        for (const change of removals) {
          const edge = state.edges.find((candidate) => candidate.id === change.id)
          if (!edge) continue

          const target = state.nodes.find((node) => node.id === edge.target)
          if (!isTextNode(target)) continue

          const sourceLabel = state.nodes.find(
            (node) => node.id === edge.source,
          )?.data.label
          if (!sourceLabel) continue

          nodes = nodes.map((node) =>
            node.id === target.id && isTextNode(node)
              ? withData(
                  node,
                  stripDisconnectedMentions(node.data, sourceLabel, (versionId) =>
                    nextEdges.some(
                      (candidate) =>
                        candidate.source === edge.source &&
                        candidate.target === edge.target &&
                        candidate.data?.versionId === versionId,
                    ),
                  ),
                )
              : node,
          )
        }

        return { nodes, edges: nextEdges }
      })
      scheduleSave()
    },

    onConnect: (connection) => {
      pushHistory()
      set((state) => {
        const edge: CanvasEdge = { ...connection, id: newId() }
        return {
          edges: [
            ...state.edges,
            { ...edge, data: { versionId: edgeVersionId(edge, state.nodes) } },
          ],
        }
      })
      scheduleSave()
    },

    addTextNode: (position, data) => {
      pushHistory()
      const versionId = newId()
      const defaults: TextNodeData = {
        label: 'Text',
        versions: [{ id: versionId, prompt: '' }],
        currentVersionId: versionId,
      }
      set((state) => ({
        nodes: [
          ...state.nodes,
          { id: newId(), type: 'text', position, data: { ...defaults, ...data } },
        ],
      }))
      ensurePromoted()
    },

    addDroppedImages: (files, position) => {
      pushHistory()
      set((state) => ({
        nodes: [
          ...state.nodes,
          ...files.map((file, index) => ({
            id: newId(),
            type: 'image' as const,
            position: { x: position.x + index * 40, y: position.y + index * 40 },
            data: { label: file.name, imageUrl: file.url },
          })),
        ],
      }))
      ensurePromoted()
    },

    connectMention: (sourceId, targetId) => {
      const target = findTextNode(get().nodes, targetId)
      if (!target) return

      const versionId = currentVersion(target.data).id
      const exists = get().edges.some(
        (edge) =>
          edge.source === sourceId &&
          edge.target === targetId &&
          edge.data?.versionId === versionId,
      )
      if (exists) return

      pushHistory()
      set((state) => ({
        edges: [
          ...state.edges,
          { id: newId(), source: sourceId, target: targetId, data: { versionId } },
        ],
      }))
      scheduleSave()
    },

    renameNode: (id, nextLabel) => {
      const oldLabel = get().nodes.find((node) => node.id === id)?.data.label
      if (!oldLabel || oldLabel === nextLabel) return

      pushHistory()
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id === id) {
            return withData(node, { ...node.data, label: nextLabel })
          }
          if (isTextNode(node) && anyVersionCites(node.data, oldLabel)) {
            return withData(node, {
              ...node.data,
              versions: node.data.versions.map((version) => ({
                ...version,
                prompt: renameMention(version.prompt, oldLabel, nextLabel),
              })),
            })
          }
          return node
        }),
      }))
      scheduleSave()
    },

    updateTextContent: (id, content) => {
      const node = findTextNode(get().nodes, id)
      if (!node) return

      const previousPrompt = currentVersion(node.data).prompt
      if (previousPrompt === content) return

      const { nodes: currentNodes, edges: currentEdges } = get()
      const nextData = patchCurrentVersion(node.data, { prompt: content })
      const versionId = nextData.currentVersionId
      const others = currentNodes.filter((candidate) => candidate.id !== id)

      const staleSourceIds = new Set(
        others
          .filter((candidate) => citesLabel(previousPrompt, candidate.data.label))
          .filter((candidate) => !anyVersionCites(nextData, candidate.data.label))
          .filter((candidate) =>
            currentEdges.some(
              (edge) => edge.source === candidate.id && edge.target === id,
            ),
          )
          .map((candidate) => candidate.id),
      )

      const addedEdges: CanvasEdge[] = []
      for (const candidate of others) {
        const candidateLabel = candidate.data.label
        if (citesLabel(previousPrompt, candidateLabel)) continue
        if (!citesLabel(content, candidateLabel)) continue
        if (
          others.find((other) => other.data.label === candidateLabel) !== candidate
        ) {
          continue
        }
        const alreadyConnected = currentEdges.some(
          (edge) =>
            edge.source === candidate.id &&
            edge.target === id &&
            edge.data?.versionId === versionId,
        )
        if (alreadyConnected) continue
        addedEdges.push({
          id: newId(),
          source: candidate.id,
          target: id,
          data: { versionId },
        })
      }

      pushHistory()
      set((state) => ({
        nodes: state.nodes.map((candidate) =>
          candidate.id === id && isTextNode(candidate)
            ? withData(candidate, nextData)
            : candidate,
        ),
        edges: [
          ...state.edges.filter(
            (edge) => !(edge.target === id && staleSourceIds.has(edge.source)),
          ),
          ...addedEdges,
        ],
      }))
      scheduleSave()
    },

    selectModel: (id, modelId) => {
      const node = findTextNode(get().nodes, id)
      if (!node) return
      if (currentVersion(node.data).modelId === modelId) return
      patchTextNode(id, { modelId, paramValues: {} })
    },

    setParam: (id, name, value) => {
      const node = findTextNode(get().nodes, id)
      if (!node) return

      const existing = currentVersion(node.data).paramValues ?? {}
      if (value === null && !(name in existing)) return
      if (value !== null && existing[name] === value) return

      const paramValues = { ...existing }
      if (value === null) {
        delete paramValues[name]
      } else {
        paramValues[name] = value
      }
      patchTextNode(id, { paramValues })
    },

    createVersion: (id) => {
      const node = findTextNode(get().nodes, id)
      if (!node) return

      const sourceVersionId = currentVersion(node.data).id
      const { data, version } = appendVersion(node.data)

      pushHistory()
      set((state) => ({
        nodes: state.nodes.map((candidate) =>
          candidate.id === id && isTextNode(candidate)
            ? withData(candidate, data)
            : candidate,
        ),
        edges: [
          ...state.edges,
          ...state.edges
            .filter(
              (edge) =>
                edge.target === id && edge.data?.versionId === sourceVersionId,
            )
            .map((edge) => ({
              ...edge,
              id: newId(),
              selected: false,
              data: { ...edge.data, versionId: version.id },
            })),
        ],
      }))
      scheduleSave()
    },

    createVersionForSelection: () => {
      const selected = get().nodes.filter(
        (node) => node.selected && isTextNode(node),
      )
      for (const node of selected) {
        get().createVersion(node.id)
      }
    },

    navigateVersion: (id, direction) => {
      const node = findTextNode(get().nodes, id)
      if (!node) return

      const index = node.data.versions.findIndex(
        (version) => version.id === node.data.currentVersionId,
      )
      const next = node.data.versions[index + direction]
      if (!next) return

      set((state) => ({
        nodes: state.nodes.map((candidate) =>
          candidate.id === id && isTextNode(candidate)
            ? withData(candidate, navigateToVersion(candidate.data, next.id))
            : candidate,
        ),
      }))
      scheduleSave()
    },

    generateFromTextNode: async (id, input) => {
      const source = findTextNode(get().nodes, id)
      if (!source) return

      const startedCanvasId = get().canvasId
      const isCurrentCanvas = () => get().canvasId === startedCanvasId
      const artifactExists = (artifactId: string) =>
        get().nodes.some((node) => node.id === artifactId)

      const { prompt, model, maxReferences } = input
      const version = currentVersion(source.data)
      const versionId = version.id
      const { nodes, edges } = get()

      const inputNodes = versionInputNodes(source, edges, nodes)

      const images = inputNodes
        .filter((node): node is CanvasImageNode => node.type === 'image')
        .map((node) => ({ label: node.data.label, imageUrl: node.data.imageUrl }))
      const texts = inputNodes
        .filter((node): node is CanvasTextNode => node.type === 'text')
        .map((node) => ({
          label: node.data.label,
          content: currentVersion(node.data).prompt,
        }))

      const width = source.measured?.width ?? FALLBACK_NODE_WIDTH
      const position = {
        x: source.position.x + width + ARTIFACT_GAP,
        y: source.position.y,
      }

      const outputId = newId()
      const edgeId = newId()

      pushHistory()
      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            id: outputId,
            type: 'image',
            position,
            data: { label: model.name, imageUrl: '', status: 'generating' },
          },
        ],
        edges: [
          ...state.edges,
          {
            id: edgeId,
            source: id,
            target: outputId,
            animated: true,
            data: { versionId },
          },
        ],
      }))
      scheduleSave()

      try {
        const startedAt = performance.now()
        const result = await generateImage({
          model: model.id,
          prompt,
          params: version.paramValues,
          images,
          texts,
          maxReferences,
        })
        const durationMs = Math.round(performance.now() - startedAt)

        if (result.images.length === 0) {
          throw new Error('No image returned')
        }

        if (!isCurrentCanvas() || !artifactExists(outputId)) return

        const extraIds = result.images.slice(1).map(() => newId())

        pushHistory()
        set((state) => ({
          nodes: [
            ...state.nodes.filter((node) => node.id !== outputId),
            ...result.images.map((image, index) => ({
              id: index === 0 ? outputId : extraIds[index - 1],
              type: 'image' as const,
              position: {
                x: position.x,
                y: position.y + index * ARTIFACT_STACK_GAP,
              },
              data: {
                label: model.name,
                imageUrl: image.url,
                status: 'ready' as const,
                cost: result.cost,
                durationMs,
              },
            })),
          ],
          edges: [
            ...state.edges.map((edge) =>
              edge.id === edgeId ? { ...edge, animated: false } : edge,
            ),
            ...extraIds.map((targetId) => ({
              id: newId(),
              source: id,
              target: targetId,
              data: { versionId },
            })),
          ],
        }))
        scheduleSave()

        const existingLabels = get().nodes.map((node) => node.data.label)
        void nameGeneration(prompt, existingLabels).then((name) => {
          if (!name || !isCurrentCanvas() || !artifactExists(outputId)) return
          const artifactIds = new Set([outputId, ...extraIds])
          pushHistory()
          set((state) => ({
            nodes: state.nodes.map((node) =>
              node.type === 'image' && artifactIds.has(node.id)
                ? withData(node, { ...node.data, label: name })
                : node,
            ),
          }))
          scheduleSave()
        })
      } catch (error) {
        if (!isCurrentCanvas() || !artifactExists(outputId)) return

        pushHistory()
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === outputId
              ? {
                  id: node.id,
                  type: 'error' as const,
                  position: node.position,
                  selected: node.selected,
                  data: {
                    label: 'Generation failed',
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Image generation failed',
                  },
                }
              : node,
          ),
          edges: state.edges.map((edge) =>
            edge.id === edgeId ? { ...edge, animated: false } : edge,
          ),
        }))
        scheduleSave()
      }
    },

    copySelection: () => {
      const selection = extractSelection(get().nodes, get().edges)
      if (!selection) return
      set({ clipboard: selection })
      navigator.clipboard
        .writeText(INTERNAL_CLIPBOARD_MARKER)
        .catch(() => undefined)
    },

    pasteClipboard: () => {
      const { clipboard } = get()
      if (!clipboard) return
      insertSubgraph(cloneSubgraph(clipboard, PASTE_OFFSET, get().nodes))
    },

    duplicateSelection: () => {
      const selection = extractSelection(get().nodes, get().edges)
      if (!selection) return
      insertSubgraph(cloneSubgraph(selection, PASTE_OFFSET, get().nodes))
    },

    undo: () => {
      const { nodes, edges, past, future } = get()
      const result = applyUndo({ past, future }, takeSnapshot(nodes, edges))
      if (!result) return

      isDragging = false
      set({ nodes: result.restored.nodes, edges: result.restored.edges, ...result.stacks })
      scheduleSave()
    },

    redo: () => {
      const { nodes, edges, past, future } = get()
      const result = applyRedo({ past, future }, takeSnapshot(nodes, edges))
      if (!result) return

      isDragging = false
      set({ nodes: result.restored.nodes, edges: result.restored.edges, ...result.stacks })
      scheduleSave()
    },
  }
})

export function useCanvasStore<T>(selector: (state: CanvasStoreState) => T): T {
  return useStore(canvasStore, selector)
}