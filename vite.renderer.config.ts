import { defineConfig } from "vite";

import { galleryAlias, galleryPlugins } from "./vite.shared.ts";

// Same plugins as `vite.config.ts`: `electron:dev` serves the API from the same `gallery-api` plugin.
export default defineConfig({
  plugins: galleryPlugins(),
  resolve: { alias: galleryAlias },
});
