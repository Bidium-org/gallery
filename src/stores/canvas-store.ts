import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { CanvasError } from "@/lib/canvas-error";
import { ARTIFACT_GAP, ARTIFACT_STACK_GAP } from "@/lib/constants";
import { generateImage, type GenerationResult } from "@/lib/generation";
import {
  applyRedo,
  applyUndo,
  EMPTY_HISTORY,
  pushSnapshot,
  takeSnapshot,
  type HistoryStacks,
} from "@/lib/history";
import { getMaxReferences, resolveModel } from "@/lib/models";
import { nameGeneration } from "@/lib/naming";
import {
  cloneSubgraph,
  extractNodes,
  extractSelection,
  type Subgraph,
} from "@/lib/subgraph";
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
  removeEdges,
  renameMention,
  versionInputNodes,
} from "@/lib/versioning";
import { defaultCanvasName, newId } from "@/stores/canvas-init";
import type { CanvasFile, CanvasMeta } from "@/types/TCanvas";
import type {
  CanvasEdge,
  CanvasImageNode,
  CanvasNode,
  CanvasTextNode,
  TextNodeData,
  TextVersion,
} from "@/types/TCanvasNode";
import type { ParamValue } from "@/types/TImageModel";
import { imageModelsStore } from "@/stores/image-models-store";
import { settingsStore } from "@/stores/settings-store";

export type DroppedImage = {
  name: string;
  url: string;
};

export type GeneratedImage = {
  id: string;
  imageUrl: string;
};

export type CanvasStoreState = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  canvasId: string | null;
  canvasName: string;
  viewport: Viewport;
  canvasList: CanvasMeta[];
  past: HistoryStacks["past"];
  future: HistoryStacks["future"];
  clipboard: Subgraph | null;
  initialize: () => Promise<void>;
  fetchCanvasList: () => Promise<void>;
  flushSave: () => Promise<void>;
  newCanvas: () => Promise<void>;
  loadCanvas: (id: string) => Promise<void>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  removeCanvas: (id: string) => Promise<void>;
  setViewport: (viewport: Viewport) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addTextNode: (position: XYPosition, data?: Partial<TextNodeData>) => string;
  addDroppedImages: (files: DroppedImage[], position: XYPosition) => string[];
  moveNode: (id: string, position: XYPosition) => void;
  deleteNodes: (ids: string[]) => void;
  deleteEdges: (ids: string[]) => void;
  connectNodes: (sourceId: string, targetId: string) => string;
  renameNode: (id: string, nextLabel: string) => void;
  updateTextContent: (id: string, content: string) => void;
  selectModel: (id: string, modelId: string) => void;
  setParam: (id: string, name: string, value: ParamValue | null) => void;
  createVersion: (id: string) => string;
  createVersionForSelection: () => void;
  navigateVersion: (id: string, direction: -1 | 1) => string;
  generateFromTextNode: (id: string) => Promise<GeneratedImage[]>;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateNodes: (ids: string[]) => Record<string, string>;
  duplicateSelection: () => void;
  undo: () => void;
  redo: () => void;
};

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const FALLBACK_NODE_WIDTH = 300;
const SAVE_DEBOUNCE_MS = 800;
const PASTE_OFFSET = 40;
const INTERNAL_CLIPBOARD_MARKER = "image-canvas:nodes";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let promotionPromise: Promise<void> | null = null;
let historyCoalesced = false;
let isDragging = false;

const withData = <N extends CanvasNode>(node: N, data: N["data"]): N => ({
  ...node,
  data,
});

function requireNode(nodes: CanvasNode[], id: string): CanvasNode {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) throw new CanvasError("unknown_node", `No node with id "${id}"`);
  return node;
}

function requireTextNode(nodes: CanvasNode[], id: string): CanvasTextNode {
  const node = requireNode(nodes, id);
  if (!isTextNode(node)) {
    throw new CanvasError(
      "not_a_text_node",
      `Node "${id}" is an ${node.type} node, not a text node`,
    );
  }
  return node;
}

export const canvasStore = createStore<CanvasStoreState>()((set, get) => {
  const pushHistory = () => {
    if (historyCoalesced) return;
    historyCoalesced = true;
    queueMicrotask(() => {
      historyCoalesced = false;
    });

    const { nodes, edges, past } = get();
    set({ ...pushSnapshot({ past, future: [] }, takeSnapshot(nodes, edges)) });
  };

  const serializeContent = () => {
    const { nodes, edges, viewport, canvasName } = get();
    return { name: canvasName, ...takeSnapshot(nodes, edges), viewport };
  };

  const flushSave = async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await promotionPromise;

    const { canvasId } = get();
    if (!canvasId) return;

    try {
      await fetch(`/api/canvas/${canvasId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeContent()),
      });
    } catch (error) {
      console.error("canvas_save_failed", error);
    }
  };

  const requestCanvas = async (id: string, init?: RequestInit) => {
    let response: Response;
    try {
      response = await fetch(`/api/canvas/${id}`, init);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new CanvasError(
        "request_failed",
        `Request for canvas "${id}" failed: ${reason}`,
      );
    }
    if (response.status === 404) {
      throw new CanvasError("unknown_canvas", `No canvas with id "${id}"`);
    }
    if (!response.ok) {
      throw new CanvasError(
        "request_failed",
        `Request for canvas "${id}" failed with HTTP ${response.status}`,
      );
    }
    return response;
  };

  const scheduleSave = () => {
    if (!get().canvasId) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  };

  const ensurePromoted = () => {
    if (get().canvasId || promotionPromise) return;

    promotionPromise = (async () => {
      try {
        const response = await fetch("/api/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serializeContent()),
        });
        if (!response.ok) throw new Error("promotion failed");

        const canvas = (await response.json()) as CanvasFile;
        set((state) => ({
          canvasId: canvas.id,
          canvasList: [
            { id: canvas.id, name: canvas.name, updatedAt: canvas.updatedAt },
            ...state.canvasList,
          ],
        }));
        scheduleSave();
      } catch (error) {
        console.error("canvas_promotion_failed", error);
      } finally {
        promotionPromise = null;
      }
    })();
  };

  const resetToDraft = () => {
    isDragging = false;
    set({
      nodes: [],
      edges: [],
      canvasId: null,
      canvasName: defaultCanvasName(),
      viewport: DEFAULT_VIEWPORT,
      clipboard: null,
      ...EMPTY_HISTORY,
    });
  };

  const patchTextNode = (
    id: string,
    patch: Partial<Omit<TextVersion, "id">>,
  ) => {
    pushHistory();
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.type === "text" && node.id === id
          ? withData(node, patchCurrentVersion(node.data, patch))
          : node,
      ),
    }));
    scheduleSave();
  };

  const insertSubgraph = (subgraph: Subgraph) => {
    pushHistory();
    set((state) => {
      const nodes = [
        ...state.nodes.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
        ...subgraph.nodes,
      ];
      const nodeIds = new Set(nodes.map((node) => node.id));
      const edges = [
        ...state.edges,
        ...subgraph.edges.filter(
          (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
        ),
      ];
      return { nodes, edges };
    });
    ensurePromoted();
    scheduleSave();
  };

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
      ]);
    },

    fetchCanvasList: async () => {
      try {
        const response = await fetch("/api/canvas");
        if (!response.ok) throw new Error("fetch failed");

        const { canvases } = (await response.json()) as {
          canvases: CanvasMeta[];
        };
        set({ canvasList: canvases });
      } catch (error) {
        console.error("canvas_list_failed", error);
      }
    },

    flushSave,

    newCanvas: async () => {
      await flushSave();
      resetToDraft();
    },

    loadCanvas: async (id) => {
      await flushSave();

      const response = await requestCanvas(id);
      const canvas = (await response.json()) as CanvasFile;
      const prepared = prepareLoadedCanvas(canvas.nodes, canvas.edges);
      isDragging = false;
      set({
        nodes: prepared.nodes,
        edges: prepared.edges,
        viewport: canvas.viewport,
        canvasId: canvas.id,
        canvasName: canvas.name,
        clipboard: null,
        ...EMPTY_HISTORY,
      });
    },

    renameCanvas: async (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const existing = get().canvasList.find((meta) => meta.id === id);
      if (!existing) {
        throw new CanvasError("unknown_canvas", `No canvas with id "${id}"`);
      }
      if (existing.name === trimmed) return;

      set((state) => ({
        canvasList: state.canvasList.map((meta) =>
          meta.id === id ? { ...meta, name: trimmed } : meta,
        ),
        ...(state.canvasId === id ? { canvasName: trimmed } : {}),
      }));

      if (get().canvasId === id) {
        scheduleSave();
        return;
      }

      await requestCanvas(id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
    },

    removeCanvas: async (id) => {
      try {
        const response = await fetch(`/api/canvas/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("delete failed");

        set((state) => ({
          canvasList: state.canvasList.filter((meta) => meta.id !== id),
        }));
        if (get().canvasId === id) resetToDraft();
      } catch (error) {
        console.error("canvas_delete_failed", id, error);
      }
    },

    setViewport: (viewport) => {
      set({ viewport });
      scheduleSave();
    },

    onNodesChange: (changes) => {
      const removedIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);
      if (removedIds.length > 0) get().deleteNodes(removedIds);

      const otherChanges = changes.filter((change) => change.type !== "remove");
      if (otherChanges.length === 0) return;

      const dragChanges = otherChanges.filter(
        (change) => change.type === "position",
      );
      if (dragChanges.length > 0) {
        if (!isDragging) {
          isDragging = true;
          pushHistory();
        }
        if (dragChanges.some((change) => change.dragging === false)) {
          isDragging = false;
        }
      }

      set((state) => ({ nodes: applyNodeChanges(otherChanges, state.nodes) }));
      scheduleSave();
    },

    onEdgesChange: (changes) => {
      const removedIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);
      if (removedIds.length > 0) get().deleteEdges(removedIds);

      const otherChanges = changes.filter((change) => change.type !== "remove");
      if (otherChanges.length === 0) return;

      set((state) => ({ edges: applyEdgeChanges(otherChanges, state.edges) }));
      scheduleSave();
    },

    onConnect: (connection) => {
      get().connectNodes(connection.source, connection.target);
    },

    addTextNode: (position, data) => {
      pushHistory();
      const id = newId();
      const versionId = newId();
      const defaults: TextNodeData = {
        label: "Text",
        versions: [{ id: versionId, prompt: "" }],
        currentVersionId: versionId,
      };
      set((state) => ({
        nodes: [
          ...state.nodes,
          { id, type: "text", position, data: { ...defaults, ...data } },
        ],
      }));
      ensurePromoted();
      return id;
    },

    addDroppedImages: (files, position) => {
      pushHistory();
      const images = files.map((file, index) => ({
        id: newId(),
        type: "image" as const,
        position: { x: position.x + index * 40, y: position.y + index * 40 },
        data: { label: file.name, imageUrl: file.url },
      }));
      set((state) => ({ nodes: [...state.nodes, ...images] }));
      ensurePromoted();
      return images.map((image) => image.id);
    },

    moveNode: (id, position) => {
      const node = requireNode(get().nodes, id);
      if (node.position.x === position.x && node.position.y === position.y) {
        return;
      }

      pushHistory();
      set((state) => ({
        nodes: state.nodes.map((candidate) =>
          candidate.id === id ? { ...candidate, position } : candidate,
        ),
      }));
      scheduleSave();
    },

    deleteNodes: (ids) => {
      const { nodes } = get();
      for (const id of ids) requireNode(nodes, id);
      if (ids.length === 0) return;

      const nodeIds = new Set(ids);
      pushHistory();
      set((state) => {
        const touchingEdgeIds = new Set(
          state.edges
            .filter(
              (edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target),
            )
            .map((edge) => edge.id),
        );
        const remaining = removeEdges(state.nodes, state.edges, touchingEdgeIds);
        return {
          nodes: remaining.nodes.filter((node) => !nodeIds.has(node.id)),
          edges: remaining.edges,
        };
      });
      scheduleSave();
    },

    deleteEdges: (ids) => {
      const { edges } = get();
      const unknownId = ids.find((id) => !edges.some((edge) => edge.id === id));
      if (unknownId) {
        throw new CanvasError("unknown_edge", `No edge with id "${unknownId}"`);
      }
      if (ids.length === 0) return;

      pushHistory();
      set((state) => removeEdges(state.nodes, state.edges, new Set(ids)));
      scheduleSave();
    },

    connectNodes: (sourceId, targetId) => {
      const { nodes, edges } = get();
      requireNode(nodes, sourceId);
      requireNode(nodes, targetId);

      const edge: CanvasEdge = { id: newId(), source: sourceId, target: targetId };
      const versionId = edgeVersionId(edge, nodes);
      const existing = edges.find(
        (candidate) =>
          candidate.source === sourceId &&
          candidate.target === targetId &&
          candidate.data?.versionId === versionId,
      );
      if (existing) return existing.id;

      pushHistory();
      set((state) => ({
        edges: [...state.edges, { ...edge, data: { versionId } }],
      }));
      scheduleSave();
      return edge.id;
    },

    renameNode: (id, nextLabel) => {
      const oldLabel = requireNode(get().nodes, id).data.label;
      if (oldLabel === nextLabel) return;

      pushHistory();
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id === id) {
            return withData(node, { ...node.data, label: nextLabel });
          }
          if (isTextNode(node) && anyVersionCites(node.data, oldLabel)) {
            return withData(node, {
              ...node.data,
              versions: node.data.versions.map((version) => ({
                ...version,
                prompt: renameMention(version.prompt, oldLabel, nextLabel),
              })),
            });
          }
          return node;
        }),
      }));
      scheduleSave();
    },

    updateTextContent: (id, content) => {
      const node = requireTextNode(get().nodes, id);
      const previousPrompt = currentVersion(node.data).prompt;
      if (previousPrompt === content) return;

      const { nodes: currentNodes, edges: currentEdges } = get();
      const nextData = patchCurrentVersion(node.data, { prompt: content });
      const versionId = nextData.currentVersionId;
      const others = currentNodes.filter((candidate) => candidate.id !== id);

      const staleSourceIds = new Set(
        others
          .filter((candidate) =>
            citesLabel(previousPrompt, candidate.data.label),
          )
          .filter(
            (candidate) => !anyVersionCites(nextData, candidate.data.label),
          )
          .filter((candidate) =>
            currentEdges.some(
              (edge) => edge.source === candidate.id && edge.target === id,
            ),
          )
          .map((candidate) => candidate.id),
      );

      const addedEdges: CanvasEdge[] = [];
      for (const candidate of others) {
        const candidateLabel = candidate.data.label;
        if (citesLabel(previousPrompt, candidateLabel)) continue;
        if (!citesLabel(content, candidateLabel)) continue;
        if (
          others.find((other) => other.data.label === candidateLabel) !==
          candidate
        ) {
          continue;
        }
        const alreadyConnected = currentEdges.some(
          (edge) =>
            edge.source === candidate.id &&
            edge.target === id &&
            edge.data?.versionId === versionId,
        );
        if (alreadyConnected) continue;
        addedEdges.push({
          id: newId(),
          source: candidate.id,
          target: id,
          data: { versionId },
        });
      }

      pushHistory();
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
      }));
      scheduleSave();
    },

    selectModel: (id, modelId) => {
      const node = requireTextNode(get().nodes, id);
      // Generation falls back to the default model on an id it does not know, without a word.
      const { models } = imageModelsStore.getState();
      if (models.length > 0 && !models.some((model) => model.id === modelId)) {
        throw new CanvasError(
          "unknown_model",
          `No image model with id "${modelId}"`,
        );
      }
      if (currentVersion(node.data).modelId === modelId) return;
      patchTextNode(id, { modelId, paramValues: {} });
    },

    setParam: (id, name, value) => {
      const node = requireTextNode(get().nodes, id);
      const existing = currentVersion(node.data).paramValues ?? {};
      if (value === null && !(name in existing)) return;
      if (value !== null && existing[name] === value) return;

      const paramValues = { ...existing };
      if (value === null) {
        delete paramValues[name];
      } else {
        paramValues[name] = value;
      }
      patchTextNode(id, { paramValues });
    },

    createVersion: (id) => {
      const node = requireTextNode(get().nodes, id);
      const sourceVersionId = currentVersion(node.data).id;
      const { data, version } = appendVersion(node.data);

      pushHistory();
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
      }));
      scheduleSave();
      return version.id;
    },

    createVersionForSelection: () => {
      const selected = get().nodes.filter(
        (node) => node.selected && isTextNode(node),
      );
      for (const node of selected) {
        get().createVersion(node.id);
      }
    },

    navigateVersion: (id, direction) => {
      const node = requireTextNode(get().nodes, id);
      const { versions } = node.data;
      const index = versions.findIndex(
        (version) => version.id === node.data.currentVersionId,
      );
      const next = versions[index + direction];
      if (!next) {
        throw new CanvasError(
          "version_out_of_range",
          `Node "${id}" is on version ${index + 1} of ${versions.length}, it has no ${direction < 0 ? "previous" : "next"} version`,
        );
      }

      set((state) => ({
        nodes: state.nodes.map((candidate) =>
          candidate.id === id && isTextNode(candidate)
            ? withData(candidate, navigateToVersion(candidate.data, next.id))
            : candidate,
        ),
      }));
      scheduleSave();
      return next.id;
    },

    generateFromTextNode: async (id) => {
      const source = requireTextNode(get().nodes, id);
      const version = currentVersion(source.data);
      const model = resolveModel(
        imageModelsStore.getState().models,
        version.modelId,
        settingsStore.getState().settings?.defaultModelId,
      );
      if (!model) {
        throw new CanvasError(
          "no_model",
          "No image model available: the OpenRouter API key is missing or the model list is not loaded",
        );
      }

      const startedCanvasId = get().canvasId;
      const isCurrentCanvas = () => get().canvasId === startedCanvasId;
      const artifactExists = (artifactId: string) =>
        get().nodes.some((node) => node.id === artifactId);
      const discarded = () =>
        new CanvasError(
          "generation_discarded",
          "The canvas was switched or the generating node was deleted before the generation finished",
        );

      const { prompt } = version;
      const maxReferences = getMaxReferences(model);
      const versionId = version.id;
      const { nodes, edges } = get();

      const inputNodes = versionInputNodes(source, edges, nodes);

      const images = inputNodes
        .filter((node): node is CanvasImageNode => node.type === "image")
        .map((node) => ({
          label: node.data.label,
          imageUrl: node.data.imageUrl,
        }));
      const texts = inputNodes
        .filter((node): node is CanvasTextNode => node.type === "text")
        .map((node) => ({
          label: node.data.label,
          content: currentVersion(node.data).prompt,
        }));

      const width = source.measured?.width ?? FALLBACK_NODE_WIDTH;
      const position = {
        x: source.position.x + width + ARTIFACT_GAP,
        y: source.position.y,
      };

      const outputId = newId();
      const edgeId = newId();

      pushHistory();
      set((state) => ({
        nodes: [
          ...state.nodes,
          {
            id: outputId,
            type: "image",
            position,
            data: { label: model.name, imageUrl: "", status: "generating" },
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
      }));
      scheduleSave();

      let result: GenerationResult;
      let durationMs: number;
      try {
        const startedAt = performance.now();
        result = await generateImage({
          model: model.id,
          prompt,
          params: version.paramValues,
          images,
          texts,
          maxReferences,
        });
        durationMs = Math.round(performance.now() - startedAt);

        if (result.images.length === 0) {
          throw new Error("No image returned");
        }
      } catch (error) {
        if (!isCurrentCanvas() || !artifactExists(outputId)) throw discarded();

        const message =
          error instanceof Error ? error.message : "Image generation failed";
        pushHistory();
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === outputId
              ? {
                  id: node.id,
                  type: "error" as const,
                  position: node.position,
                  selected: node.selected,
                  data: { label: "Generation failed", error: message },
                }
              : node,
          ),
          edges: state.edges.map((edge) =>
            edge.id === edgeId ? { ...edge, animated: false } : edge,
          ),
        }));
        scheduleSave();
        throw new CanvasError("generation_failed", message);
      }

      if (!isCurrentCanvas() || !artifactExists(outputId)) throw discarded();

      const imageIds: string[] = [
        outputId,
        ...result.images.slice(1).map(() => newId()),
      ];

      pushHistory();
      set((state) => ({
        nodes: [
          ...state.nodes.filter((node) => node.id !== outputId),
          ...result.images.map((image, index) => ({
            id: imageIds[index],
            type: "image" as const,
            position: {
              x: position.x,
              y: position.y + index * ARTIFACT_STACK_GAP,
            },
            data: {
              label: model.name,
              imageUrl: image.url,
              status: "ready" as const,
              cost: result.cost,
              durationMs,
            },
          })),
        ],
        edges: [
          ...state.edges.map((edge) =>
            edge.id === edgeId ? { ...edge, animated: false } : edge,
          ),
          ...imageIds.slice(1).map((targetId) => ({
            id: newId(),
            source: id,
            target: targetId,
            data: { versionId },
          })),
        ],
      }));
      scheduleSave();

      const existingLabels = get().nodes.map((node) => node.data.label);
      void nameGeneration(prompt, existingLabels).then((name) => {
        if (!name || !isCurrentCanvas() || !artifactExists(outputId)) return;
        const artifactIds = new Set(imageIds);
        pushHistory();
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.type === "image" && artifactIds.has(node.id)
              ? withData(node, { ...node.data, label: name })
              : node,
          ),
        }));
        scheduleSave();
      });

      return imageIds.map((imageId, index) => ({
        id: imageId,
        imageUrl: result.images[index].url,
      }));
    },

    copySelection: () => {
      const selection = extractSelection(get().nodes, get().edges);
      if (!selection) return;
      set({ clipboard: selection });
      navigator.clipboard
        .writeText(INTERNAL_CLIPBOARD_MARKER)
        .catch(() => undefined);
    },

    pasteClipboard: () => {
      const { clipboard } = get();
      if (!clipboard) return;
      insertSubgraph(cloneSubgraph(clipboard, PASTE_OFFSET, get().nodes));
    },

    duplicateNodes: (ids) => {
      const { nodes, edges } = get();
      for (const id of ids) requireNode(nodes, id);
      if (ids.length === 0) return {};

      const clone = cloneSubgraph(
        extractNodes(nodes, edges, new Set(ids)),
        PASTE_OFFSET,
        nodes,
      );
      insertSubgraph(clone);
      return Object.fromEntries(clone.idMap);
    },

    duplicateSelection: () => {
      get().duplicateNodes(
        get()
          .nodes.filter((node) => node.selected)
          .map((node) => node.id),
      );
    },

    undo: () => {
      const { nodes, edges, past, future } = get();
      const result = applyUndo({ past, future }, takeSnapshot(nodes, edges));
      if (!result) return;

      isDragging = false;
      set({
        nodes: result.restored.nodes,
        edges: result.restored.edges,
        ...result.stacks,
      });
      scheduleSave();
    },

    redo: () => {
      const { nodes, edges, past, future } = get();
      const result = applyRedo({ past, future }, takeSnapshot(nodes, edges));
      if (!result) return;

      isDragging = false;
      set({
        nodes: result.restored.nodes,
        edges: result.restored.edges,
        ...result.stacks,
      });
      scheduleSave();
    },
  };
});

export function useCanvasStore<T>(selector: (state: CanvasStoreState) => T): T {
  return useStore(canvasStore, selector);
}
