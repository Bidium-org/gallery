import { getSettings, updateSettings } from "@/lib/database";
import type { Settings } from "@/types/TSettings";

// The clear key never leaves the server. Same output as `maskApiKey` in
// `components/settings/api-key.tsx`: both must stay identical, the front compares them.
const maskKey = (key: string | null) => (key ? `sk-or-${"•".repeat(30)}${key.slice(-4)}` : key);
const toPublic = (settings: Settings): Settings => ({
  ...settings,
  openRouterApiKey: maskKey(settings.openRouterApiKey),
});

export async function GET() {
  try {
    const settings = await getSettings();
    return Response.json(toPublic(settings));
  } catch (error) {
    console.error("settings_read_failed", error);
    return Response.json({ error: "Failed to read settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const partial = (await request.json()) as Partial<Settings>;
    // A masked value sent back as is: keep the real key on disk.
    if (partial.openRouterApiKey?.includes("•")) delete partial.openRouterApiKey;
    const settings = await updateSettings(partial);
    return Response.json(toPublic(settings));
  } catch (error) {
    console.error("settings_update_failed", error);
    return Response.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
