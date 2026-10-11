import { cloneTextNodeData, isTextNode } from "@/lib/versioning";
import { newId } from "@/stores/canvas-init";
import type { CanvasEdge, CanvasNode } from "@/types/TCanvasNode";

export type Subgraph = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

function hasVersion(nodes: CanvasNode[], versionId: string): boolean {
  return nodes.some(
    (node) => isTextNode(node) && node.data.versions.some((version) => version.id === versionId),
  );
}

export function extractNodes(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  ids: ReadonlySet<string>,
): Subgraph {
  return {
    nodes: nodes.filter((node) => ids.has(node.id)),
    edges: edges.filter((edge) => ids.has(edge.source) || ids.has(edge.target)),
  };
}

export function extractSelection(nodes: CanvasNode[], edges: CanvasEdge[]): Subgraph | null {
  const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
  if (selectedIds.size === 0) return null;
  return extractNodes(nodes, edges, selectedIds);
}

export function cloneSubgraph(
  subgraph: Subgraph,
  offset: number,
  allNodes: CanvasNode[],
): Subgraph & { idMap: Map<string, string> } {
  const idMap = new Map(subgraph.nodes.map((node) => [node.id, newId()]));
  const versionIdMap = new Map<string, string>();

  const nodes = subgraph.nodes.map((node): CanvasNode => {
    const cloneBase = {
      id: idMap.get(node.id)!,
      position: {
        x: node.position.x + offset,
        y: node.position.y + offset,
      },
      selected: true,
    };

    if (!isTextNode(node)) return { ...node, ...cloneBase };

    const cloned = cloneTextNodeData(node.data);
    cloned.versionIdMap.forEach((clonedId, originalId) => versionIdMap.set(originalId, clonedId));
    return { ...node, ...cloneBase, data: cloned.data };
  });

  // An edge to a node outside the copy keeps its version. When that version is gone (a clipboard
  // pasted after the version's creation was undone), the original lost the edge too: not copied.
  const isGoneVersion = (versionId: string | undefined) =>
    versionId !== undefined && !versionIdMap.has(versionId) && !hasVersion(allNodes, versionId);

  const edges = subgraph.edges
    .filter((edge) => !isGoneVersion(edge.data?.versionId))
    .map((edge): CanvasEdge => {
      const versionId = edge.data?.versionId;
      return {
        ...edge,
        id: newId(),
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
        selected: false,
        animated: false,
        data: {
          ...edge.data,
          versionId: versionId ? (versionIdMap.get(versionId) ?? versionId) : undefined,
        },
      };
    });

  return { nodes, edges, idMap };
}
