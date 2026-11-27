import { toast } from "sonner";

import type { McpAlertState } from "@/types/TAgentConnect";

const API_KEY_TOAST = "missing-api-key";
const MCP_TOAST = "mcp-connection";

const RED_ALERT = {
  style: {
    background: "#1c0a0a",
    border: "1px solid rgb(127 29 29 / 0.6)",
    color: "#fca5a5",
  },
  actionButtonStyle: {
    background: "rgb(127 29 29 / 0.4)",
    color: "#fca5a5",
  },
};

export function syncApiKeyToast(hasKey: boolean, openSettings: () => void) {
  if (hasKey) {
    toast.dismiss(API_KEY_TOAST);
    return;
  }

  toast.error("No API key configured", {
    id: API_KEY_TOAST,
    duration: Infinity,
    action: { label: "Open settings", onClick: openSettings },
    ...RED_ALERT,
  });
}

const MESSAGES: Record<McpAlertState, string> = {
  not_connected: "Gallery is not connected to Claude Desktop",
  outdated: "The Gallery extension in Claude Desktop is out of date",
};

let shown: McpAlertState | null = null;

export function syncMcpAlert(
  state: McpAlertState | null,
  handlers: { openSettings: () => void; dismiss: (state: McpAlertState) => void },
) {
  if (state === shown) return;
  shown = state;
  if (state === null) {
    toast.dismiss(MCP_TOAST);
    return;
  }

  toast.error(MESSAGES[state], {
    id: MCP_TOAST,
    duration: Infinity,
    closeButton: true,
    action: { label: "Open settings", onClick: handlers.openSettings },
    onDismiss: () => {
      if (shown !== state) return;
      shown = null;
      handlers.dismiss(state);
    },
    ...RED_ALERT,
  });
}
