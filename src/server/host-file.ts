import fs from 'node:fs/promises'
import path from 'node:path'

import { GALLERY_DIR } from '@/lib/database/internals/paths'

// Where a client (the future agent client) finds the running host. Beside the data dir, and
// computable without knowing where the app runs. A hint only: a crash leaves it stale.
export const HOST_FILE = path.join(GALLERY_DIR, 'host.json')

type HostInfo = { url: string; pid: number; startedAt: string }

// Two hosts at once: last writer wins.
export async function writeHostFile(url: string): Promise<void> {
  const info: HostInfo = { url, pid: process.pid, startedAt: new Date().toISOString() }
  await fs.mkdir(GALLERY_DIR, { recursive: true })
  const tempPath = `${HOST_FILE}.${process.pid}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(info, null, 2), 'utf-8')
  await fs.rename(tempPath, HOST_FILE)
}

// Deletes the file only when it carries this process's pid, so a host that quits never erases
// the file of another host still running.
export async function removeHostFile(): Promise<void> {
  try {
    const info = JSON.parse(await fs.readFile(HOST_FILE, 'utf-8')) as Partial<HostInfo>
    if (info.pid === process.pid) await fs.unlink(HOST_FILE)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('host_file_remove_failed', error)
  }
}
