import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

const HOLD_MS = 1500

type Counts = Record<string, number>

export type AgentHighlightState = {
  lit: Counts
  highlight: (ids: string[]) => () => void
  flash: (ids: string[]) => void
}

function bump(counts: Counts, ids: string[], delta: number): Counts {
  const next = { ...counts }
  for (const id of ids) {
    const count = (next[id] ?? 0) + delta
    if (count > 0) next[id] = count
    else delete next[id]
  }
  return next
}

export const agentHighlightStore = createStore<AgentHighlightState>()((set, get) => ({
  lit: {},

  highlight: (ids) => {
    set((state) => ({ lit: bump(state.lit, ids, 1) }))
    return () => {
      setTimeout(() => set((state) => ({ lit: bump(state.lit, ids, -1) })), HOLD_MS)
    }
  },

  flash: (ids) => get().highlight(ids)(),
}))

export function useAgentHighlight(id: string): boolean {
  return useStore(agentHighlightStore, (state) => Boolean(state.lit[id]))
}

export function useAgentLit(): Counts {
  return useStore(agentHighlightStore, (state) => state.lit)
}
