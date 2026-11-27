import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { McpConnection } from "@/types/TAgentConnect";

const run = promisify(execFile);

const NAME = "gallery-mcp";
const MCP_DIR = "resourcesPath" in process ? process.resourcesPath : path.resolve("mcp", "dist");
const BUNDLE_FILE = path.join(MCP_DIR, `${NAME}.mcpb`);
const FINGERPRINT_FILE = path.join(MCP_DIR, `${NAME}.sha256`);

const CLAUDE_DIR = path.join(os.homedir(), "Library", "Application Support", "Claude");
const EXTENSIONS_DIR = path.join(CLAUDE_DIR, "Claude Extensions");
const INSTALLED_SERVER = path.join("server", "server.cjs");

const isMissing = (error: unknown) =>
  ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "");

export async function readMcpFingerprint(): Promise<string | null> {
  try {
    return (await fs.readFile(FINGERPRINT_FILE, "utf-8")).trim() || null;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function findInstalled(): Promise<string | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(EXTENSIONS_DIR);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  for (const entry of entries) {
    try {
      const manifest = JSON.parse(
        await fs.readFile(path.join(EXTENSIONS_DIR, entry, "manifest.json"), "utf-8"),
      ) as { name?: unknown };
      if (manifest.name === NAME) return path.join(EXTENSIONS_DIR, entry);
    } catch {}
  }
  return null;
}

async function fingerprintOf(file: string): Promise<string | null> {
  try {
    return createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function readMcpConnection(): Promise<McpConnection> {
  try {
    if (!(await fs.stat(CLAUDE_DIR).catch(() => null))?.isDirectory()) {
      return { state: "not_detected" };
    }
    const installed = await findInstalled();
    if (!installed) return { state: "not_connected" };
    const expected = await readMcpFingerprint();
    if (expected === null) return { state: "connected" };
    const actual = await fingerprintOf(path.join(installed, INSTALLED_SERVER));
    return { state: actual === expected ? "connected" : "outdated" };
  } catch (error) {
    return { state: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

export async function openMcpBundle(): Promise<void> {
  try {
    await fs.access(BUNDLE_FILE);
  } catch {
    throw new Error(`The extension was not built: no ${BUNDLE_FILE}. Run npm run mcp:build.`);
  }
  await run("open", [BUNDLE_FILE]);
}
