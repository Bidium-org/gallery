import fs from "node:fs/promises";
import path from "node:path";

import { IMAGES_FOLDER } from "@/lib/database/internals/paths";

const FILENAME_PATTERN = /^[\w-]+\.\w+$/;

export const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(Object.keys(MIME_BY_EXTENSION));

// The first extension listed for a type wins: `jpg` rather than `jpeg`.
export const EXTENSION_BY_MIME: Record<string, string> = Object.entries(MIME_BY_EXTENSION).reduce(
  (byMime, [extension, mime]) => (mime in byMime ? byMime : { ...byMime, [mime]: extension }),
  {},
);

export function resolveExtension(name: string, mimeType?: string): string | null {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return (mimeType && EXTENSION_BY_MIME[mimeType]) || null;
}

export function imagePath(filename: string): string {
  return path.join(IMAGES_FOLDER, filename);
}

export async function initializeImagesFolder(): Promise<void> {
  await fs.mkdir(IMAGES_FOLDER, { recursive: true });
}

export async function saveImage(buffer: Buffer, extension: string): Promise<string> {
  await initializeImagesFolder();

  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(IMAGES_FOLDER, filename), buffer);
  return filename;
}

export async function readImage(filename: string): Promise<Buffer | null> {
  if (!FILENAME_PATTERN.test(filename)) return null;

  try {
    return await fs.readFile(path.join(IMAGES_FOLDER, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteImages(filenames: string[]): Promise<void> {
  await Promise.all(
    filenames.map(async (filename) => {
      if (!FILENAME_PATTERN.test(filename)) return;
      try {
        await fs.unlink(path.join(IMAGES_FOLDER, filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }),
  );
}
