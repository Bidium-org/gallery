export type CanvasErrorCode =
  | "unknown_node"
  | "unknown_edge"
  | "not_a_text_node"
  | "unknown_canvas"
  | "version_out_of_range"
  | "no_model"
  | "generation_failed"
  | "generation_discarded"
  | "request_failed";

export class CanvasError extends Error {
  readonly code: CanvasErrorCode;

  constructor(code: CanvasErrorCode, message: string) {
    super(message);
    this.name = "CanvasError";
    this.code = code;
  }
}
