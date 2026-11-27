import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { build } from "vite";

const run = promisify(execFile);

const ROOT = path.dirname(import.meta.dirname);
const DIST = path.join(ROOT, "mcp", "dist");
const BUNDLE = path.join(DIST, "bundle");
const SERVER = path.join(BUNDLE, "server", "server.cjs");
const NAME = "gallery-mcp";

async function listTools(): Promise<{ name: string; description: string }[]> {
  const client = new Client({ name: `${NAME}-build`, version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER] }));
  try {
    const { tools } = await client.listTools();
    return tools.map(({ name, description = "" }) => ({ name, description }));
  } finally {
    await client.close();
  }
}

await build({ configFile: path.join(ROOT, "vite.mcp.config.ts"), logLevel: "warn" });

const { version } = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf-8")) as {
  version: string;
};
const manifest = {
  manifest_version: "0.3",
  name: NAME,
  display_name: "Gallery",
  version,
  description: "Lets Claude work on your Gallery canvas. Gallery needs to be open on this Mac.",
  author: { name: "Bidium" },
  server: {
    type: "node",
    entry_point: "server/server.cjs",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a placeholder Claude Desktop fills in.
    mcp_config: { command: "node", args: ["${__dirname}/server/server.cjs"] },
  },
  tools: await listTools(),
  compatibility: { platforms: ["darwin"], runtimes: { node: ">=22.0.0" } },
  license: "MIT",
};
await fs.writeFile(path.join(BUNDLE, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const fingerprint = createHash("sha256")
  .update(await fs.readFile(SERVER))
  .digest("hex");
await fs.writeFile(path.join(DIST, `${NAME}.sha256`), `${fingerprint}\n`);

const output = path.join(DIST, `${NAME}.mcpb`);
await fs.rm(output, { force: true });
await run(path.join(ROOT, "node_modules", ".bin", "mcpb"), ["pack", BUNDLE, output]);

console.log(`${NAME} ${version}: ${manifest.tools.length} tools, ${fingerprint.slice(0, 12)}…`);
