# Runtime

How Gallery starts, who hosts the API, and how it is built and packaged. Map and main flow: `docs/OVERVIEW.md`.

```
electron/main.ts          → app lifecycle, window, packaged host, quit flush
forge.config.ts           → packaging: asar, fuses, ad-hoc codesign, DMG
vite.shared.ts            → `gallery-api` plugin (dev host) + `@` alias
vite.config.ts            → `npm run dev`
vite.renderer.config.ts   → `electron:dev` renderer: same plugins as above
vite.main.config.ts       → Forge bundle of the main: alias only
```

## Owns

- The three run modes and which process hosts the router in each.
- `host.json` and `~/.gallery/bin/gallery` lifecycle: when they are written and removed, and what the `pid` means.
- Window setup and the quit sequence.
- Packaging and signing.

## One router, three run modes

The API is one function `(Request) → Response` (`src/server/router.ts`, see `docs/HOST.md`). Only the process that mounts it changes.

|                       | `npm run dev`        | `npm run electron:dev`          | Packaged `.app`                       |
| --------------------- | -------------------- | ------------------------------- | ------------------------------------- |
| Front served by       | Vite dev server      | Vite dev server (inside Forge)  | `serveStatic()` in `electron/main.ts` |
| API mounted by        | `gallery-api` plugin | `gallery-api` plugin            | `startHost()` in `electron/main.ts`   |
| Listens on            | `[::1]:5173` only    | `[::1]:5173` only               | `127.0.0.1`, random port              |
| Unknown path          | SPA fallback (200)   | SPA fallback (200)              | 404, only `/` and assets              |
| `host.json` `pid`     | Vite process         | Forge CLI process, not Electron | Electron main                         |
| `sleep` agent command | yes                  | yes                             | no                                    |

Whoever mounts the API also writes `host.json` and `bin/gallery`, through `writeHostFiles()` (`src/server/host-file.ts`).

The main tells the modes apart with `MAIN_WINDOW_VITE_DEV_SERVER_URL`: set (`electron:dev`) it just loads that URL, unset (packaged) it starts its own host first.

## Mounting

- Dev: `apiPlugin()` in `vite.shared.ts` has `apply: 'serve'`, so it exists only on the dev server. It lazy-loads the router through `ssrLoadModule`, so editing a server file reloads it without restarting Vite.
- Packaged: `startHost()` dynamically imports the router, so Forge bundles it as code-split chunks beside `main.cjs`. The renderer is built to `.vite/renderer/main_window` and read from the asar.
- Both go through `serveApi()` (`src/server/node-adapter.ts`), which converts Node requests to `Request`.

`vite.shared.ts` exists so `npm run dev` and `electron:dev` can never drift: both configs import the same plugins.

## `host.json`

`~/.gallery/host.json` (`{ url, pid, startedAt }`) tells a client where the running host is.

- Written when the host starts listening, removed on exit by the process that owns the `pid`.
- Always read `url` from it: dev servers listen on IPv6 only, so `127.0.0.1` is refused there, and the packaged port is random.
- Dev modes remove it synchronously on exit. The plugin forces `process.exit` on SIGINT/SIGTERM because Vite under Forge, and Forge on Ctrl-C, would not run async cleanup.
- Only the process whose `pid` the file carries removes it, so a host that quits never erases the file of another host still running.
- It is written through a temp file then `rename`, so a reader never sees half a file. With two hosts running (`npm run dev` and the DMG), the last one to start wins.
- A crash leaves it stale: a client treats a refused connection as "not running".

## `~/.gallery/bin/gallery`

The command an agent calls: a POSIX shell script (`src/server/gallery.sh`) that forwards a command name and its JSON arguments to the host and prints the answer. It needs `jq` and `curl`.

- `writeHostFiles()` writes it, right before `host.json`, so the three run modes cannot drift. Vite and the Forge main bundle the source as text (`?raw` import): nothing is read from the repo at runtime, which the packaged app could not do (fuse `OnlyLoadAppFromAsar`).
- It is written through a temp file then `rename`, never in place: `sh` reads a script while it runs, so a long call (a `generate`) would break if a restarting host overwrote the file under it. After a `rename` the running call keeps the old file. A failed write removes its temp file.
- It is never removed on exit: with the app closed it answers `host_not_running`.
- A write failure is logged (`cli_file_write_failed`) and `host.json` is still written: the app must start even when `~/.gallery` is not writable.
- The script is written once, when the host starts listening: in dev, restart the server after editing `src/server/gallery.sh`.
- Two hosts running: the last one to start wrote it, like `host.json`.

## Electron main

- The window loads the host URL. `contextIsolation` on, no preload, no IPC: the renderer talks to the host over HTTP like any browser tab.
- `backgroundThrottling: false`: a hidden window still answers agent commands.
- No application menu on purpose: the default one carries the Edit roles that route Cmd+C / Cmd+V to the page, which `src/hooks/use-canvas-paste.ts` relies on. Do not call `Menu.setApplicationMenu`.
- Quit (`before-quit`): run `window.__galleryFlushSave()` in the page (5 s cap, the autosave is debounced), remove `host.json`, then quit. Without it the last edit would be lost.

## Packaging

- `npm run electron:package` → `out/Gallery-darwin-arm64/Gallery.app`; `electron:make` → DMG in `out/make/`. macOS only (one maker).
- Fuses harden the binary (no `RunAsNode`, asar integrity, load only from asar). Flipping them breaks the signature and an unsigned arm64 binary does not run, so `postPackage` signs the whole bundle ad-hoc again. No notarization.

## Gotchas

- A packaged `.app` older than the last commit is silently stale: repackage before testing it.
- The Vite dev server watches `.vite/` and `out/`: packaging while `npm run dev` is open reloads the page.
- `npm run build` outputs `dist/` (front only, no API) and nothing serves it. It is not the Electron build.
- To test without touching real data, set `HOME` to a throwaway folder (data, `host.json` and `bin/gallery` all live under `HOME/.gallery`).
