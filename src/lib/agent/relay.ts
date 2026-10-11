import { executors } from "@/lib/agent/executors";
import { CanvasError } from "@/lib/canvas-error";
import { agentHighlightStore } from "@/stores/agent-highlight-store";

type Args = Record<string, unknown>;

type AnyExecutor = {
  run: (args: Args) => unknown;
  lights?: (args: Args) => string[];
  creates?: (result: unknown) => string[];
};

type Outcome = { ok: true; result: unknown } | { ok: false; error: string; message: string };

type Command = { id: string; name: string; args?: Args };

async function run(name: string, args: Args): Promise<Outcome> {
  if (!Object.hasOwn(executors, name))
    return {
      ok: false,
      error: "unknown_command",
      message: `Unknown command: ${name}`,
    };
  const executor = executors[name as keyof typeof executors] as AnyExecutor;
  const { highlight, flash } = agentHighlightStore.getState();
  const release = highlight(executor.lights?.(args) ?? []);
  try {
    const result = await executor.run(args);
    flash(executor.creates?.(result) ?? []);
    return { ok: true, result: result ?? null };
  } catch (error) {
    if (error instanceof CanvasError)
      return { ok: false, error: error.code, message: error.message };
    console.error("agent_command_failed", name, error);
    return {
      ok: false,
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    release();
  }
}

export function startAgentRelay(): void {
  const source = new EventSource("/api/agent/stream");
  source.addEventListener("command", async (event) => {
    let command: Command;
    try {
      command = JSON.parse((event as MessageEvent<string>).data) as Command;
    } catch (error) {
      console.error("agent_event_invalid", error);
      return;
    }
    const { id, name, args } = command;
    const outcome = await run(name, args ?? {});
    try {
      await fetch("/api/agent/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...outcome }),
      });
    } catch (error) {
      console.error("agent_reply_failed", error);
    }
  });
}
