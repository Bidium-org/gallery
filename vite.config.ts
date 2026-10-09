import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function apiPlugin(): Plugin {
  return {
    name: 'gallery-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const { handle } = await server.ssrLoadModule('/src/server/router.ts')
        const { sendResponse, toRequest } = await server.ssrLoadModule('/src/server/node-adapter.ts')
        try {
          await sendResponse(res, await handle(await toRequest(req)))
        } catch (error) {
          console.error('api_request_failed', req.method, req.url, error)
          if (res.headersSent) return void res.end()
          await sendResponse(res, Response.json({ error: 'Internal error' }, { status: 500 }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
