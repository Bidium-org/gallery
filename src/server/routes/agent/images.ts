import fs from "node:fs/promises";
import path from "node:path";

import type { CommandArgs, RendererArgs } from "@/lib/agent-catalog";
import {
  IMAGE_EXTENSIONS,
  imagePath,
  resolveExtension,
  saveImage,
} from "@/lib/database";

const IMAGE_URL = /^\/api\/images\/([\w-]+\.\w+)$/;

export class HostStepError extends Error {
  readonly code: "file_not_found" | "unsupported_image_type";

  constructor(code: HostStepError["code"], message: string) {
    super(message);
    this.name = "HostStepError";
    this.code = code;
  }
}

async function readImageFile(
  file: string,
): Promise<{ name: string; extension: string; buffer: Buffer }> {
  const name = path.basename(file);
  const extension = resolveExtension(name, "");
  // Images only: without it, any file of the user could be copied into the images folder and read
  // back through `GET /api/images/…`.
  if (!extension || !IMAGE_EXTENSIONS.has(extension)) {
    throw new HostStepError(
      "unsupported_image_type",
      `"${name}" is not an image file (png, jpg, jpeg, webp, gif, avif, svg)`,
    );
  }
  try {
    return { name, extension, buffer: await fs.readFile(file) };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR" || code === "ENOTDIR") {
      throw new HostStepError("file_not_found", `No file at "${file}"`);
    }
    throw error;
  }
}

export async function prepareAddImage({
  paths,
  position,
}: CommandArgs<"add_image">): Promise<RendererArgs<"add_image">> {
  const images = [];
  for (const file of paths) images.push(await readImageFile(file));

  const files = await Promise.all(
    images.map(async ({ name, extension, buffer }) => ({
      name,
      url: `/api/images/${await saveImage(buffer, extension)}`,
    })),
  );
  return { files, position };
}

// The renderer answers images as `imageUrl`; an agent opens a file, so each one becomes a `path`.
// An image still generating has no URL yet and so no path.
export function withImagePaths(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withImagePaths);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (key !== "imageUrl") return [[key, withImagePaths(entry)]];
      const match = typeof entry === "string" ? IMAGE_URL.exec(entry) : null;
      return match ? [["path", imagePath(match[1])]] : [];
    }),
  );
}
