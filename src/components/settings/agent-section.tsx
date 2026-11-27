import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Circle, Loader2, RefreshCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { connectAgents, fetchAgents } from "@/lib/agent/connect-client";
import { useSettingsStore } from "@/stores/settings-store";
import type { AgentConnection, AgentState, McpConnection } from "@/types/TAgentConnect";

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

function StateRow({
  label,
  state,
  message,
}: {
  label: string;
  state: AgentState;
  message?: string;
}) {
  const { icon: Icon, text, className } = STATE_DISPLAY[state];
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-neutral-300">{label}</span>
        <span className={`flex items-center gap-1.5 ${className}`}>
          <Icon className="h-3.5 w-3.5" />
          {text}
        </span>
      </div>
      {message && <p className="mt-1.5 text-[11px] break-words text-red-400">{message}</p>}
    </div>
  );
}

function Failure({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SkillPart() {
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
      <h2 className="mb-1 text-sm font-semibold text-neutral-200">Agents on this Mac</h2>
      <p className="mb-4 text-[11px] text-neutral-500">
        Lets Claude Code or Codex, running on this Mac, work on your canvas. The button adds a small
        skill to the agent&apos;s folder, and nothing is written before you click. Cowork in Claude
        Desktop does not use this skill, it needs the extension below.
      </p>

      <div className="flex flex-col gap-2">
        {agents === null && !failure && (
          <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-800" />
        )}
        {agents?.map((agent) => (
          <StateRow
            key={agent.id}
            label={agent.label}
            state={agent.state}
            message={agent.message}
          />
        ))}
      </div>

      {noneDetected && (
        <p className="mt-3 text-[11px] text-neutral-500">
          No agent detected. Install Claude Code or Codex, then click the button to check again.
        </p>
      )}

      {failure && <Failure message={failure} />}

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

const MCP_BUTTON: Partial<Record<AgentState, string>> = {
  not_connected: "Install in Claude Desktop",
  outdated: "Update",
  error: "Install in Claude Desktop",
};

function McpButton({ mcp }: { mcp: McpConnection }) {
  const installMcp = useSettingsStore((state) => state.installMcp);
  const [isOpening, setIsOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const install = useCallback(async () => {
    setIsOpening(true);
    setFailure(null);
    try {
      await installMcp();
      setOpened(true);
    } catch (error) {
      setFailure(messageOf(error));
    } finally {
      setIsOpening(false);
    }
  }, [installMcp]);

  if (mcp.state === "not_detected") {
    return (
      <p className="mt-3 text-[11px] text-neutral-500">
        Claude Desktop is not installed. Install it to use Gallery from Cowork.
      </p>
    );
  }

  const label = MCP_BUTTON[mcp.state];
  return (
    <>
      {failure && <Failure message={failure} />}
      {opened && mcp.state !== "connected" && (
        <p className="mt-3 text-[11px] text-neutral-500">
          Confirm the installation in Claude Desktop, then come back here.
        </p>
      )}
      {label ? (
        <Button size="sm" onClick={() => void install()} disabled={isOpening} className="mt-4">
          {isOpening && <Loader2 className="animate-spin" />}
          {label}
        </Button>
      ) : (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => void install()}
          disabled={isOpening}
          className="mt-3 text-neutral-500"
        >
          {isOpening && <Loader2 className="animate-spin" />}
          Reinstall
        </Button>
      )}
    </>
  );
}

function McpPart() {
  const mcp = useSettingsStore((state) => state.mcp);
  const loadMcp = useSettingsStore((state) => state.loadMcp);

  useEffect(() => {
    void loadMcp();
  }, [loadMcp]);

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-neutral-200">Claude Desktop (Cowork)</h2>
      <p className="mb-4 text-[11px] text-neutral-500">
        Lets Claude work on your canvas from Cowork. The button opens the Gallery extension in
        Claude Desktop, which asks you to install it. Gallery and Claude Desktop both need to be
        open.
      </p>

      {mcp === null ? (
        <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-800" />
      ) : (
        <>
          <StateRow label="Claude Desktop" state={mcp.state} message={mcp.message} />
          <McpButton mcp={mcp} />
        </>
      )}
    </section>
  );
}

export function AgentSection() {
  return (
    <div className="flex flex-col gap-8">
      <SkillPart />
      <McpPart />
    </div>
  );
}
