#!/bin/bash
# HeLa MCP Ecosystem — Agent Skill Sync Runner
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/sync-skills.mjs" "$@"

