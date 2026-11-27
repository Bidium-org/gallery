import { defineConfig } from "vite";

import { galleryAlias } from "./vite.shared.ts";

export default defineConfig({
  resolve: { alias: galleryAlias },
  ssr: { noExternal: true },
  build: {
    ssr: "mcp/server.ts",
    outDir: "mcp/dist/bundle/server",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    rollupOptions: {
      output: { format: "cjs", entryFileNames: "server.cjs" },
    },
  },
});
