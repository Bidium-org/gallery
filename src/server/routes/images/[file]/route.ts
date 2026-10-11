import { MIME_BY_EXTENSION, readImage } from "@/lib/database";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  try {
    const buffer = await readImage(file);
    if (!buffer) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const extension = file.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_BY_EXTENSION[extension] ?? "application/octet-stream";

    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": contentType, "Cache-Control": "immutable" },
    });
  } catch (error) {
    console.error("image_read_failed", file, error);
    return Response.json({ error: "Failed to read image" }, { status: 500 });
  }
}
