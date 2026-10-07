import {
  cloneTextNodeData,
  edgeVersionId,
  isTextNode,
} from '@/lib/versioning'
import { newId } from '@/stores/canvas-init'
import type { CanvasEdge, CanvasNode } from '@/types/TCanvasNode'

export type Subgraph = {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export function extractSelection(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Subgraph | null {
  const selectedNodes = nodes.filter((node) => node.selected)
  if (selectedNodes.length === 0) return null

  const selectedIds = new Set(selectedNodes.map((node) => node.id))
  const touchingEdges = edges.filter(
    (edge) => selectedIds.has(edge.source) || selectedIds.has(edge.target),
  )

  return { nodes: selectedNodes, edges: touchingEdges }
}

export function cloneSubgraph(
  subgraph: Subgraph,
  offset: number,
  allNodes: CanvasNode[],
): Subgraph {
  const idMap = new Map(subgraph.nodes.map((node) => [node.id, newId()]))
  const versionIdMap = new Map<string, string>()

  const nodes = subgraph.nodes.map((node): CanvasNode => {
    const cloneBase = {
      id: idMap.get(node.id)!,
      position: {
        x: node.position.x + offset,
        y: node.position.y + offset,
      },
      selected: true,
    }

    if (!isTextNode(node)) return { ...node, ...cloneBase }

    const cloned = cloneTextNodeData(node.data)
    cloned.versionIdMap.forEach((clonedId, originalId) =>
      versionIdMap.set(originalId, clonedId),
    )
    return { ...node, ...cloneBase, data: cloned.data }
  })

  const edges = subgraph.edges.map((edge): CanvasEdge => {
    const versionId = edge.data?.versionId
    const clonedVersionId = versionId
      ? (versionIdMap.get(versionId) ?? edgeVersionId(edge, allNodes))
      : undefined

    return {
      ...edge,
      id: newId(),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      selected: false,
      animated: false,
      data: { ...edge.data, versionId: clonedVersionId },
    }
  })

  return { nodes, edges }
}