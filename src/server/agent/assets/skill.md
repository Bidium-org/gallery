---
name: gallery
description: Use when the user talks about their Gallery canvas, or wants to generate, add or arrange images in Gallery (the infinite-canvas image app). Drives the open canvas through the gallery command, or the Gallery tools of the gallery-mcp extension.
---

Gallery is a desktop app: an infinite canvas where text nodes hold prompts and image nodes hold results. You act on the canvas the user has open.

Check whether `~/.gallery/bin/gallery` exists (`test -x ~/.gallery/bin/gallery`).
- If it does, start with `~/.gallery/bin/gallery help` and follow it.
- If it does not, use the Gallery tools of the gallery-mcp extension; their instructions are the manual.
- If neither is there, ask the user to open Gallery and, for Cowork, to install the extension from Gallery's settings.

If the command or a tool says the app is not running or no canvas is open, ask the user to open Gallery and a canvas, then retry.

To update Gallery itself, with Gallery closed, run on the Mac: `curl -fsSL https://raw.githubusercontent.com/Bidium-org/gallery/main/install.sh | sh`.
