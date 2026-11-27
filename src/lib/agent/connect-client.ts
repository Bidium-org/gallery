import type { AgentConnection, McpConnection } from "@/types/TAgentConnect";

async function request<T>(method: "GET" | "POST", endpoint: string): Promise<T> {
  const response = await fetch(`/api/agent/${endpoint}`, { method });
  const body = (await response.json().catch(() => null)) as {
    result?: T;
    message?: string;
  } | null;
  if (!response.ok || !body?.result) {
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return body.result;
}

export const fetchAgents = async () =>
  (await request<{ agents: AgentConnection[] }>("GET", "connect")).agents;
export const connectAgents = async () =>
  (await request<{ agents: AgentConnection[] }>("POST", "connect")).agents;

export const fetchMcp = async () => (await request<{ mcp: McpConnection }>("GET", "mcp")).mcp;
export const openMcpInstall = async () =>
  (await request<{ mcp: McpConnection }>("POST", "mcp")).mcp;
