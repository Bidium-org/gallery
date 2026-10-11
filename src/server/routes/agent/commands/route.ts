import { listCommands } from "@/lib/agent/catalog";
import { ARTIFACT_GAP, ARTIFACT_STACK_GAP } from "@/lib/constants";
import source from "@/server/agent/assets/manual.md?raw";

import { succeed } from "@/server/agent/answer";

const values: Record<string, number> = { ARTIFACT_GAP, ARTIFACT_STACK_GAP };
const manual = source.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
  String(values[key]),
);

export function GET() {
  return succeed({ manual, commands: listCommands() });
}
