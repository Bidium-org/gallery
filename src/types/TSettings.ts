import type { McpAlertState } from "@/types/TAgentConnect";

export type KeybindingOverride = {
  key: string;
  shift?: boolean;
};

export type Settings = {
  openRouterApiKey: string | null;
  defaultModelId: string | null;
  keybindings: Record<string, KeybindingOverride>;
  dismissedMcpAlerts: McpAlertState[];
};

export const DEFAULT_SETTINGS: Settings = {
  openRouterApiKey: null,
  defaultModelId: null,
  keybindings: {},
  dismissedMcpAlerts: [],
};
