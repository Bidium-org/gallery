# Gallery manual

Gallery is an infinite canvas where text nodes hold prompts, image nodes hold results, and edges say which node feeds which. These commands act on the canvas the human has open, as the human would. This manual holds the conventions; the commands, their arguments and examples are in `commands` next to it, and `gallery help <command>` describes one.

## Calling

- `gallery <command> '<json>'`, or `gallery <command> -` with the JSON on stdin. Use stdin for prompts that hold quotes or line breaks.
- Every call prints one JSON object: `{"ok":true,"result":...}` or `{"ok":false,"error":"<code>","message":"..."}`. Read `error` to branch, `message` to understand.
- Exit codes:
  - 0: done.
  - 1: your call is wrong (`invalid_args`, `unknown_node`, ...). The message names the field or the id. Fix it and retry.
  - 2: the app is not ready (`host_not_running`, `no_renderer`, `renderer_disconnected`) or failed (`internal_error`, `unexpected_response`, `jq_missing`). Do not retry in a loop. Tell the human: open Gallery and a canvas, or what failed.
  - 3: `timeout`. The command may still be running and the canvas may have changed. Read the canvas before doing anything else.
- Commands that create nodes return their ids. Images come back as absolute `path`s on disk: open them with your own file tools to look at them.

## Working

- Start with `get_canvas`, and read it again before acting if the human may have changed something. It gives every node's id, position and size, the edges, and the viewport.
- Address nodes by id. Labels are not unique, and `@label` in a prompt wires only the first node carrying that label.
- `size` can be missing right after a node is added, until the canvas has measured it.
- `generate` waits until the images exist, and spends OpenRouter credits: generate what was asked, once. An image node with `status: "generating"` has no `path` yet.
- `list_models` and `generate` fail with `no_model` while the model list is loading (a few seconds after the page opens) or when the OpenRouter API key is missing in the settings. Retry once, then ask the human to add the key.

## Layout

You are responsible for a readable canvas: nodes in order, none overlapping another. Positions are flow coordinates, the ones `get_canvas` returns.

- Read the sizes and positions of the existing nodes, and place new ones in free space.
- Inputs on the left, text nodes in the middle, outputs on the right. `generate` already puts its outputs {{ARTIFACT_GAP}} px to the right of the text node, and stacks extra images {{ARTIFACT_STACK_GAP}} px lower each. Leave that room.
- The top-left corner of what the human sees is at `(-viewport.x / viewport.zoom, -viewport.y / viewport.zoom)`. Start there, or next to the nodes already there, so the new nodes appear where the human is looking.

## Conduct

- The human edits at the same time. A prompt they are typing in can overwrite your `set_prompt` when they click out. Prefer a new node over rewriting one they may be editing.
- `open_canvas` and `new_canvas` change what the human sees. Use them only when asked.
- Every action you take lands in the human's undo stack: Cmd+Z undoes it. Nothing irreversible is exposed; there is no canvas deletion.
- The node you act on is highlighted for the human while the command runs.
