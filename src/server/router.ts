import { guard } from './guard'
import * as agentCommand from './routes/agent/command/route'
import * as agentCommands from './routes/agent/commands/route'
import * as agentCommandByName from './routes/agent/commands/[name]/route'
import * as agentReply from './routes/agent/reply/route'
import * as agentStream from './routes/agent/stream/route'
import * as canvasList from './routes/canvas/route'
import * as canvasById from './routes/canvas/[id]/route'
import * as generate from './routes/generate/route'
import * as imageModels from './routes/image-models/route'
import * as imageFile from './routes/images/[file]/route'
import * as imageUpload from './routes/images/route'
import * as name from './routes/name/route'
import * as settings from './routes/settings/route'
import * as validateKey from './routes/settings/validate-key/route'

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Response | Promise<Response>
type RouteModule = Partial<Record<string, Handler>>

const table: [string, unknown][] = [
  ['/api/agent/command', agentCommand],
  ['/api/agent/commands', agentCommands],
  ['/api/agent/commands/:name', agentCommandByName],
  ['/api/agent/reply', agentReply],
  ['/api/agent/stream', agentStream],
  ['/api/canvas', canvasList],
  ['/api/canvas/:id', canvasById],
  ['/api/generate', generate],
  ['/api/image-models', imageModels],
  ['/api/images', imageUpload],
  ['/api/images/:file', imageFile],
  ['/api/name', name],
  ['/api/settings', settings],
  ['/api/settings/validate-key', validateKey],
]

const compiled = table.map(([pattern, mod]) => ({
  regex: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
  mod: mod as RouteModule,
}))

export async function handle(request: Request): Promise<Response> {
  const refused = guard(request)
  if (refused) return refused

  const { pathname } = new URL(request.url)
  for (const { regex, mod } of compiled) {
    const match = regex.exec(pathname)
    if (!match) continue
    const handler = mod[request.method]
    if (!handler) return new Response(null, { status: 405 })
    return handler(request, { params: Promise.resolve(match.groups ?? {}) })
  }
  return Response.json({ error: 'Not found' }, { status: 404 })
}
