# Gallery

An infinite canvas for generating images with [OpenRouter](https://openrouter.ai) models. Text nodes hold prompts, image nodes hold results, edges say which node feeds which. Add your OpenRouter API key in the settings dialog.

## Install the app (macOS)

Open the `.dmg` and drag Gallery to Applications.

## Data

Canvases, images and settings (including your API key, in clear) are plain files in `~/.gallery/data`, in every mode. `~/.gallery/host.json` holds the URL and pid of the running app, for tools that talk to it. `~/.gallery/bin/gallery` is the command an agent calls to drive the canvas: a shell script that uses `jq`, rewritten at every start.

## Development

Requires Node 22.13 or later.

```bash
npm install
npm run dev            # in the browser, with the Vite dev server
npm run electron:dev   # in an Electron window, with hot reload
```

Build the app: `npm run electron:package` makes the `.app` in `out/`, `npm run electron:make` makes the `.dmg` in `out/make/`. Other scripts: `npm run build` (front build in `dist/`), `npm run lint`.

Stack: React, Vite, Tailwind 4, shadcn/ui, React Flow, zustand, Electron Forge. The API routes live in `src/server/routes`, served by a Vite plugin in dev and by the Electron main once packaged.

Set `HOME` to a throwaway folder for tests, so your real data stays untouched.

## License

[MIT](LICENSE)
