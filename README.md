# Gallery

An infinite canvas for generating images with [OpenRouter](https://openrouter.ai) models. Text nodes hold prompts, image nodes hold results, edges say which node feeds which. Canvases, images and settings (including your API key) are stored as plain files in `data/` at the root of the repo.

## Development

Requires Node 22 or later.

```bash
npm install
npm run dev
```

Open the URL Vite prints. Add your OpenRouter API key in the settings dialog.

Other scripts: `npm run build` (production front build in `dist/`), `npm run lint`.

Stack: React, Vite, Tailwind 4, shadcn/ui, React Flow, zustand. The API routes live in `src/server/routes` and are served by a Vite plugin during `npm run dev`.
