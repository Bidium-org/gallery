import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Circle, Loader2, RefreshCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { connectAgents, fetchAgents } from "@/lib/agent/connect-client";
import type { AgentConnection, AgentState } from "@/types/TAgentConnect";

const STATE_DISPLAY: Record<AgentState, { icon: LucideIcon; text: string; className: string }> = {
  connected: { icon: Check, text: "Connected", className: "text-green-500" },
  outdated: {
    icon: RefreshCw,
    text: "Update available",
    className: "text-amber-400",
  },
  not_connected: {
    icon: Circle,
    text: "Not connected",
    className: "text-neutral-400",
  },
  not_detected: {
    icon: Circle,
    text: "Not detected",
    className: "text-neutral-600",
  },
  error: { icon: AlertTriangle, text: "Error", className: "text-red-400" },
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function buttonLabel(agents: AgentConnection[]): string {
  const detected = agents.filter((agent) => agent.state !== "not_detected");
  if (detected.some((agent) => agent.state === "outdated")) return "Update";
  if (detected.length > 0 && detected.every((agent) => agent.state === "connected")) {
    return "Reconnect";
  }
  return "Connect an agent";
}

export function AgentSection() {
  const [agents, setAgents] = useState<AgentConnection[] | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAgents()
      .then((result) => !cancelled && setAgents(result))
      .catch((error: unknown) => {
        if (!cancelled) setFailure(messageOf(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setFailure(null);
    try {
      setAgents(await connectAgents());
    } catch (error) {
      setFailure(messageOf(error));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const noneDetected = agents !== null && agents.every((agent) => agent.state === "not_detected");

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-neutral-200">Connect an agent</h2>
      <p className="mb-4 text-[11px] text-neutral-500">
        Lets an AI agent such as Claude Code or Codex work on your canvas. The button adds a small
        skill to the agent&apos;s folder, and nothing is written before you click.
      </p>

      <div className="flex flex-col gap-2">
        {agents === null && !failure && (
          <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-800" />
        )}
        {agents?.map((agent) => {
          const { icon: Icon, text, className } = STATE_DISPLAY[agent.state];
          return (
            <div
              key={agent.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-neutral-300">{agent.label}</span>
                <span className={`flex items-center gap-1.5 ${className}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {text}
                </span>
              </div>
              {agent.message && (
                <p className="mt-1.5 text-[11px] break-words text-red-400">{agent.message}</p>
              )}
            </div>
          );
        })}
      </div>

      {noneDetected && (
        <p className="mt-3 text-[11px] text-neutral-500">
          No agent detected. Install Claude Code or Codex, then click the button to check again.
        </p>
      )}

      {failure && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{failure}</span>
        </div>
      )}

      <Button
        size="sm"
        onClick={() => void connect()}
        disabled={isConnecting || agents === null}
        className="mt-4"
      >
        {isConnecting && <Loader2 className="animate-spin" />}
        {agents === null ? "Connect an agent" : buttonLabel(agents)}
      </Button>
    </section>
  );
}
