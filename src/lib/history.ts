import type { CanvasEdge, CanvasNode } from "@/types/TCanvasNode";

export const HISTORY_LIMIT = 20;

export type Snapshot = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type HistoryStacks = {
  past: Snapshot[];
  future: Snapshot[];
};

export const EMPTY_HISTORY: HistoryStacks = { past: [], future: [] };

export function takeSnapshot(nodes: CanvasNode[], edges: CanvasEdge[]): Snapshot {
  return {
    nodes: nodes.map(({ selected: _selected, ...node }) => node),
    edges: edges.map(({ selected: _selected, ...edge }) => edge),
  };
}

export function pushSnapshot(stacks: HistoryStacks, snapshot: Snapshot): HistoryStacks {
  return {
    past: [...stacks.past, snapshot].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function applyUndo(
  stacks: HistoryStacks,
  current: Snapshot,
): { stacks: HistoryStacks; restored: Snapshot } | null {
  if (stacks.past.length === 0) return null;
  return {
    stacks: {
      past: stacks.past.slice(0, -1),
      future: [...stacks.future, current],
    },
    restored: stacks.past[stacks.past.length - 1],
  };
}

export function applyRedo(
  stacks: HistoryStacks,
  current: Snapshot,
): { stacks: HistoryStacks; restored: Snapshot } | null {
  if (stacks.future.length === 0) return null;
  return {
    stacks: {
      past: [...stacks.past, current],
      future: stacks.future.slice(0, -1),
    },
    restored: stacks.future[stacks.future.length - 1],
  };
}
