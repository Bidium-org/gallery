import { defineConfig } from 'vite'

import { galleryAlias } from './vite.shared.ts'

// Bundles `electron/main.ts` and, once packaged, the router with its routes (`@` alias).
// Forge adds the entry, the CommonJS output and the Node externals.
export default defineConfig({
  resolve: { alias: galleryAlias },
})
