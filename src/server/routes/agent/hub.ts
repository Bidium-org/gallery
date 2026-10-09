// Agent relay state shared by the three agent routes (stream, command, reply).
// Kept on `globalThis`: under `vite dev`, editing a server module re-evaluates it, and a module-level
// state would then start empty while the open SSE stream still belongs to the previous instance.
export type Reply = { ok: boolean; result?: unknown; error?: string }

export type Outcome =
  | { kind: 'reply'; reply: Reply }
  | { kind: 'no_renderer' }
  | { kind: 'timeout' }
  | { kind: 'disconnected' }

type Client = { id: string; send: (event: string, data: unknown) => void }
type Pending = { clientId: string; resolve: (outcome: Outcome) => void; timer: ReturnType<typeof setTimeout> }
type Hub = { clients: Map<string, Client>; pending: Map<string, Pending>; seq: number }

const globals = globalThis as { __galleryAgentHub?: Hub }
const hub = (globals.__galleryAgentHub ??= { clients: new Map(), pending: new Map(), seq: 0 })

export function addClient(send: Client['send']): string {
  const id = `r${++hub.seq}`
  hub.clients.set(id, { id, send })
  return id
}

export function removeClient(id: string): void {
  hub.clients.delete(id)
  for (const [commandId, pending] of hub.pending) {
    if (pending.clientId !== id) continue
    clearTimeout(pending.timer)
    hub.pending.delete(commandId)
    pending.resolve({ kind: 'disconnected' })
  }
}

// A command targets the last connected renderer.
export function dispatch(name: string, args: unknown, timeoutMs: number): Promise<Outcome> {
  const target = [...hub.clients.values()].at(-1)
  if (!target) return Promise.resolve({ kind: 'no_renderer' })

  const id = `c${++hub.seq}`
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      hub.pending.delete(id)
      resolve({ kind: 'timeout' })
    }, timeoutMs)
    hub.pending.set(id, { clientId: target.id, resolve, timer })
    target.send('command', { id, name, args })
  })
}

// False when the id is unknown: a late reply, after the timeout or the disconnection.
export function reply(id: string, value: Reply): boolean {
  const pending = hub.pending.get(id)
  if (!pending) return false
  clearTimeout(pending.timer)
  hub.pending.delete(id)
  pending.resolve({ kind: 'reply', reply: value })
  return true
}
