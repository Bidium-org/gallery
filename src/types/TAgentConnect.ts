export type AgentId = "claude-code" | "codex";

export type AgentState = "connected" | "outdated" | "not_connected" | "not_detected" | "error";

export type AgentConnection = {
  id: AgentId;
  label: string;
  state: AgentState;
  message?: string;
};
