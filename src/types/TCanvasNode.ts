import type { Edge, Node } from "@xyflow/react";

import type { ParamValue } from "@/types/TImageModel";

export type BaseNodeData = {
  label: string;
};

export type ImageNodeData = BaseNodeData & {
  imageUrl: string;
  status?: "generating" | "ready";
  cost?: number;
  durationMs?: number;
};

export type TextVersion = {
  id: string;
  prompt: string;
  modelId?: string;
  paramValues?: Record<string, ParamValue>;
};

export type TextNodeData = BaseNodeData & {
  versions: TextVersion[];
  currentVersionId: string;
};

export type ErrorNodeData = BaseNodeData & {
  error: string;
};

export type CanvasImageNode = Node<ImageNodeData, "image">;
export type CanvasTextNode = Node<TextNodeData, "text">;
export type CanvasErrorNode = Node<ErrorNodeData, "error">;

export type CanvasNode = CanvasImageNode | CanvasTextNode | CanvasErrorNode;
export type CanvasNodeData = CanvasNode["data"];

export type CanvasEdgeData = {
  versionId?: string;
};

export type CanvasEdge = Edge<CanvasEdgeData>;
