import {
  type CommandArgs,
  commandTimeoutMs,
  isAvailableCommand,
  parseCommandArgs,
} from "@/lib/agent/catalog";

import { fail, succeed } from "../answer";
import { dispatch, hasRenderer } from "../hub";
import { HostStepError, prepareAddImage, withImagePaths } from "../images";

function statusOf(code: string): number {
  if (code === "invalid_args" || code === "unknown_command") return 400;
  if (code === "internal_error") return 500;
  return 422;
}

const noRenderer = () =>
  fail(
    "no_renderer",
    "No renderer connected: open the page with a canvas.",
    409,
  );

export async function POST(request: Request) {
  let body: { name?: unknown; args?: unknown; timeoutMs?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_json", "The request body is not valid JSON.", 400);
  }
  if (typeof body?.name !== "string" || !body.name) {
    return fail("invalid_request", "`name` is required.", 400);
  }
  if (!isAvailableCommand(body.name)) {
    return fail(
      "unknown_command",
      `Unknown command: ${body.name}. List them with the commands endpoint.`,
      400,
    );
  }

  const parsed = parseCommandArgs(body.name, body.args ?? {});
  if (!parsed.ok) return fail("invalid_args", parsed.message, 400);

  const timeoutMs =
    typeof body.timeoutMs === "number" && body.timeoutMs > 0
      ? body.timeoutMs
      : commandTimeoutMs(body.name);

  let args = parsed.args;
  if (body.name === "add_image") {
    // Checked before writing: with no page to show them, the copied files would be orphans.
    if (!hasRenderer()) return noRenderer();
    try {
      args = await prepareAddImage(parsed.args as CommandArgs<"add_image">);
    } catch (error) {
      if (error instanceof HostStepError) {
        return fail(error.code, error.message, 422);
      }
      console.error("agent_host_step_failed", body.name, error);
      const message = error instanceof Error ? error.message : String(error);
      return fail("internal_error", message, 500);
    }
  }

  const outcome = await dispatch(body.name, args, timeoutMs);
  switch (outcome.kind) {
    case "reply": {
      const { reply } = outcome;
      if (reply.ok) return succeed(withImagePaths(reply.result ?? null));
      const code = reply.error ?? "internal_error";
      return fail(code, reply.message ?? code, statusOf(code));
    }
    case "no_renderer":
      return noRenderer();
    case "disconnected":
      return fail(
        "renderer_disconnected",
        "The renderer closed while the command was running.",
        409,
      );
    case "timeout":
      return fail(
        "timeout",
        `No reply from the renderer after ${timeoutMs} ms.`,
        504,
      );
  }
}
