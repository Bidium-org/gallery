import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

import { catalog, listCommands } from "@/lib/agent/catalog";
import { MIME_BY_EXTENSION } from "@/lib/database/internals/images";
import { mcpManual } from "@/server/agent/manual";

const HOST_FILE = path.join(os.homedir(), ".gallery", "host.json");
const CLAUDE_CONFIG = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Claude",
  "claude_desktop_config.json",
);

const VISIBLE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_ATTACHED_BYTES = 6.5 * 1024 * 1024;

const OWN_FINGERPRINT = createHash("sha256").update(readFileSync(__filename)).digest("hex");

const OUTDATED_NOTE =
  "Note: the Gallery extension in Claude Desktop is out of date. The call worked; tell the human to update the extension from Gallery's settings.";

type Family = "call" | "app" | "timeout";
type Answer = { ok: boolean; result?: unknown; error?: string; message?: string };

class ToolFailure extends Error {
  constructor(
    readonly family: Family,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const failure = (family: Family, code: string, message: string): CallToolResult => ({
  content: [{ type: "text", text: `[${family}] ${code}: ${message}` }],
  isError: true,
});

function familyOf(status: number): Family {
  if (status === 504) return "timeout";
  if (status === 409 || status >= 500) return "app";
  return "call";
}

async function readHostFile(): Promise<{ url: string; mcp?: string }> {
  try {
    const host = JSON.parse(await fs.readFile(HOST_FILE, "utf-8")) as {
      url?: unknown;
      mcp?: unknown;
    };
    if (typeof host.url === "string" && host.url) {
      return { url: host.url, mcp: typeof host.mcp === "string" ? host.mcp : undefined };
    }
  } catch {}
  throw new ToolFailure(
    "app",
    "host_not_running",
    "Gallery is not running: open the app, then retry.",
  );
}

async function post(url: string, body: unknown): Promise<{ status: number; answer: Answer }> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/agent/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ToolFailure(
      "app",
      "host_not_running",
      "Gallery did not answer: open the app, then retry.",
    );
  }
  const answer = (await response.json().catch(() => null)) as Answer | null;
  if (answer === null || typeof answer !== "object") {
    throw new ToolFailure(
      "app",
      "unexpected_response",
      `HTTP ${response.status} without a JSON object.`,
    );
  }
  return { status: response.status, answer };
}

// WARNING: `remoteSessionFolderGrants` is an internal, undocumented field of Claude Desktop's config,
// and can change with any update. Replace this lookup with `_meta` once Claude Desktop sends the session.
const SESSION_PATH = /^\/sessions\/rcw-([a-z0-9]+)\/mnt\/([^/]+)(\/.*)?$/i;

async function connectedFolderOf(session: string, folder: string): Promise<string | null> {
  try {
    const config = JSON.parse(await fs.readFile(CLAUDE_CONFIG, "utf-8")) as {
      preferences?: { remoteSessionFolderGrants?: Record<string, unknown> };
    };
    const grants = config.preferences?.remoteSessionFolderGrants ?? {};
    const key = Object.keys(grants).find(
      (candidate) => candidate.toLowerCase() === `session_${session.toLowerCase()}`,
    );
    const folders = key ? grants[key] : null;
    if (!Array.isArray(folders)) return null;
    const matches = folders.filter(
      (candidate): candidate is string =>
        typeof candidate === "string" && path.basename(candidate) === folder,
    );
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

async function toMacPath(file: string): Promise<string> {
  if (!file.startsWith("/sessions/")) return file;
  const match = SESSION_PATH.exec(file);
  const mount = match
    ? file.slice(0, file.length - (match[3]?.length ?? 0))
    : "/sessions/<id>/mnt/<folder>";
  const folder = match ? await connectedFolderOf(match[1], match[2]) : null;
  if (!match || !folder) {
    throw new ToolFailure(
      "call",
      "path_not_translated",
      `The Mac folder behind "${mount}" was not found. Replace "${mount}" with the path of the connected folder on the Mac, then retry.`,
    );
  }
  return folder + (match[3] ?? "");
}

function findPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(findPaths);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    key === "path" && typeof entry === "string" ? [entry] : findPaths(entry),
  );
}

async function attachImage(
  file: string,
  budget: { left: number },
): Promise<CallToolResult["content"][number]> {
  const mimeType = MIME_BY_EXTENSION[path.extname(file).slice(1).toLowerCase()];
  if (!mimeType || !VISIBLE_TYPES.has(mimeType)) {
    return {
      type: "text",
      text: `Not shown: ${path.basename(file)} is not a PNG, JPEG, GIF or WebP.`,
    };
  }
  try {
    const data = await fs.readFile(file);
    if (data.length > MAX_ATTACHED_BYTES) {
      return {
        type: "text",
        text: `Not shown: ${path.basename(file)} is ${Math.ceil(data.length / 1024 / 1024)} MB, too large to attach.`,
      };
    }
    if (data.length > budget.left) {
      return {
        type: "text",
        text: `Not shown: ${path.basename(file)} would pass the ${MAX_ATTACHED_BYTES / 1024 / 1024} MB of images one answer carries. Call view_images with fewer ids.`,
      };
    }
    budget.left -= data.length;
    return { type: "image", data: data.toString("base64"), mimeType };
  } catch (error) {
    return {
      type: "text",
      text: `Not shown: ${path.basename(file)} could not be read (${String(error)}).`,
    };
  }
}

async function runCommand(name: keyof typeof catalog, input: Record<string, unknown>) {
  const host = await readHostFile();
  const args =
    name === "add_image" && Array.isArray(input.paths)
      ? { ...input, paths: await Promise.all(input.paths.map((file) => toMacPath(String(file)))) }
      : input;
  const { status, answer } = await post(host.url, { name, args });
  if (!answer.ok) {
    const code = answer.error ?? "internal_error";
    throw new ToolFailure(familyOf(status), code, answer.message ?? code);
  }

  const content: CallToolResult["content"] = [
    { type: "text", text: JSON.stringify(answer.result ?? null) },
  ];
  if (catalog[name].mcpAttachImages) {
    const budget = { left: MAX_ATTACHED_BYTES };
    for (const file of findPaths(answer.result)) content.push(await attachImage(file, budget));
  }
  if (host.mcp && host.mcp !== OWN_FINGERPRINT) content.push({ type: "text", text: OUTDATED_NOTE });
  return content;
}

const server = new McpServer(
  { name: "gallery-mcp", version: "1.0.0" },
  { instructions: mcpManual },
);

for (const { name, description } of listCommands()) {
  const inputSchema: z.ZodObject = catalog[name].args;
  server.registerTool(name, { description, inputSchema }, async (args: Record<string, unknown>) => {
    try {
      return { content: await runCommand(name, args) };
    } catch (error) {
      if (error instanceof ToolFailure) return failure(error.family, error.code, error.message);
      return failure(
        "app",
        "internal_error",
        error instanceof Error ? error.message : String(error),
      );
    }
  });
}

void server.connect(new StdioServerTransport());
