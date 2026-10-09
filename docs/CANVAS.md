# Canvas

The graph the user edits and how it is kept: nodes, edges, prompt versions, mentions, undo, save. Map and main flow: `docs/OVERVIEW.md`.

```
src/stores/canvas-store.ts   → the store: every canvas action, the only writer of nodes and edges
src/stores/canvas-init.ts    → id and default-name helpers
src/lib/versioning.ts        → version, mention and load-migration rules (pure)
src/lib/history.ts           → undo/redo stacks (pure)
src/lib/subgraph.ts          → copy / duplicate with id remapping (pure)
src/types/TCanvas.ts, TCanvasNode.ts → persisted shapes
```

## Owns

- The graph model and the rules that keep edges, mentions and versions consistent.
- Undo/redo and the in-app clipboard.
- The client side of persistence: draft, autosave, load.
- The client side of a generation: placeholder, result, error.

## Model

- Three node kinds, the `CanvasNode` union in `src/types/TCanvasNode.ts`:
  - `CanvasTextNode`: the prompt, held as `TextVersion`s.
  - `CanvasImageNode`: an image URL, `generating` or `ready`, with cost and duration.
  - `CanvasErrorNode`: a failed or interrupted generation.
- An edge (`CanvasEdge`) means "source feeds target". Into a text node it is an input; from a text node to an image it is an output.
- A node's `label` is its identity for mentions. Labels are not unique.
- A `CanvasTextNode` holds its `versions` and a `currentVersionId`; each `TextVersion` has its own prompt, model and parameters.
- Every edge touching a text node carries `data.versionId` (`CanvasEdgeData`): the version it belongs to (the target's if it is a text node, else the source's). Only edges of the current version are drawn, but hidden ones still exist.

## Versions, edges and mentions

- New version: a copy of the current one, plus a copy of its incoming edges. Switching versions is a view change: not an undo step.
- What feeds a generation = the incoming edges of the current version. Prompt building: `docs/OPENROUTER.md`.
- Typing `@label` (or picking it) wires that node to the text node, on its current version. If several nodes share the label, only the first is wired.
- Removing a mention removes the edge only when **no version** of that node still cites it. Removed from one version while another cites it, the edge stays and still feeds that version.
- Deleting an edge strips its mention from every version of the target that cites it without having an edge of its own.
- Renaming a node rewrites its mentions in all versions of all text nodes. Renaming to an existing label is allowed.
- Output edges (text to image) belong to the version that generated them: creating or switching version hides them, the images stay.

## Copy and duplicate

- A copy takes the selected nodes and every edge touching them, with new ids; text versions are cloned and edge `versionId`s remapped.
- Edges to nodes outside the selection are kept: a copied target stays wired to its original sources.
- Duplicating a **source** node wires the copy to every target it fed, on each target's current version. A target with N versions gets N identical edges.
- The clipboard is in memory only (plus a marker text on the system clipboard). It is cleared on load and on new canvas.

## History

- Snapshots of nodes and edges (selection stripped), 20 steps, not persisted, cleared on load.
- Mutations in the same tick share one step; a drag is one step. Version switches and viewport moves are not steps.
- Generation steps are undoable like any edit.

## Persistence (client side)

- The app starts on an empty draft with no id. The first node added or pasted promotes it: `POST /api/canvas` with the nodes present at that instant, the rest follows by autosave.
- Every change schedules a full `PATCH` after 800 ms; `flushSave()` sends it now. Viewport moves and version switches save too. On quit, the Electron main calls `flushSave()` (`docs/RUNTIME.md`). Disk side: `docs/HOST.md`.
- Opening a canvas flushes the current one, then runs `prepareLoadedCanvas()`: legacy text nodes become one version, nodes stuck in `generating` become "interrupted" error nodes, edges without `versionId` get the text node's current one. Nodes and edges are persisted as React Flow objects, so any change to a node's `data` shape needs a migration there.
- Renaming the open canvas rides the autosave; renaming another one sends a `PATCH` with the name only. Deleting a canvas: `docs/HOST.md` for what happens to its images.

## Generation (client side)

`generateFromTextNode()` adds a `generating` image node and an animated edge on the current version, then waits for the host.

- Success: the placeholder becomes the result; extra images are stacked 260 px lower, one edge each. Cost and duration go on the node, then outputs are renamed in the background.
- Failure: the placeholder becomes an error node carrying the message.
- The outcome is dropped if the user switched canvas or deleted the placeholder in the meantime.

## Gotchas

- `saveTimer` and the in-flight promotion are module variables, not store state: `setState` alone does not reset them (matters when testing the store headless).
- Because of the "no version cites it" rule, an edge can outlive the mention that created it. The edge, not the text, is the source of truth for inputs.
