import fs from "node:fs/promises";
import path from "node:path";

export async function writeAtomic(
  file: string,
  content: string,
  mode?: number,
): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tempPath = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tempPath, content, { encoding: "utf-8", mode });
    await fs.rename(tempPath, file);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}
