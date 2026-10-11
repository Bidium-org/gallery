import { type CommandName, type RendererArgs } from "@/lib/agent/catalog";
import { CanvasError } from "@/lib/canvas-error";
import { getMaxReferences } from "@/lib/models";
import { currentVersion, isEdgeVisible, isTextNode, versionInputNodes } from "@/lib/versioning";
import { canvasStore } from "@/stores/canvas-store";
import { imageModelsStore } from "@/stores/image-models-store";
import type { CanvasEdge, CanvasNode } from "@/types/TCanvasNode";

type Executor<A, R> = {
  run: (args: A) => R;
  lights?: (args: A) => string[];
  creates?(result: Awaited<R>): string[];
};

type Executors = {
  [N in CommandName]: Executor<RendererArgs<N>, unknown>;
};

const executor = <N extends CommandName, R>(_name: N, entry: Executor<RendererArgs<N>, R>) => entry;

// Images leave as `imageUrl`: only the host knows the data folder, it turns the URL into a `path`.
function describeNode(node: CanvasNode, nodes: CanvasNode[], edges: CanvasEdge[]) {
  const { width, height } = node.measured ?? {};
  const common = {
    id: node.id,
    type: node.type,
    label: node.data.label,
    position: node.position,
    ...(width !== undefined && height !== undefined ? { size: { width, height } } : {}),
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
  const { canvasId, canvasName, viewport, nodes, edges } = canvasStore.getState();
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

export const executors = {
  ping: executor("ping", { run: () => "pong" }),

  sleep: executor("sleep", {
    run: ({ ms = 1000 }) =>
      new Promise((resolve) => setTimeout(() => resolve(`slept ${ms} ms`), ms)),
  }),

  get_canvas: executor("get_canvas", { run: readCanvas }),

  list_models: executor("list_models", { run: listModels }),

  list_canvases: executor("list_canvases", {
    run: () => canvasStore.getState().canvasList,
  }),

  open_canvas: executor("open_canvas", {
    run: ({ id }) => canvasStore.getState().loadCanvas(id),
  }),

  new_canvas: executor("new_canvas", {
    run: () => canvasStore.getState().newCanvas(),
  }),

  rename_canvas: executor("rename_canvas", {
    run: ({ id, name }) => canvasStore.getState().renameCanvas(id, name),
  }),

  // Same two gestures as the human: create the node, then type the prompt (one undo step).
  add_text_node: executor("add_text_node", {
    run: ({ position, prompt, label }) => {
      const store = canvasStore.getState();
      const id = store.addTextNode(position, label === undefined ? undefined : { label });
      if (prompt) store.updateTextContent(id, prompt);
      return { id };
    },
    creates: ({ id }) => [id],
  }),

  add_image: executor("add_image", {
    run: ({ files, position }) => {
      const ids = canvasStore.getState().addDroppedImages(files, position);
      return ids.map((id, index) => ({ id, imageUrl: files[index].url }));
    },
    creates: (images) => images.map(({ id }) => id),
  }),

  duplicate_nodes: executor("duplicate_nodes", {
    run: ({ ids }) => ({ copies: canvasStore.getState().duplicateNodes(ids) }),
    lights: ({ ids }) => ids,
    creates: ({ copies }) => Object.values(copies),
  }),

  move_node: executor("move_node", {
    run: ({ id, position }) => canvasStore.getState().moveNode(id, position),
    lights: ({ id }) => [id],
  }),

  delete_nodes: executor("delete_nodes", {
    run: ({ ids }) => canvasStore.getState().deleteNodes(ids),
    lights: ({ ids }) => ids,
  }),

  rename_node: executor("rename_node", {
    run: ({ id, label }) => canvasStore.getState().renameNode(id, label),
    lights: ({ id }) => [id],
  }),

  set_prompt: executor("set_prompt", {
    run: ({ id, prompt }) => canvasStore.getState().updateTextContent(id, prompt),
    lights: ({ id }) => [id],
  }),

  set_model: executor("set_model", {
    run: ({ id, modelId }) => canvasStore.getState().selectModel(id, modelId),
    lights: ({ id }) => [id],
  }),

  set_param: executor("set_param", {
    run: ({ id, name, value }) => canvasStore.getState().setParam(id, name, value),
    lights: ({ id }) => [id],
  }),

  create_version: executor("create_version", {
    run: ({ id }) => ({ versionId: canvasStore.getState().createVersion(id) }),
    lights: ({ id }) => [id],
  }),

  navigate_version: executor("navigate_version", {
    run: ({ id, direction }) => ({
      versionId: canvasStore.getState().navigateVersion(id, direction),
    }),
    lights: ({ id }) => [id],
  }),

  connect_nodes: executor("connect_nodes", {
    run: ({ source, target }) => ({
      edgeId: canvasStore.getState().connectNodes(source, target),
    }),
    lights: ({ source, target }) => [source, target],
  }),

  delete_edge: executor("delete_edge", {
    run: ({ id }) => canvasStore.getState().deleteEdges([id]),
  }),

  generate: executor("generate", {
    run: async ({ id }) => {
      const images = await canvasStore.getState().generateFromTextNode(id);
      return images.map(({ id: imageId, imageUrl }) => ({
        id: imageId,
        imageUrl,
      }));
    },
    lights: ({ id }) => [id],
    creates: (images) => images.map(({ id }) => id),
  }),
} satisfies Executors;
