# Development And Deployment

This package is a DeepSeek Harness bundle for the Zuad signage backend. It contains its program compiler, static rendering resources and configuration page. A checkout of the backend editor is not required.

## Requirements

- Node.js 24.22.1 or later in the Node.js 24 release line.
- DeepSeek Harness 0.2.1-rc.5 or 0.2.2-alpha.2.
- An existing Zuad backend and organization authorization.

## Build And Test

```sh
npm ci
npm run check
```

The tests use a local mock API and sanitized editor fixtures. They do not require backend credentials or publish programs to real devices.

The Git repository includes compiled `lib/` files so Git installation does not require an install-time build script. After changing `src/`, run `npm run build` and commit the matching `lib/` changes. CI checks that these outputs match.

## Authentication

Provision `ZUAD_API_KEY` in the environment of the DSH process, or in the DSH deployment's existing environment-file mechanism. Never put the actual key in this repository or in the plugin settings page. Installations do not inherit the publisher's authorization.

API-key mode rewrites `/api.php` to `/apikey.php` and attaches `x-api-key`. Configure the backend HTTP(S) origin, organization, actor UID and actor name on the plugin details page. The actor UID is business attribution, not a substitute for backend authorization.

The administrator may use `ZUAD_BASE_URL`, `ZUAD_ORG_NUM`, `ZUAD_ACTOR_UID`, `ZUAD_ACTOR_NICKNAME` and `ZUAD_FILE_ROOT` as deployment defaults. Working files otherwise use `~/.dsh/data/zuad-media/files` and are created automatically.

## Install

In the DSH plugin installation dialog, use:

```text
github:nick-lei/Zuad-deepseek#v0.1.0
```

Or install a prebuilt `.tgz` attachment from the GitHub Releases page. Both the source tag and the package contain precompiled runtime files.

## Release

Update the package version and lockfile, run the checks, rebuild `lib/` and commit. Push a matching `vX.Y.Z` tag. The release workflow verifies the version, installs locked dependencies, runs the tests, checks the tracked build output and publishes the installation archive to GitHub Releases.

The repository uses the Unlicense chosen in its initial commit. See `LICENSE`. The bundled Noto font has its own license in `assets/fonts/LICENSE`.
