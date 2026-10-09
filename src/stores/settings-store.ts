import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { syncApiKeyToast } from '@/lib/api-key-toast'
import {
    resolveShortcuts,
    SHORTCUTS,
    type ResolvedShortcuts,
    type Shortcut,
    type ShortcutId,
} from '@/lib/shortcuts'
import { imageModelsStore } from '@/stores/image-models-store'
import type { KeybindingOverride, Settings } from '@/types/TSettings'

export type SettingsStoreState = {
  settings: Settings | null
  resolvedShortcuts: ResolvedShortcuts
  settingsDialogOpen: boolean
  setSettingsDialogOpen: (open: boolean) => void
  loadSettings: () => Promise<void>
  saveApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setDefaultModel: (modelId: string) => Promise<void>
  setKeybinding: (
    shortcutId: string,
    override: KeybindingOverride | null,
  ) => Promise<void>
  resetKeybindings: () => Promise<void>
}

let patchQueue: Promise<void> = Promise.resolve()

export const settingsStore = createStore<SettingsStoreState>()((set, get) => {
  const applySettings = (settings: Settings) => {
    set({
      settings,
      resolvedShortcuts: resolveShortcuts(settings.keybindings),
    })
  }

  const syncToast = () => {
    const { settings } = get()
    if (!settings) return
    syncApiKeyToast(Boolean(settings.openRouterApiKey), () =>
      set({ settingsDialogOpen: true }),
    )
  }

  const patchSettings = (partial: Partial<Settings>): Promise<void> => {
    const run = patchQueue.then(async () => {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      if (!response.ok) throw new Error('settings update failed')

      applySettings((await response.json()) as Settings)
      syncToast()
    })
    patchQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    settings: null,
    resolvedShortcuts: resolveShortcuts({}),
    settingsDialogOpen: false,

    setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),

    loadSettings: async () => {
      try {
        const response = await fetch('/api/settings')
        if (!response.ok) throw new Error('fetch failed')

        const settings = (await response.json()) as Settings
        applySettings(settings)
        syncToast()

        if (settings.openRouterApiKey) {
          void imageModelsStore.getState().fetchModels()
        }
      } catch (error) {
        console.error('settings_load_failed', error)
      }
    },

    saveApiKey: async (apiKey) => {
      try {
        const response = await fetch('/api/settings/validate-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          return {
            success: false,
            error: body?.error ?? 'Validation failed',
          }
        }

        await patchSettings({ openRouterApiKey: apiKey })
        void imageModelsStore.getState().fetchModels()
        return { success: true }
      } catch (error) {
        console.error('api_key_save_failed', error)
        return {
          success: false,
          error: 'Key validated but failed to persist',
        }
      }
    },

    setDefaultModel: async (modelId) => {
      await patchSettings({ defaultModelId: modelId }).catch((error) =>
        console.error('settings_update_failed', error),
      )
    },

    setKeybinding: async (shortcutId, override) => {
        const { settings } = get()
        if (!settings) return
  
        const base: Shortcut = SHORTCUTS[shortcutId as ShortcutId]
        const isDefault =
          override !== null &&
          override.key.toLowerCase() === base.key.toLowerCase() &&
          Boolean(override.shift) === Boolean(base.shift)
  
        const keybindings = { ...settings.keybindings }
        if (override === null || isDefault) {
          delete keybindings[shortcutId]
        } else {
          keybindings[shortcutId] = override
        }
        await patchSettings({ keybindings }).catch((error) =>
          console.error('settings_update_failed', error)
        )
    },

    resetKeybindings: async () => {
      await patchSettings({ keybindings: {} }).catch((error) =>
        console.error('settings_update_failed', error),
      )
    },
  }
})

export function useSettingsStore<T>(
  selector: (state: SettingsStoreState) => T,
): T {
  return useStore(settingsStore, selector)
}