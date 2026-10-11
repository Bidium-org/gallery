import fs from "node:fs/promises";
import path from "node:path";

import { GALLERY_DIR } from "@/lib/database/internals/paths";

import cliScript from "./gallery.sh?raw";

export const HOST_FILE = path.join(GALLERY_DIR, "host.json");
const CLI_FILE = path.join(GALLERY_DIR, "bin", "gallery");

type HostInfo = { url: string; pid: number; startedAt: string };

async function writeCliFile(): Promise<void> {
  await fs.mkdir(path.dirname(CLI_FILE), { recursive: true });
  const tempPath = `${CLI_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, cliScript, "utf-8");
  await fs.chmod(tempPath, 0o755);
  await fs.rename(tempPath, CLI_FILE);
}

export async function writeHostFile(url: string): Promise<void> {
  try {
    await writeCliFile();
  } catch (error) {
    console.error("cli_file_write_failed", error);
  }
  const info: HostInfo = {
    url,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  await fs.mkdir(GALLERY_DIR, { recursive: true });
  const tempPath = `${HOST_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(info, null, 2), "utf-8");
  await fs.rename(tempPath, HOST_FILE);
}

export async function removeHostFile(): Promise<void> {
  try {
    const info = JSON.parse(
      await fs.readFile(HOST_FILE, "utf-8"),
    ) as Partial<HostInfo>;
    if (info.pid === process.pid) await fs.unlink(HOST_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      console.error("host_file_remove_failed", error);
  }
}
