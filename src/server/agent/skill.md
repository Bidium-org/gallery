---
name: gallery
description: Use when the user talks about their Gallery canvas, or wants to generate, add or arrange images in Gallery (the infinite-canvas image app). Drives the open canvas through the gallery command.
---

Gallery is a desktop app: an infinite canvas where text nodes hold prompts and image nodes hold results. You act on the canvas the user has open with the shell command `~/.gallery/bin/gallery`.

Always start with `~/.gallery/bin/gallery help`: it prints the manual and the list of commands. Follow it.

If the command says the app is not running or no canvas is open, ask the user to open Gallery and a canvas, then retry.
