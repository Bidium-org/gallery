import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

const HOLD_MS = 1500

type Counts = Record<string, number>

export type HighlightPhase = 'running' | 'held'

export type AgentHighlightState = {
  running: Counts
  held: Counts
  highlight: (ids: string[]) => () => void
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

export const agentHighlightStore = createStore<AgentHighlightState>()((set) => ({
  running: {},
  held: {},

  highlight: (ids) => {
    set((state) => ({ running: bump(state.running, ids, 1) }))
    return () => {
      set((state) => ({
        running: bump(state.running, ids, -1),
        held: bump(state.held, ids, 1),
      }))
      setTimeout(
        () => set((state) => ({ held: bump(state.held, ids, -1) })),
        HOLD_MS,
      )
    }
  },
}))

export function useAgentHighlight(id: string): HighlightPhase | null {
  return useStore(agentHighlightStore, (state) => {
    if (state.running[id]) return 'running'
    return state.held[id] ? 'held' : null
  })
}
