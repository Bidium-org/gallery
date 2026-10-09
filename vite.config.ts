import type { AddressInfo } from 'node:net'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Address Vite really listens on (it may be `[::1]` only), as a URL a client can use as is.
function hostUrl({ address, family, port }: AddressInfo): string {
  if (address === '::' || address === '0.0.0.0') return `http://127.0.0.1:${port}`
  return `http://${family === 'IPv6' ? `[${address}]` : address}:${port}`
}

function apiPlugin(): Plugin {
  let removeHostFile: (() => Promise<void>) | undefined
  // Vite closes the server on SIGTERM but not on SIGINT (Ctrl-C), which would leave the file stale.
  const onSigint = async () => {
    await removeHostFile?.()
    process.exit(130)
  }

  return {
    name: 'gallery-api',
    apply: 'serve',
    configureServer(server) {
      process.once('SIGINT', onSigint)
      server.httpServer?.once('listening', async () => {
        // Loaded once here: `closeBundle` runs while the server shuts down, too late for `ssrLoadModule`.
        try {
          const hostFile = await server.ssrLoadModule('/src/server/host-file.ts')
          await hostFile.writeHostFile(hostUrl(server.httpServer!.address() as AddressInfo))
          removeHostFile = hostFile.removeHostFile
        } catch (error) {
          // Discovery is optional: the dev server must start even when `~/.gallery` is not writable.
          console.error('host_file_write_failed', error)
        }
      })
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
    async closeBundle() {
      process.off('SIGINT', onSigint)
      await removeHostFile?.()
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
