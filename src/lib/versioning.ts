import { newId } from '@/stores/canvas-init'
import type {
  CanvasEdge,
  CanvasNode,
  CanvasTextNode,
  TextNodeData,
  TextVersion,
} from '@/types/TCanvasNode'
import type { ParamValue } from '@/types/TImageModel'

export function isTextNode(
  node: CanvasNode | undefined,
): node is CanvasTextNode {
  return node?.type === 'text'
}

export function currentVersion(data: TextNodeData): TextVersion {
  return (
    data.versions.find((version) => version.id === data.currentVersionId) ??
    data.versions[0]
  )
}

export function patchCurrentVersion(
  data: TextNodeData,
  patch: Partial<Omit<TextVersion, 'id'>>,
): TextNodeData {
  return {
    ...data,
    versions: data.versions.map((version) =>
      version.id === data.currentVersionId ? { ...version, ...patch } : version,
    ),
  }
}

export function appendVersion(data: TextNodeData): {
  data: TextNodeData
  version: TextVersion
} {
  const source = currentVersion(data)
  const version: TextVersion = {
    id: newId(),
    prompt: source.prompt,
    modelId: source.modelId,
    paramValues: source.paramValues ? { ...source.paramValues } : undefined,
  }
  return {
    version,
    data: {
      ...data,
      versions: [...data.versions, version],
      currentVersionId: version.id,
    },
  }
}

export function navigateToVersion(
  data: TextNodeData,
  versionId: string,
): TextNodeData {
  if (!data.versions.some((version) => version.id === versionId)) return data
  return { ...data, currentVersionId: versionId }
}

export function edgeVersionId(
  edge: CanvasEdge,
  nodes: CanvasNode[],
): string | undefined {
  const target = nodes.find((node) => node.id === edge.target)
  if (isTextNode(target)) return target.data.currentVersionId
  const source = nodes.find((node) => node.id === edge.source)
  if (isTextNode(source)) return source.data.currentVersionId
  return undefined
}

export function isEdgeVisible(edge: CanvasEdge, nodes: CanvasNode[]): boolean {
  const versionId = edge.data?.versionId
  if (!versionId) return true
  const owner = [edge.target, edge.source]
    .map((id) => nodes.find((node) => node.id === id))
    .find(isTextNode)
  if (!owner) return true
  return owner.data.currentVersionId === versionId
}

export function versionInputNodes(
  textNode: CanvasTextNode,
  edges: CanvasEdge[],
  nodes: CanvasNode[],
): CanvasNode[] {
  const versionId = currentVersion(textNode.data).id
  return edges
    .filter(
      (edge) =>
        edge.target === textNode.id && edge.data?.versionId === versionId,
    )
    .map((edge) => nodes.find((node) => node.id === edge.source))
    .filter((node) => node !== undefined)
}

function mentionPattern(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`@${escaped}(?![\\w-])`, 'g')
}

export function citesLabel(prompt: string, label: string): boolean {
  return mentionPattern(label).test(prompt)
}

export function stripMention(prompt: string, label: string): string {
  return prompt.replace(mentionPattern(label), '')
}

export function renameMention(
  prompt: string,
  fromLabel: string,
  toLabel: string,
): string {
  return prompt.replace(mentionPattern(fromLabel), `@${toLabel}`)
}

export function anyVersionCites(data: TextNodeData, label: string): boolean {
  return data.versions.some((version) => citesLabel(version.prompt, label))
}

export function stripDisconnectedMentions(
  data: TextNodeData,
  label: string,
  hasEdge: (versionId: string) => boolean,
): TextNodeData {
  return {
    ...data,
    versions: data.versions.map((version) =>
      citesLabel(version.prompt, label) && !hasEdge(version.id)
        ? { ...version, prompt: stripMention(version.prompt, label) }
        : version,
    ),
  }
}

export function removeEdges(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  edgeIds: ReadonlySet<string>,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const remaining = edges.filter((edge) => !edgeIds.has(edge.id))
  let nextNodes = nodes

  for (const edge of edges.filter((candidate) => edgeIds.has(candidate.id))) {
    const target = nodes.find((node) => node.id === edge.target)
    if (!isTextNode(target)) continue

    const sourceLabel = nodes.find((node) => node.id === edge.source)?.data.label
    if (!sourceLabel) continue

    nextNodes = nextNodes.map((node) =>
      node.id === target.id && isTextNode(node)
        ? {
            ...node,
            data: stripDisconnectedMentions(node.data, sourceLabel, (versionId) =>
              remaining.some(
                (candidate) =>
                  candidate.source === edge.source &&
                  candidate.target === edge.target &&
                  candidate.data?.versionId === versionId,
              ),
            ),
          }
        : node,
    )
  }

  return { nodes: nextNodes, edges: remaining }
}

type LegacyTextNodeData = {
  label: string
  content: string
  modelId?: string
  paramValues?: Record<string, ParamValue>
}

function migrateTextNode(node: CanvasNode): CanvasNode {
  if (!isTextNode(node) || 'versions' in node.data) return node

  const legacy = node.data as unknown as LegacyTextNodeData
  const version: TextVersion = {
    id: newId(),
    prompt: legacy.content,
    modelId: legacy.modelId,
    paramValues: legacy.paramValues,
  }

  return {
    ...node,
    data: {
      label: legacy.label,
      versions: [version],
      currentVersionId: version.id,
    },
  }
}

export function prepareLoadedCanvas(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const migratedNodes = nodes.map((node): CanvasNode => {
    if (node.type === 'image' && node.data.status === 'generating') {
      return {
        id: node.id,
        type: 'error' as const,
        position: node.position,
        data: {
          label: 'Generation interrupted',
          error: 'This generation was interrupted by a reload',
        },
      }
    }
    return migrateTextNode(node)
  })

  const migratedEdges = edges.map((edge) => ({
    ...edge,
    animated: false,
    data: {
      ...edge.data,
      versionId: edge.data?.versionId ?? edgeVersionId(edge, migratedNodes),
    },
  }))

  return { nodes: migratedNodes, edges: migratedEdges }
}

export function cloneTextNodeData(data: TextNodeData): {
  data: TextNodeData
  versionIdMap: Map<string, string>
} {
  const versionIdMap = new Map(
    data.versions.map((version) => [version.id, newId()]),
  )

  return {
    versionIdMap,
    data: {
      ...data,
      versions: data.versions.map((version) => ({
        ...version,
        id: versionIdMap.get(version.id)!,
        paramValues: version.paramValues
          ? { ...version.paramValues }
          : undefined,
      })),
      currentVersionId: versionIdMap.get(data.currentVersionId)!,
    },
  }
}