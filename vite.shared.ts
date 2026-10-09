// Plugins and alias shared by `vite.config.ts` (`npm run dev`) and the Forge renderer config
// (`electron:dev`), so the two servers never drift.
import fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type PluginOption, type Plugin } from 'vite'

// Address Vite really listens on (it may be `[::1]` only), as a URL a client can use as is.
function hostUrl({ address, family, port }: AddressInfo): string {
  if (address === '::' || address === '0.0.0.0') return `http://127.0.0.1:${port}`
  return `http://${family === 'IPv6' ? `[${address}]` : address}:${port}`
}

function apiPlugin(): Plugin {
  let removeHostFile: (() => Promise<void>) | undefined
  let hostFilePath: string | undefined
  // Vite closes the server on SIGTERM in `npm run dev` but not on SIGINT (Ctrl-C), and under Forge on
  // neither: exit ourselves so `onExit` runs.
  const onSigint = () => process.exit(130)
  const onSigterm = () => process.exit(143)
  // Synchronous on purpose: `exit` handlers cannot await. Forge also exits the process on Ctrl-C
  // before an async cleanup could finish. Same rule as `removeHostFile`: only a file with our pid.
  const onExit = () => {
    if (!hostFilePath) return
    try {
      if (JSON.parse(fs.readFileSync(hostFilePath, 'utf-8')).pid === process.pid) fs.unlinkSync(hostFilePath)
    } catch {
      // Already gone or unreadable: nothing to clean.
    }
  }

  return {
    name: 'gallery-api',
    apply: 'serve',
    configureServer(server) {
      process.once('SIGINT', onSigint)
      process.once('SIGTERM', onSigterm)
      process.once('exit', onExit)
      server.httpServer?.once('listening', async () => {
        // Loaded once here: `closeBundle` runs while the server shuts down, too late for `ssrLoadModule`.
        try {
          const hostFile = await server.ssrLoadModule('/src/server/host-file.ts')
          await hostFile.writeHostFile(hostUrl(server.httpServer!.address() as AddressInfo))
          removeHostFile = hostFile.removeHostFile
          hostFilePath = hostFile.HOST_FILE
        } catch (error) {
          // Discovery is optional: the dev server must start even when `~/.gallery` is not writable.
          console.error('host_file_write_failed', error)
        }
      })
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const { handle } = await server.ssrLoadModule('/src/server/router.ts')
        const { serveApi } = await server.ssrLoadModule('/src/server/node-adapter.ts')
        await serveApi(handle, req, res)
      })
    },
    async closeBundle() {
      process.off('SIGINT', onSigint)
      process.off('SIGTERM', onSigterm)
      process.off('exit', onExit)
      await removeHostFile?.()
    },
  }
}

export const galleryPlugins = (): PluginOption[] => [react(), tailwindcss(), apiPlugin()]

export const galleryAlias = { '@': path.resolve(import.meta.dirname, 'src') }
