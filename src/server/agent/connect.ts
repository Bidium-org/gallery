import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AgentConnection, AgentId } from "@/types/TAgentConnect";

import { writeAtomic } from "../write-atomic";
import skill from "./assets/skill.md?raw";

const HOME = os.homedir();
const SKILL_NAME = "gallery";
const SKILL_DIR = path.join(HOME, ".agents", "skills", SKILL_NAME);
const SKILL_FILE = path.join(SKILL_DIR, "SKILL.md");

type Agent = {
  id: AgentId;
  label: string;
  configDir: string;
  link?: string;
};

const AGENTS: Agent[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    configDir: path.join(HOME, ".claude"),
    link: path.join(HOME, ".claude", "skills", SKILL_NAME),
  },
  { id: "codex", label: "Codex", configDir: path.join(HOME, ".codex") },
];

type LinkState = "missing" | "ok" | "other" | "blocked";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const blockedMessage = (link: string) =>
  `${link} exists and is not a link. Remove it, then retry.`;

const isDetected = (agent: Agent) => isDirectory(agent.configDir);

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function readInstalled(): Promise<string | null> {
  try {
    return await fs.readFile(SKILL_FILE, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

const linkTarget = (link: string) =>
  path.relative(path.dirname(link), SKILL_DIR);

async function linkState(link: string): Promise<LinkState> {
  try {
    const stat = await fs.lstat(link);
    if (!stat.isSymbolicLink()) return "blocked";
    return (await fs.readlink(link)) === linkTarget(link) ? "ok" : "other";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

async function writeLink(link: string): Promise<void> {
  if ((await linkState(link)) === "blocked") {
    throw new Error(blockedMessage(link));
  }
  await fs.mkdir(path.dirname(link), { recursive: true });
  const tempPath = `${link}.${process.pid}.tmp`;
  try {
    await fs.rm(tempPath, { force: true });
    await fs.symlink(linkTarget(link), tempPath);
    await fs.rename(tempPath, link);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

async function connectionOf(agent: Agent): Promise<AgentConnection> {
  const { id, label } = agent;
  if (!(await isDetected(agent))) {
    return { id, label, state: "not_detected" };
  }
  try {
    const link = agent.link ? await linkState(agent.link) : "ok";
    if (agent.link && link === "blocked") {
      throw new Error(blockedMessage(agent.link));
    }
    const installed = await readInstalled();
    if (installed === null || link !== "ok") {
      return { id, label, state: "not_connected" };
    }
    return {
      id,
      label,
      state: installed === skill ? "connected" : "outdated",
    };
  } catch (error) {
    return { id, label, state: "error", message: messageOf(error) };
  }
}

export const listAgents = () => Promise.all(AGENTS.map(connectionOf));

export async function connectAgents(): Promise<AgentConnection[]> {
  const detected: Agent[] = [];
  for (const agent of AGENTS) {
    if (await isDetected(agent)) detected.push(agent);
  }

  const failures = new Map<AgentId, string>();
  if (detected.length > 0) {
    try {
      await writeAtomic(SKILL_FILE, skill);
      for (const agent of detected) {
        if (!agent.link) continue;
        try {
          await writeLink(agent.link);
        } catch (error) {
          failures.set(agent.id, messageOf(error));
        }
      }
    } catch (error) {
      for (const agent of detected) failures.set(agent.id, messageOf(error));
    }
  }

  const agents = await listAgents();
  return agents.map((agent) => {
    const message = failures.get(agent.id);
    return message === undefined
      ? agent
      : { ...agent, state: "error", message };
  });
}
