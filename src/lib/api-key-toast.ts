import { toast } from "sonner";

const TOAST_ID = "missing-api-key";

export function syncApiKeyToast(hasKey: boolean, openSettings: () => void) {
  if (hasKey) {
    toast.dismiss(TOAST_ID);
    return;
  }

  toast.error("No API key configured", {
    id: TOAST_ID,
    duration: Infinity,
    action: { label: "Open settings", onClick: openSettings },
    style: {
      background: "#1c0a0a",
      border: "1px solid rgb(127 29 29 / 0.6)",
      color: "#fca5a5",
    },
    actionButtonStyle: {
      background: "rgb(127 29 29 / 0.4)",
      color: "#fca5a5",
    },
  });
}
