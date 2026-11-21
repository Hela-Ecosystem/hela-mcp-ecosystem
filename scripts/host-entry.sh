#!/bin/sh
# HeLa MCP host entry point — the single command every MCP client should call.
#
# Installed to ~/.local/bin/hela-runtime-mcp by the installer (or by hand:
# `install -m 755 scripts/host-entry.sh ~/.local/bin/hela-runtime-mcp`).
#
# Why this exists instead of pointing clients at `node dist/index.js`:
#   * it resolves the interpreter at spawn time, so a moved or purged `node`
#     produces one actionable line instead of a host-side ENOENT
#   * it refuses to start below the floor the cells declare
#   * it loads credentials from one 0600 file instead of six inline env blocks
#   * it records failures to a log, because hosts swallow child stderr
#
# Constraints that shaped this file:
#   * must work with a stripped PATH (that is the failure it exists to report),
#     so every external command is absolute and version parsing uses shell expansion
#   * must not trust the caller's environment: paths are fixed, not overridable
#   * mcp.env is SOURCED, so write access to it is code execution — hence the mode check
set -eu

HOME_DIR="${HOME:-/home/azzar}"
SECRETS="$HOME_DIR/.config/hela/mcp.env"
ENTRY="${HELA_RUNTIME_ENTRY:-$HOME_DIR/.local/share/hela/installations/all-runtime/hela-runtime/dist/index.js}"
STATE_DIR="$HOME_DIR/.local/state/hela"
LOG_DIR="$STATE_DIR/logs"
LOG="$LOG_DIR/mcp-launcher.log"
MIN_FILE="$STATE_DIR/node-min-major"
DEFAULT_MIN=22

DATE=/usr/bin/date
WC=/usr/bin/wc
TAIL=/usr/bin/tail
MV=/usr/bin/mv
RM=/usr/bin/rm
MKDIR=/usr/bin/mkdir
STAT=/usr/bin/stat
CAT=/usr/bin/cat

log_fail() {
    [ -d "$LOG_DIR" ] || "$MKDIR" -p "$LOG_DIR" 2>/dev/null || true
    now="$("$DATE" -Is 2>/dev/null || true)"
    [ -n "$now" ] || now="unknown-time"
    if [ -f "$LOG" ]; then
        size="$("$WC" -c < "$LOG" 2>/dev/null || echo 0)"
        if [ "${size:-0}" -gt 524288 ]; then
            if "$TAIL" -c 262144 "$LOG" > "$LOG.tmp" 2>/dev/null; then
                "$MV" "$LOG.tmp" "$LOG"
            else
                "$RM" -f "$LOG.tmp"
            fi
        fi
    fi
    printf '%s pid=%s %s\n' "$now" "$$" "$1" >> "$LOG" 2>/dev/null || true
    printf 'hela-runtime-mcp: %s\n' "$1" >&2
}

[ -r "$SECRETS" ] || { log_fail "unreadable secrets file $SECRETS (expects 0600)"; exit 78; }
[ -f "$ENTRY" ] || { log_fail "runtime entry missing: $ENTRY"; exit 78; }

# The mode is enforced by the doctor; warn here because sourcing a readable file is
# the actual risk, and the host would otherwise never surface it.
env_mode="$("$STAT" -c '%a' "$SECRETS" 2>/dev/null || echo '?')"
case "$env_mode" in
    600) ;;
    *) log_fail "warning: $SECRETS is mode $env_mode, expected 600 (run the host doctor --repair)" ;;
esac

NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE_BIN" ] && [ -x /usr/bin/node ]; then
    NODE_BIN=/usr/bin/node
fi
[ -n "$NODE_BIN" ] || { log_fail "node not found on PATH (apt autoremove? run the host doctor --repair)"; exit 127; }

MIN="$DEFAULT_MIN"
if [ -r "$MIN_FILE" ]; then
    MIN_RAW="$("$CAT" "$MIN_FILE" 2>/dev/null || true)"
    case "$MIN_RAW" in
        ''|*[!0-9]*) ;;
        *) MIN="$MIN_RAW" ;;
    esac
fi

NODE_RAW="$("$NODE_BIN" -v 2>/dev/null || true)"
NODE_VERSION="${NODE_RAW#v}"
NODE_MAJOR="${NODE_VERSION%%.*}"
case "$NODE_MAJOR" in
    ''|*[!0-9]*)
        log_fail "cannot determine node version from $NODE_BIN (got '$NODE_RAW')"
        exit 127
        ;;
esac
if [ "$NODE_MAJOR" -lt "$MIN" ]; then
    log_fail "node $NODE_RAW is below required major $MIN (run the host doctor --repair)"
    exit 78
fi

set -a
. "$SECRETS"
set +a

exec "$NODE_BIN" "$ENTRY" "$@"
