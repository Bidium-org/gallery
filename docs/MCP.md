# MCP server for Cowork

`gallery-mcp` lets Claude drive the open canvas from Cowork, in Claude Desktop. It is the second client of the agent door, `POST /api/agent/command`, next to the `gallery` script: the relay, the catalog, the manual and the skill are in `docs/CLI.md`. How the `.mcpb` is built and shipped in the app: `docs/RUNTIME.md`. Map: `docs/OVERVIEW.md`.

```
mcp/server.ts                    → the server: one tool per command
mcp/build.ts                     → `npm run mcp:build`: compile, manifest, fingerprint, `.mcpb`
src/server/agent/mcp.ts          → state read from disk, `open` on the `.mcpb`
src/server/routes/agent/mcp/     → GET the state, POST open the `.mcpb`
src/server/agent/assets/manual-mcp.md → how the MCP calls and fails (the "Calling" of its manual)
src/lib/alerts.ts                → the red alerts, the MCP one included
src/components/settings/agent-section.tsx → the "Claude Desktop (Cowork)" part
```

## Owns

- The MCP server contract: tools, errors, images, paths.
- The fingerprint that says the installed extension is out of date.
- The install from Gallery's settings, the state shown there and the opening alert.
- The reasoning for a `.mcpb`: it lives here and nowhere else.

## Where it runs

- Cowork runs its agent in the cloud, with two shells:
  - `Bash`, in the cloud, without the user's folders;
  - `device_bash`, with `device_list_dir` (the `device_*` tools), in a Linux VM on the Mac where the connected folders are mounted.
- Neither has `~/.gallery` nor reaches the host, so the script cannot work there.
- Claude Desktop, open on the Mac, runs local MCP servers and forwards Cowork's tool calls to them. `gallery-mcp` is one: a Node process on the Mac, run by Claude Desktop's own Node. The user needs no Node.
- Gallery and Claude Desktop both need to be open.
- Claude Desktop's Code tab sees the extension too: there the skill picks the script first (`docs/CLI.md`).

## Tools

- **One tool per command**, registered from `listCommands()` with the catalog's description and zod schema. The list cannot drift from the app it was built with; an older installed extension is caught by the fingerprint.
- Two generic tools (`gallery(command, args)`, `gallery_help`) were rejected: less readable for Claude.
- The build is a production build: no `sleep` tool.
- **Instructions**: the server sends the common manual + `manual-mcp.md` (`src/server/agent/manual.ts`).
- **Validation**: the SDK checks the arguments against the catalog's strict schema, `refine` rules included, then the host checks again. The SDK's refusal reads `MCP error -32602: Input validation error: …`, without a family; the manual classes it as a wrong call.
- **Each call** reads `~/.gallery/host.json` (`url`, `mcp`), posts `{name, args}`, and returns the `result` as JSON text.

## Errors

A failed call is a tool error whose text starts with its family, then the code: `[call] unknown_node: …`.

| Family      | HTTP status        | Also                                                                   |
| ----------- | ------------------ | ---------------------------------------------------------------------- |
| `[call]`    | other 4xx          | `path_not_translated` (the server's own)                               |
| `[app]`     | 409, 5xx except 504 | `host_not_running` (no `host.json` or no answer), `unexpected_response` (not JSON) |
| `[timeout]` | 504                | after it, read `get_canvas` before anything else                       |

- The families are the classes of `answer.ts`, read from the status, mapped as the script maps its exits (`docs/CLI.md`).

## Images

- A command with `mcpAttachImages` (`generate`, `view_images`) gets the file at every `path` of its result attached as image content. It is the program that encodes the file, never Claude that writes it.
- PNG, JPEG, GIF and WebP only.
- 6.5 MB of images per answer in all. 6.4 MB is the largest size tested in Cowork; Claude sees an image scaled down past about 2000 px.
- Any other file, or one past the budget, gets a "Not shown" line instead. When the budget stopped it, the line asks for fewer ids.
- The answer of `/api/agent/command` is the same as for the script: the attaching happens in the server, after it.

## Connected folders

`add_image` needs a path on the Mac. The paths Claude may hold:

- the Mac path, as `device_list_dir` gives it: it passes as is;
- the VM path, `/sessions/rcw-<id>/mnt/<folder>/…`, as `device_bash` sees it (`rcw-<id>` is that shell's user and home).

The server turns a VM path into the Mac path before calling the host:

1. It reads `preferences.remoteSessionFolderGrants` in `~/Library/Application Support/Claude/claude_desktop_config.json`.
2. It finds `session_<ID>`, ignoring case: `<id>` is the session id in lower case.
3. It takes the one granted folder whose name is `<folder>`, and replaces the prefix with it.
4. No session, two folders of that name, or an unreadable file: it refuses with `[call] path_not_translated`, without calling Gallery. The message tells Claude to replace the prefix with the connected folder's Mac path, which Cowork gives it.

- That file is internal to Claude Desktop and undocumented: an update can stop the translation, and the refusal is the fallback.
- Neither MCP roots (they list the Code tab's folders, not Cowork's) nor `_meta` (empty) carry the session today. When Claude Desktop sends it in `_meta` ([claude-code#108638](https://github.com/anthropics/claude-code/issues/108638)), read it there instead.
- `add_image` copies the file into Gallery's data folder: the Mac path matters only at that moment.
- A file only in the cloud shell does not exist on the Mac.

## Fingerprint

An installed extension is a frozen copy of the tool list, the instructions and the server code. All three are in the compiled `server.cjs`, so its sha256 is the fingerprint.

1. The build writes it next to the `.mcpb` (`docs/RUNTIME.md`).
2. The host writes it into `host.json` as `mcp` at start (`docs/HOST.md`).
3. The server hashes its own file at start.
4. When `host.json` carries another one, the answer is unchanged and ends with a note: tell the human to update the extension from Gallery's settings.

- Gallery's version is not compared: every release would flag an unchanged extension, and the human would learn to ignore the alert. The server's own `version` is fixed for the same reason.
- Without a fingerprint file (dev without `npm run mcp:build`) nothing is compared.

## Installing it

The settings read the state from disk (`src/server/agent/mcp.ts`):

| State           | On disk                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `not_detected`  | no `~/Library/Application Support/Claude`                                     |
| `not_connected` | no folder of `Claude Extensions/` whose `manifest.json` is named `gallery-mcp` |
| `outdated`      | the installed `server/server.cjs` has another fingerprint                     |
| `connected`     | the same fingerprint                                                          |

- The button makes the host run `open` on the embedded `.mcpb`; Claude Desktop asks the human to install it. The two clicks are the consent.
- The extension is found by its manifest's `name`, not its folder: today the folder is `local.mcpb.bidium.gallery-mcp`.
- The state is read again when Gallery's window gets the focus back: after the install in Claude Desktop, the row turns `connected` without a click.

The opening alert:

- `not_connected` and `outdated` raise a red alert with "Open settings"; no alert without Claude Desktop, nor when connected.
- It closes for good, per state, kept in `settings.json` (`dismissedMcpAlerts`): closing "not connected" says Cowork is not wanted, "out of date" says it is used, so one does not silence the other.
- "Open settings" hides it until the next start.

## Why a `.mcpb`

- A server hosted by us cannot reach a Gallery that listens only on the Mac, short of accounts and a relay: a SaaS.
- An MCP endpoint in the host would still need a stdio bridge started by Node, which is what the `.mcpb` is.
- It is not signed for now; what Claude Desktop shows for an unknown certificate is unverified.

## Gotchas

- `mcp/dist/` is a build output: after editing the catalog, the manual or `mcp/`, run `npm run mcp:build` again, then restart the dev server, or the extension and the app disagree.
- Unverified: what Claude Desktop does with a `.mcpb` of the same version as the installed one (the dev case); the alert's close is kept on a swipe too.
