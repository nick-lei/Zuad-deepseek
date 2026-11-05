# Development And Deployment

This project provides a DeepSeek Harness bundle, a native Codex plugin and portable MCP distributions for the Zuad signage backend. They share tool definitions, the program compiler and static rendering resources. A checkout of the backend editor is not required. See [platform setup and validation scope](platforms.md) for Claude Code, Cursor, Gemini CLI and Agent Plugins adapters.

## Requirements

- Node.js 24.22.1 or later in the Node.js 24 release line.
- DeepSeek Harness 0.2.1-rc.5 or 0.2.2-alpha.2 for the DSH integration; Codex with MCP support for the Codex integration.
- An existing Zuad backend and organization authorization.

## Build And Test

```sh
npm ci
npm run check
```

The tests use a local mock API and sanitized editor fixtures. They do not require backend credentials or publish programs to real devices.

`src/core/tools.ts` owns the shared JSON Schemas and live configuration generations. `src/core/config.ts` resolves plain configuration without a DSH runtime dependency. `src/tools.ts` adapts these definitions to DSH, and `src/index.ts` registers them. `src/mcp/` exposes the shared definitions through the MCP SDK and a loopback account connection page. `src/codex/` and `src/mcp.ts` retain the old public entry points and credential paths. `codex/` contains the native Codex metadata template; `adapters/platforms.mjs` generates all platform discovery files from the same version and metadata.

`npm run install:codex` prepares an independent local plugin source and installs only the locked MCP production dependencies. It then uses `codex plugin marketplace add` and `codex plugin add` to install it. It does not register a second global MCP or Skill. See [Codex setup](codex.md).

`npm run build:platforms` generates the six portable distributions under `dist/`. `npm run verify:platforms` installs production dependencies in a temporary directory outside the source tree, starts every generated MCP configuration and checks DSH schema parity, all 14 tools, grid compilation, profile isolation and login recovery. It does not perform backend writes. CI runs this alongside the source tests on Linux and Windows. Portable packages exclude `node_modules`; install their production dependencies on the target OS instead of distributing a Windows native canvas binary to Linux or macOS.

`node scripts/verify-codex-ui.mjs` exercises the browser login UI against a temporary mock backend and captures desktop/mobile screenshots under `test-results/`. Set `ZUAD_TEST_CHROME` if Chrome is not at its default Windows location.

With a plugin-capable Codex CLI installed, `node scripts/verify-codex-plugin.mjs` installs the native plugin into a temporary `CODEX_HOME`, checks its metadata and bundled files, then starts the cached MCP runtime and verifies tool discovery and the sign-in page. It does not use the real account or modify the user's Codex registration.

The Git repository includes compiled `lib/` files so Git installation does not require an install-time build script. After changing `src/`, run `npm run build` and commit the matching `lib/` changes. CI checks that these outputs match.

The DSH entry bundles its JavaScript dependencies after TypeScript compilation. This avoids a desktop host resolver failure when jsdom's `tr46` dependency requires the userland `punycode/` package. Host APIs and native canvas remain external; jsdom's stylesheet is embedded and its optional synchronous XHR worker retains its package path. `npm run verify:dsh` checks tool registration, fixture rendering and grid compilation against the distributed entry while rejecting an unbundled `punycode/` request. MCP distributions keep their separate runtime modules.

## Authentication

Account login is the default. Enter the backend address, username and password in the plugin details and select Sign in and connect. `/api.php/login` supplies the user's organization and identity; subsequent requests use that account's cookies and, when returned, Sign-Code. The sign-in form uses automatic organization discovery and clears any previous organization override when connecting. Deployments may still specify an organization directly, which is checked against the login response. User and role device restrictions are retained.

The password is a live `role('secret')` field: DSH removes it from settings responses. It is stored in the local DSH settings document, not encrypted by this plugin; protect that document with the same care as other local credentials. No password is accepted as an AI tool argument. Sign out clears the saved password and disables automatic account login until the next explicit sign in.

Existing administrator-provisioned deployments may keep `authMode: apiKey` and provision `ZUAD_API_KEY` in the environment of the DSH process, or in the deployment's environment-file mechanism. Never put the actual key in this repository. Installations do not inherit the publisher's authorization.

API-key mode rewrites `/api.php` to `/apikey.php` and attaches `x-api-key`. Administrators configure the backend HTTP(S) origin, organization, actor UID and actor name in the deployment settings or environment. The plugin details page is intended for account sign-in. The actor UID is business attribution, not a substitute for backend authorization.

The administrator may use `ZUAD_BASE_URL`, `ZUAD_ORG_NUM`, `ZUAD_ACTOR_UID`, `ZUAD_ACTOR_NICKNAME` and `ZUAD_FILE_ROOT` as deployment defaults. Working files otherwise use `~/.dsh/data/zuad-media/files` and are created automatically.

## Install

In the DSH plugin installation dialog, use:

```text
github:nick-lei/Zuad-deepseek#v0.1.1
```

Or install a prebuilt `.tgz` attachment from the GitHub Releases page. Both the source tag and the package contain precompiled runtime files.

## Release

Update the package version and lockfile, run the checks, rebuild `lib/` and commit. Push a matching `vX.Y.Z` tag. The release workflow verifies the version, installs locked dependencies, runs the tests, checks the tracked build output, builds and verifies the platform distributions and publishes the DSH archive, portable platform archives and SHA-256 checksums to GitHub Releases. It does not publish to npm or submit to other marketplaces. Generated runtime packages remain private until a publisher explicitly configures an npm release.

The repository uses the Unlicense chosen in its initial commit. See `LICENSE`. The bundled Noto font has its own license in `assets/fonts/LICENSE`.
