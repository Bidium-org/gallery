import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { VitePlugin } from '@electron-forge/plugin-vite'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.birium.gallery',
  },
  makers: [new MakerDMG({})],
  plugins: [
    new VitePlugin({
      build: [{ entry: 'electron/main.ts', config: 'vite.main.config.ts' }],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
  ],
}

export default config
