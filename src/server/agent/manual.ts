import { ARTIFACT_GAP, ARTIFACT_STACK_GAP } from "@/lib/constants";

import common from "./assets/manual.md?raw";
import cliCalling from "./assets/manual-cli.md?raw";
import mcpCalling from "./assets/manual-mcp.md?raw";

const values: Record<string, string> = {
  ARTIFACT_GAP: String(ARTIFACT_GAP),
  ARTIFACT_STACK_GAP: String(ARTIFACT_STACK_GAP),
};

const assemble = (calling: string) =>
  common
    .replace("{{CALLING}}", calling.trim())
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key]);

export const cliManual = assemble(cliCalling);
export const mcpManual = assemble(mcpCalling);
