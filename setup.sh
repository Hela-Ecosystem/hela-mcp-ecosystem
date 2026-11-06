#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND=install.mjs
if [[ "${1:-}" == doctor ]]; then COMMAND=doctor.mjs; shift; fi
NIX_MODE=false
previous=""
for argument in "$@"; do
  if [[ "$argument" == --nix || "$previous" == --mode && "$argument" == nix ]]; then NIX_MODE=true; fi
  previous="$argument"
done
if [[ "$NIX_MODE" == true ]]; then
  command -v nix >/dev/null || { echo 'Nix is required for --mode nix' >&2; exit 1; }
  exec nix develop "$SCRIPT_DIR" --command node "$SCRIPT_DIR/scripts/$COMMAND" "$@"
fi
command -v node >/dev/null || { echo 'Node 22+ is required; alternatively use --mode nix' >&2; exit 1; }
exec node "$SCRIPT_DIR/scripts/$COMMAND" "$@"
