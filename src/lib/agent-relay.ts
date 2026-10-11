// Renderer side of the agent relay: receives the commands pushed by the host over SSE,
// runs them, and answers with a POST. `EventSource` reconnects by itself when the host restarts.
import { executors } from '@/lib/agent-executors'
import { CanvasError } from '@/lib/canvas-error'

type Args = Record<string, unknown>

type Outcome = { ok: true; result: unknown } | { ok: false; error: string; message: string }

async function run(name: string, args: Args): Promise<Outcome> {
  if (!Object.hasOwn(executors, name)) return { ok: false, error: 'unknown_command', message: `Unknown command: ${name}` }
  try {
    return { ok: true, result: (await (executors[name as keyof typeof executors] as (args: Args) => unknown)(args)) ?? null }
  } catch (error) {
    if (error instanceof CanvasError) return { ok: false, error: error.code, message: error.message }
    return { ok: false, error: 'internal_error', message: error instanceof Error ? error.message : String(error) }
  }
}

export function startAgentRelay(): void {
  const source = new EventSource('/api/agent/stream')
  source.addEventListener('command', async (event) => {
    const { id, name, args } = JSON.parse((event as MessageEvent<string>).data) as {
      id: string
      name: string
      args?: Args
    }
    const outcome = await run(name, args ?? {})
    try {
      await fetch('/api/agent/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...outcome }),
      })
    } catch (error) {
      console.error('agent_reply_failed', error)
    }
  })
}
