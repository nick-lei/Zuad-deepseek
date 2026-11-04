#!/usr/bin/env node
import { runStdio } from './mcp/stdio.js';

// Preserve the original Codex data directory for existing installations.
await runStdio('codex');
