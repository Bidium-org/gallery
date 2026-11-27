import { fail, succeed } from "@/server/agent/answer";
import { openMcpBundle, readMcpConnection } from "@/server/agent/mcp";

export async function GET() {
  return succeed({ mcp: await readMcpConnection() });
}

export async function POST() {
  try {
    await openMcpBundle();
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : String(error));
  }
  return succeed({ mcp: await readMcpConnection() });
}
