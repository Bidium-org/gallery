# Security policy

## Reporting a vulnerability

Please do not open a public issue. Report it privately:

- **Preferred:** [Report a vulnerability](https://github.com/Bidium-org/gallery/security/advisories/new) on GitHub.
- **Or by email:** bidiumdev@gmail.com

Include what you found, how to reproduce it, and the release of Gallery you installed. We will acknowledge your report and keep you posted until it is fixed.

## Supported versions

Only the latest release receives security fixes.

## Scope

Gallery runs locally: an Electron app with an HTTP host on `127.0.0.1`, data in `~/.gallery`, and a `gallery` shell command for agents. What the local host defends against, and what it does not: [`docs/SECURITY.md`](../docs/SECURITY.md).
