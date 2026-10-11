import { listCommands } from "@/lib/agent-catalog";

import { succeed } from "../answer";

export function GET() {
  return succeed(listCommands());
}
