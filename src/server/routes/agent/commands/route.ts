import { listCommands } from "@/lib/agent/catalog";
import { cliManual } from "@/server/agent/manual";

import { succeed } from "@/server/agent/answer";

export function GET() {
  return succeed({ manual: cliManual, commands: listCommands() });
}
