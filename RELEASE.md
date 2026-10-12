# Release

How a version of Gallery is published and how users install it. Build and packaging: `docs/RUNTIME.md`.

```
.github/workflows/release.yml → on a `v*` tag: build the DMG, publish the GitHub release
install.sh                    → install or update from the latest release
```

## Cut a release

```bash
npm version <x.y.z>
git push --follow-tags
```

`npm version` bumps `package.json` and creates the commit and the `v<x.y.z>` tag. The tag triggers the workflow.

## Workflow

- It fails unless the tag equals `v` + the `package.json` version.
- It builds the DMG on a macOS runner and publishes the GitHub release with it as `Gallery-darwin-arm64.dmg`. The name carries no version so `releases/latest/download/Gallery-darwin-arm64.dmg` always points to the newest one.
- Apple Silicon only.

## Install script

- `install.sh` downloads that DMG with `curl`, mounts it and copies the app into `/Applications`, replacing the old one: install and update are the same command.
- It refuses to run while Gallery is open rather than quitting it: replacing a running bundle would break it, and a forced quit could skip the quit flush.
- It warns when `jq` is missing: the agent CLI needs it (`docs/CLI.md`).

## Not done yet

All gated on an Apple Developer ID (signing and notarization):

- A DMG that opens without a warning.
- Auto-update: Squirrel.Mac refuses unsigned apps.
