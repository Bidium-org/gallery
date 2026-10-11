import fs from "node:fs/promises";
import path from "node:path";

import { DATA_DIR } from "@/lib/database/internals/paths";
import { DEFAULT_SETTINGS, type Settings } from "@/types/TSettings";

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

let lock: Promise<void> = Promise.resolve();

function withSettingsLock<T>(run: () => Promise<T>): Promise<T> {
  const result = lock.then(run);
  lock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getSettings(): Promise<Settings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(data) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      keybindings: { ...DEFAULT_SETTINGS.keybindings, ...parsed.keybindings },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("settings_read_failed — falling back to defaults", error);
    }
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  return withSettingsLock(async () => {
    const settings = { ...(await getSettings()), ...partial };

    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempPath = `${SETTINGS_FILE}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(settings, null, 2), "utf-8");
    await fs.rename(tempPath, SETTINGS_FILE);

    return settings;
  });
}
