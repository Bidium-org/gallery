## Calling

The commands, their arguments and examples are in `commands` next to this manual, and `gallery help <command>` describes one.

- `gallery <command> '<json>'`, or `gallery <command> -` with the JSON on stdin. Use stdin for prompts that hold quotes or line breaks.
- Every call prints one JSON object: `{"ok":true,"result":...}` or `{"ok":false,"error":"<code>","message":"..."}`. Read `error` to branch, `message` to understand.
- Exit codes:
  - 0: done.
  - 1: your call is wrong (`invalid_args`, `unknown_node`, ...). The message names the field or the id. Fix it and retry.
  - 2: the app is not ready (`host_not_running`, `no_renderer`, `renderer_disconnected`, `no_model`) or failed (`internal_error`, `generation_failed`, ...). Do not retry in a loop. Tell the human: open Gallery and a canvas, or what failed.
    - `generation_failed`: OpenRouter refused or failed the generation. Do not retry: show the human the message.
  - 3: `timeout`. The command may still be running and the canvas may have changed. Read the canvas before doing anything else.
- Commands that create nodes return their ids. Images come back as absolute `path`s on disk: open them with your own file tools to look at them.
