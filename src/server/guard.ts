// Guard of the shared router: the same defense in `vite dev` and in the Electron main.
// 1) Host: refuses a foreign name (DNS rebinding: evil.com resolving to 127.0.0.1).
// 2) Origin: when a browser sends one (always on POST/PATCH and cross-origin fetch), it must be
//    the server's own; any other page is refused, `null` included.
// A client with no Origin (curl, the future agent client) passes: it is not a browser.
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]'])

const refuse = (error: string) => Response.json({ ok: false, error }, { status: 403 })

export function guard(request: Request): Response | null {
  const host = request.headers.get('host') ?? ''
  if (!LOCAL_HOSTNAMES.has(host.replace(/:\d+$/, ''))) return refuse('bad_host')

  const origin = request.headers.get('origin')
  if (origin === null) return null

  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    // Origin: null
  }
  return originHost === host ? null : refuse('bad_origin')
}
