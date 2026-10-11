import type { CanvasErrorCode } from "@/lib/canvas-error";

import type { HostStepCode } from "./images";

export type AgentErrorCode =
  | CanvasErrorCode
  | HostStepCode
  | "invalid_json"
  | "invalid_request"
  | "unknown_command"
  | "invalid_args"
  | "no_renderer"
  | "renderer_disconnected"
  | "internal_error"
  | "timeout";

type ErrorClass = "call" | "app" | "timeout";

// gallery.sh maps these statuses to its exits: 400 → 1, 503 → 2, 504 → 3.
const STATUS: Record<ErrorClass, number> = {
  call: 400,
  app: 503,
  timeout: 504,
};

const ERROR_CLASS: Record<AgentErrorCode, ErrorClass> = {
  invalid_json: "call",
  invalid_request: "call",
  unknown_command: "call",
  invalid_args: "call",
  unknown_node: "call",
  unknown_edge: "call",
  not_a_text_node: "call",
  unknown_canvas: "call",
  version_out_of_range: "call",
  unknown_model: "call",
  file_not_found: "call",
  unsupported_image_type: "call",
  file_too_large: "call",
  no_renderer: "app",
  renderer_disconnected: "app",
  internal_error: "app",
  no_model: "app",
  generation_failed: "app",
  generation_discarded: "app",
  request_failed: "app",
  timeout: "timeout",
};

// A code missing from the table (a renderer of another version) is answered as the app's failure.
const classOf = (code: string): ErrorClass =>
  Object.hasOwn(ERROR_CLASS, code)
    ? ERROR_CLASS[code as AgentErrorCode]
    : "app";

export const succeed = (result: unknown) => Response.json({ ok: true, result });

export const fail = (error: string, message: string) =>
  Response.json(
    { ok: false, error, message },
    { status: STATUS[classOf(error)] },
  );
