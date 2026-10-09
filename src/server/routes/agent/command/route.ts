import { dispatch } from '../hub'

const DEFAULT_TIMEOUT_MS = 10_000

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    args?: unknown
    timeoutMs?: unknown
  } | null
  if (typeof body?.name !== 'string' || !body.name) {
    return Response.json({ ok: false, error: 'invalid_request', message: '`name` is required.' }, { status: 400 })
  }
  const timeoutMs =
    typeof body.timeoutMs === 'number' && body.timeoutMs > 0 ? body.timeoutMs : DEFAULT_TIMEOUT_MS

  const outcome = await dispatch(body.name, body.args ?? {}, timeoutMs)
  switch (outcome.kind) {
    case 'reply':
      return outcome.reply.ok
        ? Response.json({ ok: true, result: outcome.reply.result })
        : Response.json({ ok: false, error: outcome.reply.error }, { status: 422 })
    case 'no_renderer':
      return Response.json(
        { ok: false, error: 'no_renderer', message: 'No renderer connected: open the page with a canvas.' },
        { status: 409 },
      )
    case 'disconnected':
      return Response.json(
        { ok: false, error: 'renderer_disconnected', message: 'The renderer closed while the command was running.' },
        { status: 409 },
      )
    case 'timeout':
      return Response.json(
        { ok: false, error: 'timeout', message: `No reply from the renderer after ${timeoutMs} ms.` },
        { status: 504 },
      )
  }
}
