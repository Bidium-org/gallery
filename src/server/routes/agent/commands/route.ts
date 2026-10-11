import { listCommands } from "@/lib/agent-catalog";
import { ARTIFACT_GAP, ARTIFACT_STACK_GAP } from "@/lib/constants";

import { succeed } from "../answer";
import source from "../../../agent-manual.md?raw";

const values: Record<string, number> = { ARTIFACT_GAP, ARTIFACT_STACK_GAP };
const manual = source.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
  String(values[key]),
);

export function GET() {
  return succeed({ manual, commands: listCommands() });
}
