---
name: zuad-signage
description: Manage a Zuad digital signage system through its MCP tools. Use for media-library uploads, editable program layouts, schedules, device publishing and signage administration; not for unrelated frontend development or image generation alone.
---

# Zuad Signage

Use the `zuad-media` MCP server. Tool names may have an MCP namespace prefix.

## Connection

- Call `zuad_connection` with `action: status` to inspect the account, organization and working files directory. Use `zuad_session` when a live backend access check is needed.
- When sign-in is required, call `zuad_connection` with `action: login` and show the returned local login link. The user enters their backend address and credentials on that page. Never ask for passwords in chat or pass them as tool arguments.
- The local link is valid while that MCP process is running. Obtain a fresh link after a restart; do not reuse one from a previous conversation.
- If tools are unavailable after installation, reload the host application's MCP configuration, usually by starting a new conversation or restarting the app.

## Discover and Query

Use `zuad_catalog` for resource names, routes and backend field examples. Examples are not required-field declarations. Query exact record IDs or search by name, then resolve ambiguous matches before making changes.

Database device IDs and terminal serial numbers are different. Pass database IDs to device-target parameters; the tools resolve terminal IDs. Organization and actor identity are supplied by the authenticated account.

Queries are paginated. Follow `page` while `possiblyTruncated` is true; a short nonempty page does not prove completion because a backend can reduce page size. Request only needed fields when inspecting large records.

## Materials and Programs

1. Query existing materials before uploading duplicates. For new local files, obtain `fileRoot` from `zuad_connection`, copy the requested files into that working directory, then use `zuad_file` with `upload_material` or `upload_chunks`. Ordinary uploads register material metadata automatically. Retain the returned material IDs and metadata.
2. Use `zuad_layout` with `describe`, optionally naming `componentType`, to discover control properties and enums. Use this information rather than inventing image, carousel, grid, text or timeline fields.
3. Build layouts in original canvas pixels. Image and video controls use `queueList`; reference registered material metadata, including media type, URL, name, preview and duration where supplied. Do not insert an arbitrary image URL and omit its media queue or library registration.
4. Use `sourceKind` and `sourceId` plus `patches` to modify an existing program or template. Preserve controls and metadata outside the requested edits. `compile` can inspect a payload without saving. `save_program` and `save_template` persist it.
5. Inspect saved records to verify the intended controls, media queues and timing. Report the resulting ID/name and preview when available. A thumbnail shows a static first slide; do not describe it as verification of video, webpages or device playback.

For tables, use the supported table structure. Saving regenerates and registers the raster used for playback. QR codes use `content`.

## Playback and Devices

Saving a program does not publish it. Publish, change schedules, issue device commands or modify system records only within the user's requested scope. Resolve the actual program and device/group IDs before dispatch; a clearly specified user request already authorizes that operation and does not require repetitive confirmation.

Use `zuad_publish`, `zuad_default_playback`, `zuad_schedule` or `zuad_device_command` for their workflows rather than writing raw task records. Schedules use Unix seconds and interpret daily clock times in Asia/Shanghai. The schedule tool checks conflicts.

Task creation is asynchronous. Query `tasks` and, where relevant, `device_configs` after dispatch. Distinguish accepted, pending, successful, failed and partially completed operations. Do not claim that a screen has updated from task creation alone.

When a write returns `uncertain: true` or partial progress, inspect existing records/tasks before retrying. Do not replay a failed write automatically. On `AUTH_REQUIRED`, show the local login link; after the user signs in, inspect prior results before resuming mutations.
