// Renderer side of the agent relay: receives the commands pushed by the host over SSE,
// runs them, and answers with a POST. `EventSource` reconnects by itself when the host restarts.
import { CanvasError } from '@/lib/canvas-error'

type Args = Record<string, unknown>
type Command = (args: Args) => unknown

const commands: Record<string, Command> = {
  ping: () => 'pong',
}

// Dev only, to test timeouts and disconnections from the outside. Absent from the production build.
if (import.meta.env.DEV) {
  commands.sleep = ({ ms }) =>
    new Promise((resolve) => setTimeout(() => resolve(`slept ${Number(ms ?? 1000)} ms`), Number(ms ?? 1000)))
}

type Outcome = { ok: true; result: unknown } | { ok: false; error: string; message: string }

async function run(name: string, args: Args): Promise<Outcome> {
  if (!Object.hasOwn(commands, name)) return { ok: false, error: 'unknown_command', message: `Unknown command: ${name}` }
  try {
    return { ok: true, result: (await commands[name](args)) ?? null }
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
