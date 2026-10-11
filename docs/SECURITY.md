# Security

The threat model of the local host: who can talk to it, what stops them, what does not, and the open question of a local secret. The agent side: `docs/CLI.md`. Where the guard sits in the pipeline: `docs/HOST.md`.

## The setting

The host listens on localhost only and has no login. Whoever reaches the port can do what the UI does: read and write canvases, generate images with the user's OpenRouter credits, add images, and drive the canvas through the agent relay. The API key never leaves the host in clear: `GET` and `PATCH /api/settings` return it masked.

## What the guard stops: browsers

A website open in the user's browser can send requests to `localhost`. `src/server/guard.ts` refuses it with two checks:

- **`Host`** must be `127.0.0.1`, `localhost` or `[::1]`. This stops DNS rebinding: a hostile domain that resolves to `127.0.0.1` still sends its own name as `Host`.
- **`Origin`**, when present, must equal `Host`. A browser always sends one on `POST`/`PATCH` and on cross-origin requests, and a page cannot forge it. A foreign page, `null` included, gets 403.

So a malicious site cannot read the key, the canvases or drive the app while it is open. This is the attack behind CVE-2025-52882 (a local WebSocket of the Claude Code IDE extension with no origin check, readable by any website).

Left possible: an `<img>` tag, which carries no `Origin`, displaying one image. It needs an unguessable UUID file name and, in the DMG, a random port, and it cannot read the pixels.

## What it does not stop: other local programs

A request with no `Origin` (curl, the `gallery` script) passes: it is not a browser. A process can also send any `Origin`, including one equal to `Host`. The guard cannot tell it from the page.

- A process under the **user's own account** needs nothing from the host: it reads `host.json`, the canvases and the key (`~/.gallery/data/settings.json`, in clear) directly.
- **Another macOS account** on the same Mac, or a **sandboxed app** with network access, can reach the port without reading the user's files. General knowledge, not verified here. What they can do: drive the canvas, read canvases, spend OpenRouter credits, copy one of the user's images through `add_image`. They cannot get the key.

This is the posture of Ollama, which ships with no authentication on localhost (from memory, unverified).

## `add_image` reads the user's disk

The host reads the path it is given. Without a limit, anything reaching the port could make the host copy any of the user's files into the images folder and read it back through `GET /api/images/…`. So it accepts **image files only**, judged by extension, not by content: a non-image renamed `.png` passes. The other limits (size, order of checks) are in `docs/HOST.md`.

`POST /api/agent/connect` writes the skill into another tool's folder. Its content and destinations are fixed and no path comes from the request.

## Open question: a local secret

Decided against for v1 (option B). What is open is whether a secret is worth adding.

**Why the cheap token fails.** The first idea was a random per-start token in `host.json`, required only on requests without `Origin`. It does not work:

- The page's own same-origin `GET`s (images, the SSE stream) carry no `Origin` either, so the page would be blocked.
- A process can forge `Origin`, so requiring the token only without it protects nothing.

**Option A, a token on every request.** The page has to own it too: a cookie other programs do not have, set silently by the Electron main in the DMG; in `npm run dev`, a tokenized link printed in the terminal, and plain `localhost:5173` loads nothing. This is Jupyter's model (a per-start token required on every request, because server access means code execution; verified in its docs).

**Option B, no token** (chosen). The cheap version does not work and the working one is not cheap. The original motive, `add_image` reading any file, is closed by the image-only rule. What stays exposed is the list above.

**When A becomes right:** Gallery targets shared machines, or exposes a riskier command. Related: an irreversible command (canvas deletion, which removes its images from disk) needs human validation; that mechanism is designed when the first one enters.

Other tools, for comparison: Docker uses a Unix socket protected by file permissions, which does not fit a renderer that must speak HTTP in browser dev mode. 1Password verifies the code signature of its CLI: oversized for Gallery (both from memory, unverified).

## Limit of the proof

The guard was tested with faithful headers and with a real page on another local port. It was never tested from a real public website in a real browser.
