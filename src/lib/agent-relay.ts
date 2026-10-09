// Renderer side of the agent relay: receives the commands pushed by the host over SSE,
// runs them, and answers with a POST. `EventSource` reconnects by itself when the host restarts.
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

async function run(name: string, args: Args): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  if (!Object.hasOwn(commands, name)) return { ok: false, error: `Unknown command: ${name}` }
  try {
    return { ok: true, result: await commands[name](args) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
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
