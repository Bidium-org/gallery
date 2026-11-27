import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { fetchMcp, openMcpInstall } from "@/lib/agent/connect-client";
import { syncApiKeyToast, syncMcpAlert } from "@/lib/alerts";
import {
  resolveShortcuts,
  SHORTCUTS,
  type ResolvedShortcuts,
  type Shortcut,
  type ShortcutId,
} from "@/lib/shortcuts";
import { imageModelsStore } from "@/stores/image-models-store";
import type { McpAlertState, McpConnection } from "@/types/TAgentConnect";
import type { KeybindingOverride, Settings } from "@/types/TSettings";

export type SettingsSection = "models" | "shortcuts" | "agent";

export type SettingsStoreState = {
  settings: Settings | null;
  resolvedShortcuts: ResolvedShortcuts;
  settingsDialogOpen: boolean;
  settingsSection: SettingsSection;
  mcp: McpConnection | null;
  setSettingsDialogOpen: (open: boolean) => void;
  openSettings: (section: SettingsSection) => void;
  setSettingsSection: (section: SettingsSection) => void;
  loadSettings: () => Promise<void>;
  loadMcp: () => Promise<void>;
  installMcp: () => Promise<void>;
  saveApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultModel: (modelId: string) => Promise<void>;
  setKeybinding: (shortcutId: string, override: KeybindingOverride | null) => Promise<void>;
  resetKeybindings: () => Promise<void>;
};

let patchQueue: Promise<void> = Promise.resolve();

export const settingsStore = createStore<SettingsStoreState>()((set, get) => {
  const applySettings = (settings: Settings) => {
    set({
      settings,
      resolvedShortcuts: resolveShortcuts(settings.keybindings),
    });
  };

  const openSettings = (section: SettingsSection) =>
    set({ settingsDialogOpen: true, settingsSection: section });

  const syncToast = () => {
    const { settings } = get();
    if (!settings) return;
    syncApiKeyToast(Boolean(settings.openRouterApiKey), () => openSettings("models"));
  };

  const syncMcp = () => {
    const { settings, mcp } = get();
    if (!settings || !mcp) return;
    const alert =
      (mcp.state === "not_connected" || mcp.state === "outdated") &&
      !settings.dismissedMcpAlerts.includes(mcp.state)
        ? mcp.state
        : null;
    syncMcpAlert(alert, {
      openSettings: () => openSettings("agent"),
      dismiss: (state: McpAlertState) => {
        const current = get().settings;
        if (!current) return;
        const dismissedMcpAlerts = [...current.dismissedMcpAlerts, state];
        set({ settings: { ...current, dismissedMcpAlerts } });
        void patchSettings({ dismissedMcpAlerts }).catch((error) =>
          console.error("settings_update_failed", error),
        );
      },
    });
  };

  const patchSettings = (partial: Partial<Settings>): Promise<void> => {
    const run = patchQueue.then(async () => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!response.ok) throw new Error("settings update failed");

      applySettings((await response.json()) as Settings);
      syncToast();
      syncMcp();
    });
    patchQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  return {
    settings: null,
    resolvedShortcuts: resolveShortcuts({}),
    settingsDialogOpen: false,
    settingsSection: "models",
    mcp: null,

    setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
    openSettings,
    setSettingsSection: (section) => set({ settingsSection: section }),

    loadSettings: async () => {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) throw new Error("fetch failed");

        const settings = (await response.json()) as Settings;
        applySettings(settings);
        syncToast();
        syncMcp();

        if (settings.openRouterApiKey) {
          void imageModelsStore.getState().fetchModels();
        }
      } catch (error) {
        console.error("settings_load_failed", error);
      }
    },

    loadMcp: async () => {
      try {
        set({ mcp: await fetchMcp() });
        syncMcp();
      } catch (error) {
        console.error("mcp_state_load_failed", error);
      }
    },

    installMcp: async () => {
      set({ mcp: await openMcpInstall() });
      syncMcp();
    },

    saveApiKey: async (apiKey) => {
      try {
        const response = await fetch("/api/settings/validate-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          return {
            success: false,
            error: body?.error ?? "Validation failed",
          };
        }

        await patchSettings({ openRouterApiKey: apiKey });
        void imageModelsStore.getState().fetchModels();
        return { success: true };
      } catch (error) {
        console.error("api_key_save_failed", error);
        return {
          success: false,
          error: "Key validated but failed to persist",
        };
      }
    },

    setDefaultModel: async (modelId) => {
      await patchSettings({ defaultModelId: modelId }).catch((error) =>
        console.error("settings_update_failed", error),
      );
    },

    setKeybinding: async (shortcutId, override) => {
      const { settings } = get();
      if (!settings) return;

      const base: Shortcut = SHORTCUTS[shortcutId as ShortcutId];
      const isDefault =
        override !== null &&
        override.key.toLowerCase() === base.key.toLowerCase() &&
        Boolean(override.shift) === Boolean(base.shift);

      const keybindings = { ...settings.keybindings };
      if (override === null || isDefault) {
        delete keybindings[shortcutId];
      } else {
        keybindings[shortcutId] = override;
      }
      await patchSettings({ keybindings }).catch((error) =>
        console.error("settings_update_failed", error),
      );
    },

    resetKeybindings: async () => {
      await patchSettings({ keybindings: {} }).catch((error) =>
        console.error("settings_update_failed", error),
      );
    },
  };
});

export function useSettingsStore<T>(selector: (state: SettingsStoreState) => T): T {
  return useStore(settingsStore, selector);
}
