import { connectAgents, listAgents } from "@/server/agent/connect";

import { succeed } from "@/server/agent/answer";

export async function GET() {
  return succeed({ agents: await listAgents() });
}

export async function POST() {
  return succeed({ agents: await connectAgents() });
}
