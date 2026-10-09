import { defineConfig } from 'vite'

import { galleryAlias, galleryPlugins } from './vite.shared.ts'

export default defineConfig({
  plugins: galleryPlugins(),
  resolve: { alias: galleryAlias },
})
