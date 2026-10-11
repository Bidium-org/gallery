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

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export class HostStepError extends Error {
  readonly code: "file_not_found" | "unsupported_image_type" | "file_too_large";

  constructor(code: HostStepError["code"], message: string) {
    super(message);
    this.name = "HostStepError";
    this.code = code;
  }
}

// Everything that can refuse a file is decided here, from its path and its stats, without reading it.
async function checkImageFile(
  file: string,
): Promise<{ file: string; name: string; extension: string }> {
  const name = path.basename(file);
  const extension = resolveExtension(name);
  // Images only: without it, any file of the user could be copied into the images folder and read
  // back through `GET /api/images/…`.
  if (!extension || !IMAGE_EXTENSIONS.has(extension)) {
    throw new HostStepError(
      "unsupported_image_type",
      `"${name}" is not an image file (${[...IMAGE_EXTENSIONS].join(", ")})`,
    );
  }

  const stats = await fs.stat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  });
  if (!stats?.isFile()) {
    throw new HostStepError("file_not_found", `No file at "${file}"`);
  }
  if (stats.size > MAX_IMAGE_BYTES) {
    throw new HostStepError(
      "file_too_large",
      `"${name}" is ${Math.ceil(stats.size / 1024 / 1024)} MB, the limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB`,
    );
  }
  await fs.access(file, fs.constants.R_OK);
  return { file, name, extension };
}

// Every file is checked before the first one is written: a refusal leaves nothing on disk. The files
// are then read one at a time, so memory never holds more than one.
export async function prepareAddImage({
  paths,
  position,
}: CommandArgs<"add_image">): Promise<RendererArgs<"add_image">> {
  const checked = [];
  for (const file of paths) checked.push(await checkImageFile(file));

  const files = [];
  for (const { file, name, extension } of checked) {
    const buffer = await fs.readFile(file);
    files.push({
      name,
      url: `/api/images/${await saveImage(buffer, extension)}`,
    });
  }
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
