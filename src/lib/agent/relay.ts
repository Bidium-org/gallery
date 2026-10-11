// Renderer side of the agent relay: receives the commands pushed by the host over SSE,
import { executors } from "@/lib/agent/executors";
import { createdIds, targetIds } from "@/lib/agent/targets";
import { CanvasError } from "@/lib/canvas-error";
import { agentHighlightStore } from "@/stores/agent-highlight-store";

type Args = Record<string, unknown>;

type Outcome =
  { ok: true; result: unknown } | { ok: false; error: string; message: string };

async function run(name: string, args: Args): Promise<Outcome> {
  if (!Object.hasOwn(executors, name))
    return {
      ok: false,
      error: "unknown_command",
      message: `Unknown command: ${name}`,
    };
  const { highlight } = agentHighlightStore.getState();
  const release = highlight(targetIds(args));
  try {
    const result =
      (await (
        executors[name as keyof typeof executors] as (args: Args) => unknown
      )(args)) ?? null;
    highlight(createdIds(result))();
    return { ok: true, result };
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
    const { id, name, args } = JSON.parse(
      (event as MessageEvent<string>).data,
    ) as {
      id: string;
      name: string;
      args?: Args;
    };
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
