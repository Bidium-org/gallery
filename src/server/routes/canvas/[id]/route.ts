import { deleteCanvas, getCanvasById, updateCanvas } from "@/lib/database";
import type { CanvasContent } from "@/types/TCanvas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const canvas = await getCanvasById(id);
    if (!canvas) {
      return Response.json({ error: "Canvas not found" }, { status: 404 });
    }
    return Response.json(canvas);
  } catch (error) {
    console.error("canvas_read_failed", id, error);
    return Response.json({ error: "Failed to read canvas" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const updates = (await request.json()) as Partial<CanvasContent>;
    const canvas = await updateCanvas(id, updates);
    return Response.json(canvas);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return Response.json({ error: "Canvas not found" }, { status: 404 });
    }
    console.error("canvas_update_failed", id, error);
    return Response.json({ error: "Failed to update canvas" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    await deleteCanvas(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("canvas_delete_failed", id, error);
    return Response.json({ error: "Failed to delete canvas" }, { status: 500 });
  }
}
