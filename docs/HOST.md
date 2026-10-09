# Host

The local HTTP API: one router that turns a `Request` into a `Response`, plus the files on disk behind it. Who mounts it in each run mode: `docs/RUNTIME.md`. Map: `docs/OVERVIEW.md`.

```
src/server/
├── router.ts        → route table; guard first
├── guard.ts         → Host / Origin check
├── node-adapter.ts  → Node request/response ↔ Request/Response
├── host-file.ts     → writes `~/.gallery/host.json` (lifecycle: `docs/RUNTIME.md`)
└── routes/          → canvas/, images/, settings/ (the other routes belong to OpenRouter and Agent relay)
src/lib/database/
├── index.ts         → the only import point for routes
└── internals/       → canvas, images, settings, paths
```

## Owns

- Request pipeline: guard, route matching, method dispatch.
- Canvas, image and settings routes.
- Everything stored on disk: layout, write rules, the data directory rule.
- API key masking toward the front.

## Pipeline

1. `guard()` runs before anything else, for every `/api/*` request.
2. The path is matched against the `table` in `router.ts` (`:param` becomes a named capture).
3. The route module must export a function named after the HTTP method, else 405. Unknown path: 404 JSON.
4. `serveApi()` never throws: an error becomes a 500, or closes the stream if the response already started. Streaming bodies (SSE) are piped chunk by chunk.

The guard protects against browsers, not against processes: `Host` must be `127.0.0.1`, `localhost` or `[::1]` (anti DNS rebinding), and an `Origin`, when present, must equal the `Host`. A request with no `Origin` (curl, the future agent client) passes. There is no secret, on purpose.

## Disk

```
~/.gallery/
├── host.json            → where the running host is
└── data/
    ├── canvas/<uuid>.json   → one file per canvas
    ├── images/<uuid>.<ext>  → generated and uploaded images
    └── settings.json
```

- The data directory is the same in every run mode: `~/.gallery/data` (`src/lib/database/internals/paths.ts`). Folders are created on first write.
- A canvas file is the whole `CanvasFile` (name, React Flow nodes and edges, viewport, timestamps).
- `PATCH /api/canvas/:id` shallow-merges the top-level fields it receives, so `{ name }` alone is valid (renaming a canvas that is not open).
- Updates read, merge and write under an in-memory lock per canvas id (one lock for settings), through a temp file then `rename`. Creation is a plain write.
- `host.json` is written the same way; with two hosts running, the last writer wins.

## Images

- The filename is `<uuid>.<ext>`; the extension comes from the uploaded file name, else its MIME type. Reads accept only `^[\w-]+\.\w+$`, which blocks path traversal.
- A canvas references an image by the URL `/api/images/<file>` stored in its image nodes.
- Files are deleted only when their canvas is deleted (`deleteCanvas()` removes the files its image nodes point to). Deleting a node leaves its file on disk.

## Settings and API key

- `settings.json` holds the OpenRouter key in clear, the default model id and keybinding overrides. A missing file means defaults; stored keybindings are merged over the defaults on read.
- The key never leaves the host in clear: `GET` and `PATCH /api/settings` answer `sk-or-` + 30 `•` + the last four characters.
- A `PATCH` whose key contains `•` is treated as the masked value sent back, and the stored key is kept. The front compares against its own `maskApiKey()` in `src/components/settings/api-key.tsx`: both MUST produce the same string.
- The OpenRouter routes `generate`, `name` and `image-models` read the real key through `getSettings()` from `src/lib/database`.

## Gotchas

- Listing canvases (`GET /api/canvas`) parses every canvas file whole to extract name and date. Cost grows with the size of the data folder.
- `PATCH /api/canvas/:id` maps a missing canvas to 404 by matching `'not found'` in the error message. Keep that wording in `updateCanvas()`.
- Routes import `@/lib/database` (the index), never `internals/`. `host-file.ts` is the one exception, for `GALLERY_DIR`.
