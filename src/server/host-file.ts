import fs from "node:fs/promises";
import path from "node:path";

import { GALLERY_DIR } from "@/lib/database/internals/paths";

import cliScript from "./agent/assets/gallery.sh?raw";
import { readMcpFingerprint } from "./agent/mcp";
import { writeAtomic } from "./write-atomic";

export const HOST_FILE = path.join(GALLERY_DIR, "host.json");
const CLI_FILE = path.join(GALLERY_DIR, "bin", "gallery");

type HostInfo = { url: string; pid: number; startedAt: string; mcp?: string };

export async function writeHostFiles(url: string): Promise<void> {
  try {
    await writeAtomic(CLI_FILE, cliScript, 0o755);
  } catch (error) {
    console.error("cli_file_write_failed", error);
  }
  const info: HostInfo = {
    url,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  try {
    const mcp = await readMcpFingerprint();
    if (mcp) info.mcp = mcp;
  } catch (error) {
    console.error("mcp_fingerprint_read_failed", error);
  }
  await writeAtomic(HOST_FILE, JSON.stringify(info, null, 2));
}

export async function removeHostFile(): Promise<void> {
  try {
    const info = JSON.parse(await fs.readFile(HOST_FILE, "utf-8")) as Partial<HostInfo>;
    if (info.pid === process.pid) await fs.unlink(HOST_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      console.error("host_file_remove_failed", error);
  }
}
