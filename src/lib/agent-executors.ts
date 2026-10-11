import { type CommandName, type RendererArgs } from "@/lib/agent-catalog";
import { CanvasError } from "@/lib/canvas-error";
import { getMaxReferences } from "@/lib/models";
import {
  currentVersion,
  isEdgeVisible,
  isTextNode,
  versionInputNodes,
} from "@/lib/versioning";
import { canvasStore } from "@/stores/canvas-store";
import { imageModelsStore } from "@/stores/image-models-store";
import type { CanvasEdge, CanvasNode } from "@/types/TCanvasNode";

type Executors = { [N in CommandName]: (args: RendererArgs<N>) => unknown };

// Images leave as `imageUrl`: only the host knows the data folder, it turns the URL into a `path`.
function describeNode(
  node: CanvasNode,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
) {
  const { width, height } = node.measured ?? {};
  const common = {
    id: node.id,
    type: node.type,
    label: node.data.label,
    position: node.position,
    ...(width !== undefined && height !== undefined
      ? { size: { width, height } }
      : {}),
  };
  if (isTextNode(node)) {
    const version = currentVersion(node.data);
    return {
      ...common,
      prompt: version.prompt,
      modelId: version.modelId ?? null,
      params: version.paramValues ?? {},
      versionCount: node.data.versions.length,
      currentVersionId: version.id,
      inputs: versionInputNodes(node, edges, nodes).map((input) => input.id),
    };
  }
  if (node.type === "image") {
    return {
      ...common,
      imageUrl: node.data.imageUrl,
      status: node.data.status ?? "ready",
    };
  }
  return { ...common, error: node.data.error };
}

function readCanvas() {
  const { canvasId, canvasName, viewport, nodes, edges } =
    canvasStore.getState();
  return {
    id: canvasId,
    name: canvasName,
    viewport,
    nodes: nodes.map((node) => describeNode(node, nodes, edges)),
    edges: edges
      .filter((edge) => isEdgeVisible(edge, nodes))
      .map(({ id, source, target }) => ({ id, source, target })),
  };
}

function listModels() {
  const { models } = imageModelsStore.getState();
  if (models.length === 0) {
    throw new CanvasError(
      "no_model",
      "No image model listed: the OpenRouter API key is missing in Settings, or the list is still loading (retry in a few seconds)",
    );
  }
  return models.map((model) => ({
    id: model.id,
    name: model.name,
    supportedParameters: model.supported_parameters,
    maxReferences: getMaxReferences(model),
  }));
}

// The store accepts any id and generation then falls back to the default model without a word.
function requireKnownModel(modelId: string) {
  const { models } = imageModelsStore.getState();
  if (models.length > 0 && !models.some((model) => model.id === modelId)) {
    throw new CanvasError(
      "unknown_model",
      `No image model with id "${modelId}": list the ids with list_models`,
    );
  }
}

export const executors: Executors = {
  ping: () => "pong",

  sleep: ({ ms = 1000 }) =>
    new Promise((resolve) => setTimeout(() => resolve(`slept ${ms} ms`), ms)),

  get_canvas: readCanvas,

  list_models: listModels,

  list_canvases: () => canvasStore.getState().canvasList,

  open_canvas: ({ id }) => canvasStore.getState().loadCanvas(id),

  new_canvas: () => canvasStore.getState().newCanvas(),

  rename_canvas: ({ id, name }) =>
    canvasStore.getState().renameCanvas(id, name),

  // Same two gestures as the human: create the node, then type the prompt (one undo step).
  add_text_node: ({ position, prompt, label }) => {
    const store = canvasStore.getState();
    const id = store.addTextNode(
      position,
      label === undefined ? undefined : { label },
    );
    if (prompt) store.updateTextContent(id, prompt);
    return { id };
  },

  add_image: ({ files, position }) => {
    const ids = canvasStore.getState().addDroppedImages(files, position);
    return ids.map((id, index) => ({ id, imageUrl: files[index].url }));
  },

  duplicate_nodes: ({ ids }) => ({
    copies: canvasStore.getState().duplicateNodes(ids),
  }),

  move_node: ({ id, position }) =>
    canvasStore.getState().moveNode(id, position),

  delete_nodes: ({ ids }) => canvasStore.getState().deleteNodes(ids),

  rename_node: ({ id, label }) => canvasStore.getState().renameNode(id, label),

  set_prompt: ({ id, prompt }) =>
    canvasStore.getState().updateTextContent(id, prompt),

  set_model: ({ id, modelId }) => {
    requireKnownModel(modelId);
    canvasStore.getState().selectModel(id, modelId);
  },

  set_param: ({ id, name, value }) =>
    canvasStore.getState().setParam(id, name, value),

  create_version: ({ id }) => ({
    versionId: canvasStore.getState().createVersion(id),
  }),

  navigate_version: ({ id, direction }) => ({
    versionId: canvasStore.getState().navigateVersion(id, direction),
  }),

  connect_nodes: ({ source, target }) => ({
    edgeId: canvasStore.getState().connectNodes(source, target),
  }),

  delete_edge: ({ id }) => canvasStore.getState().deleteEdges([id]),

  generate: async ({ id }) => {
    const images = await canvasStore.getState().generateFromTextNode(id);
    return images.map(({ id: imageId, imageUrl }) => ({
      id: imageId,
      imageUrl,
    }));
  },
};
