## Calling

- Every command is a tool of this extension, with the same name and arguments. A tool's text result is the command's JSON result.
- A failed call is a tool error. Its message starts with the family of the error, then the code and the message: `[call] unknown_node: No node with id "…"`.
  - `[call]`: your call is wrong (`invalid_args`, `unknown_node`, ...). The message names the field or the id. Fix it and retry. An `Input validation error` is a wrong call too.
  - `[app]`: the app is not ready (`host_not_running`, `no_renderer`, `renderer_disconnected`, `no_model`) or failed (`internal_error`, `generation_failed`, ...). Do not retry in a loop. Tell the human: open Gallery and a canvas, or what failed. Gallery and Claude Desktop both need to be open.
    - `generation_failed`: OpenRouter refused or failed the generation. Do not retry: show the human the message.
  - `[timeout]`: the command may still be running and the canvas may have changed. Read the canvas before doing anything else.
- Commands that create nodes return their ids.
- Gallery runs on the human's Mac: the `path`s in results are paths on that Mac, not files you can open. `generate` and `view_images` return their images as images you see, with a copy of each file. To look at images already on the canvas, call `view_images` with their node ids.
- `add_image` takes the path of a file on the Mac. For a file in a folder connected to this session, pass the path where you see it (`/sessions/<id>/mnt/<folder>/...`): the extension finds it on the Mac. If it refuses that path, replace `/sessions/<id>/mnt/<folder>` with the path of the connected folder on the Mac, and retry. A Mac path, such as the ones the `device_*` tools give, passes as is. A file outside the connected folders does not exist on the Mac.
- When a result ends with a note saying the Gallery extension is out of date, the call still worked: tell the human to update the extension from Gallery's settings, then go on.
