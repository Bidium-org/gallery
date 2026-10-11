import { addClient, removeClient } from '@/server/agent/hub'

const HEARTBEAT_MS = 15_000

export async function GET() {
  const encoder = new TextEncoder()
  let clientId = ''
  let heartbeat: ReturnType<typeof setInterval>

  const body = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Stream already closed: the client leaves the hub now instead of at the next cancel.
          clearInterval(heartbeat)
          removeClient(clientId)
        }
      }
      clientId = addClient(send)
      send('hello', { clientId })
      // A named event: a comment line would be invisible to `EventSource`.
      heartbeat = setInterval(() => send('ping', {}), HEARTBEAT_MS)
    },
    cancel() {
      clearInterval(heartbeat)
      removeClient(clientId)
    },
  })

  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
