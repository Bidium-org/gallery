# Agent CLI

An agent with a shell (Claude Code, Codex) drives the open canvas through `gallery`, the same way the user does. What the guard does and does not stop: `docs/SECURITY.md`. Map: `docs/OVERVIEW.md`.

```
src/lib/agent/            → catalog (the commands), executors (what the renderer does), relay (renderer listener)
src/server/agent/         → the script, the manual and the skill (all bundled as text), skill installer
src/server/routes/agent/  → relay hub and routes
src/stores/agent-highlight-store.ts → highlight state
```

## Owns

- The relay between the host and the renderer, and the catalog of commands.
- The `gallery` script contract.
- The manual, the skill, and how the skill reaches the agents.
- The highlight of the node an agent acts on.
- The reasoning for a shell CLI: it lives here and nowhere else.

## Relay

The agent never touches the canvas: the host pushes each command over SSE to a renderer, which runs it and replies.

- A command targets the **last connected** renderer. A browser tab left open on the dev server is one: it can take commands meant for the app window.
- The hub state lives on `globalThis`: under `vite dev`, editing a server module re-evaluates it and module-level state would start empty while the SSE stream still belongs to the old instance.
- A late reply, after a `timeout`, is dropped and the command keeps running in the renderer. After exit 3, the canvas may have changed.

## Catalog

`src/lib/agent/catalog.ts` is the single declaration of what an agent can do: name, description, zod schema, example, timeout. The host validates against it and serves `help` from it; the renderer executes. `executors` is typed from the catalog, so a command without an executor fails `tsc`.

- Schemas are strict: a mistyped field is refused, not ignored.
- The JSON Schema conversion drops `refine` rules ("absolute path", "different nodes"): they live in descriptions and in the refusal message.
- Timeouts default to 10 s. `generate` has 110 s: the agent's shell tool times out at 2 minutes, and a longer relay timeout would get the call killed without the clean `timeout` answer.
- `add_image` is the only command with a host step (the host reads the file), so its entry has a second schema for what the renderer receives. `sleep` exists in dev only.

**Adding a command:** a catalog entry, then an executor of the same name that calls the store action the UI calls (create it and rewire the UI onto it if it does not exist: executive code is written once, only the transport differs). Name node arguments `id`, `ids`, `source` or `target` and return created nodes as `id` or `copies`: the highlight finds them by those names. `manual.md` changes only if a convention does.

## Script

`gallery <command> ['<json>' | -]` and `gallery help [command]`. It is generic: it knows no command, only the contract with the app. The script and the app will not always share a version, and a script embedding the command list would drift. The caller is an agent, which writes JSON without effort; per-command flags would need a schema-to-flags translator.

It prints one JSON object, always: `{ok, result}` or `{ok:false, error, message}` with a stable `error` code.

| Exit | Meaning                                        | Codes                                                                                                             |
| ---- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 0    | done                                           |                                                                                                                   |
| 1    | the call is wrong, fix it                      | `invalid_args`, `unknown_command`, `unknown_node`, any code raised by an action                                   |
| 2    | the app is not ready or failed, tell the human | `host_not_running`, `no_renderer`, `renderer_disconnected`, `internal_error`, `unexpected_response`, `jq_missing` |
| 3    | too long                                       | `timeout`                                                                                                         |

`internal_error` exits 2, not 1: exit 1 tells the agent to retry, which would loop on a bug it cannot fix. A reply that is not a JSON object is `unexpected_response`, exit 2 even on a 2xx: the real host never answers 2xx without JSON, so something else answers on the port of a stale `host.json`.

The script's own errors are plain `printf` so they work without `jq`: their messages hold no quote or backslash. It needs `jq` and `curl`, both in `/usr/bin` on macOS. Which release started shipping `jq` is unverified.

## Manual and skill

- **Manual** (`manual.md`): returned by `gallery help`, served and versioned by the app. Conventions only: output, workflow, layout, conduct. It never describes a command's arguments, or the two drift.
- **Skill** (`skill.md`): about five lines, stable across versions: what Gallery is, the script's path, "start with `gallery help`". Everything that changes lives in the manual, so the skill never needs updating.
- **Installing it**: the "Connect an agent" button in the settings. The click is the consent: nothing is written into another tool's folder without it. The one copy is `~/.agents/skills/gallery/SKILL.md`, which Codex reads directly (OpenAI's docs list `~/.agents/skills`, not `~/.codex/skills`). Claude Code gets a symlink to it from `~/.claude/skills/gallery`, as `npx skills` does. An agent is detected by its config folder; with none, nothing is written. A folder already at the symlink's place is never touched.
- Unverified: that Claude Code follows the symlink, and that Codex's `view_image` takes the path `generate` returns.

## Highlight

The node an agent acts on is lit amber (pulsing while the command runs, steady 1.5 s after), so the human sees where it works. The selection stays sky and the highlight wins.

It is view state only. Anything set on a node object would be saved in the canvas JSON and copied into undo snapshots: the highlight is never persisted, never an undo step, gone after a reload. `generate` lights its text node for the whole generation; the placeholder image is not lit, its id is known only at the end.

## Why the CLI is a shell script

A DMG user has no Node. The app contains Node but the fuse `RunAsNode` is off, so its binary cannot run an outside script, and a JS CLI would mean shipping a runtime of tens of MB. The CLI is thin (read `url` in `host.json`, send with `curl`, print, map the status), so a POSIX shell script suffices, and what it needs ships with macOS. No build, no binary to sign.

`RunAsNode` was weighed and kept off. Enabled, anyone can run `ELECTRON_RUN_AS_NODE=1 Gallery.app/Contents/MacOS/Gallery script.js`; the risk it removes is malware using the app as a disguise to inherit its permissions and the trust of a signed app. For Gallery that risk is low (no special permission, not notarized), but enabling it would still need a shell wrapper to find the app, and its interaction with `OnlyLoadAppFromAsar` is unverified.

A JS CLI would bring the repo's language, a small gain; local zod validation is moot since the app is the single source; Windows is out of scope. Reopen the choice if the CLI ever has to become thick.

## Gotchas

- After exit 3, read `get_canvas` before retrying.
- A prompt the human is editing lives in the text node's state, invisible to the store: it can overwrite an agent's `set_prompt` on outside click. Written in the manual, not fixed.
- `get_canvas` omits a node's `size` until the canvas has measured it.
