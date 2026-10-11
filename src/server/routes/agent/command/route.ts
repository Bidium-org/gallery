import {
  type CommandArgs,
  commandTimeoutMs,
  isAvailableCommand,
  parseCommandArgs,
} from "@/lib/agent/catalog";
import { fail, succeed } from "@/server/agent/answer";
import { dispatch, hasRenderer } from "@/server/agent/hub";
import {
  HostStepError,
  prepareAddImage,
  withImagePaths,
} from "@/server/agent/images";

const noRenderer = () =>
  fail("no_renderer", "No renderer connected: open the page with a canvas.");

export async function POST(request: Request) {
  let body: { name?: unknown; args?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_json", "The request body is not valid JSON.");
  }
  if (typeof body?.name !== "string" || !body.name) {
    return fail("invalid_request", "`name` is required.");
  }
  if (!isAvailableCommand(body.name)) {
    return fail(
      "unknown_command",
      `Unknown command: ${body.name}. List them with the commands endpoint.`,
    );
  }

  const parsed = parseCommandArgs(body.name, body.args ?? {});
  if (!parsed.ok) return fail("invalid_args", parsed.message);

  let args = parsed.args;
  if (body.name === "add_image") {
    // Checked before writing: with no page to show them, the copied files would be orphans.
    if (!hasRenderer()) return noRenderer();
    try {
      args = await prepareAddImage(parsed.args as CommandArgs<"add_image">);
    } catch (error) {
      if (error instanceof HostStepError) return fail(error.code, error.message);
      console.error("agent_host_step_failed", body.name, error);
      const message = error instanceof Error ? error.message : String(error);
      return fail("internal_error", message);
    }
  }

  const timeoutMs = commandTimeoutMs(body.name);
  const outcome = await dispatch(body.name, args, timeoutMs);
  switch (outcome.kind) {
    case "reply": {
      const { reply } = outcome;
      if (reply.ok) return succeed(withImagePaths(reply.result ?? null));
      const code = reply.error ?? "internal_error";
      return fail(code, reply.message ?? code);
    }
    case "no_renderer":
      return noRenderer();
    case "disconnected":
      return fail(
        "renderer_disconnected",
        "The renderer closed while the command was running.",
      );
    case "timeout":
      return fail("timeout", `No reply from the renderer after ${timeoutMs} ms.`);
  }
}
