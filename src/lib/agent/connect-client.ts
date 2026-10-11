import type { AgentConnection } from "@/types/TAgentConnect";

async function request(method: "GET" | "POST"): Promise<AgentConnection[]> {
  const response = await fetch("/api/agent/connect", { method });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const body = (await response.json()) as {
    result: { agents: AgentConnection[] };
  };
  return body.result.agents;
}

export const fetchAgents = () => request("GET");
export const connectAgents = () => request("POST");
