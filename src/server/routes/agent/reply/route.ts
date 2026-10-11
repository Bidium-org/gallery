import { reply } from '@/server/agent/hub'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: unknown
    ok?: unknown
    result?: unknown
    error?: unknown
    message?: unknown
  } | null
  if (typeof body?.id !== 'string' || typeof body.ok !== 'boolean') {
    return Response.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }

  const error = typeof body.error === 'string' ? body.error : undefined
  const message = typeof body.message === 'string' ? body.message : undefined
  return reply(body.id, { ok: body.ok, result: body.result, error, message })
    ? Response.json({ ok: true })
    : Response.json({ ok: false, error: 'unknown_id' }, { status: 404 })
}
