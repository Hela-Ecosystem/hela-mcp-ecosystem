# HeLa MCP Ecosystem Troubleshooting & Diagnostic Guide

This guide provides systematic diagnostic procedures, error code explanations, and recovery workflows for the **HeLa MCP Ecosystem**.

![Blotcat wearing a hard hat, looking at a smoking server block while consulting a thick manual](../assets/blotcat-troubleshooting.jpg)

---

## 1. Fast Diagnostic Workflow: `setup.sh doctor`

Before manual debugging, always run the automated diagnostic health check:

```bash
./setup.sh doctor
# or
npm run doctor
```

To run diagnostics against a specific profile:
```bash
./setup.sh doctor --profile dev-workspace
```

To output machine-readable JSON:
```bash
./setup.sh doctor --json
```

For managed installations, select the installed `--mode` and profile, or use an explicit prefix:

```bash
./setup.sh doctor --prefix /path/to/prefix --json
./setup.sh doctor --url http://127.0.0.1:8080/mcp --json
```

The URL form checks an already-running HTTP endpoint, not its remote filesystem. See [installation modes](installation.md) for Docker, Nix, listener startup, and private client fragments.

### Understanding Diagnostic Output

* **`READY`**: Managed source/build/image identity and isolated MCP initialize/discovery checks passed. Runtime modes also check cold catalog parity and private HTTP discovery.
* **`DEGRADED` / server `ERROR`**: A required check failed; inspect the JSON report for its server/error. Pending installations, changed builds, missing interpreters/images, and bad MCP replies fail readiness and return nonzero.
* **Integration scope**: Discovery does not verify Playwright executables, Android/Blender bridges, provider credentials, GUI authentication, or arbitrary workspace access. Legacy unmanaged checkout diagnostics have a different report layout.

---

## 2. Common Issues & Recovery Procedures

### 2.1 Diagnostic Failure: Missing Entrypoint or Build Artifacts

**Symptom**: `[ERROR] Entrypoint file missing` or `dist/index.js not found`.

**Root Cause**: The TypeScript source code has not been compiled into JavaScript build artifacts.

**Fix**:
For a managed prefix, rerun the original setup command with the same mode/profile/prefix. Locked dependencies and selected builds are recreated and probed. Preserve dirty working-tree changes rather than resetting them. A pending marker is cleared only after successful verification.

For manually maintained sibling checkouts:
```bash
# Rebuild all 10 servers automatically
npm run build:all

# Or build a single server manually
cd <server-directory>
npm run build
```

---

### 2.2 Server Stdio JSON-RPC Hang or Crash

**Symptom**: `[ERROR] Exited early with code 1` or tool timeouts during execution.

**Root Cause**: Node module dependencies are missing, or environment variables are malformed.

**Fix**:
```bash
# Reinstall dependencies for the failing server
cd <server-directory>
npm ci
npm run build
```

Verify stdio responsiveness manually:
```bash
node <entrypoint-file>
# The process should listen on stdin without throwing an uncaught exception. Press Ctrl+C to exit.
```

---

### 2.3 Client Does Not Recognize Configured MCP Servers

**Symptom**: Cursor, Claude, Gemini, or Zed reports that tools are not available.

**Root Cause**: Configuration file was written to the wrong path, contains relative paths, or the client was not restarted.

**Fix**:
1. **Regenerate configuration with absolute paths**:
   ```bash
   ./setup.sh --reconfigure --prefix /path/to/prefix --client cursor --non-interactive
   ```
2. **Review and merge the printed private fragment into the correct client file**. Setup does not write these live files:
   * **Cursor IDE**: `cat ~/.cursor/mcp.json`
   * **Claude Desktop**: `cat ~/.claude.json`
   * **Gemini / Antigravity**: `cat ~/.gemini/antigravity-cli/mcp_config.json`
   * **OpenCode**: `cat ~/.config/opencode/opencode.json`
   * **Kilo CLI**: `cat ~/.config/kilo/config.json`
   * **Zed Editor**: `cat ~/.config/zed/settings.json`
   * **Codex / ChatGPT**: `cat ~/.codex/config.toml`
3. **Check reload behavior**: some clients require a restart; Zed can restart context servers immediately when settings are saved. Back up active memory/vault state before changing sync hooks. Never paste raw client configuration containing credentials into an issue or chat.

### Zed forwards a server that Codex already defines

The message `MCP server hela-… was not started, because the Codex config already defines an MCP server with this name` refers to the forwarded duplicate. It does not prove that Codex failed to start its native entry. `codex mcp list` inspects configuration, not connectivity; check MCP startup/discovery or an actual safe tool call separately.

Zed 1.27.0 forwards project context servers to external agents; native `agent.profiles.*.context_servers` controls are not a per-ACP forwarding switch. Do not remove shared top-level `context_servers` just to silence Codex warnings: native Zed and other agents may need them.

The installed codex-acp 2.5.0 supports an optional per-agent environment override:

```json
"env": { "DISABLE_MCP_CONFIG_FILTERING": "true" }
```

Place it under `agent_servers.codex-acp` only if deliberately choosing merged forwarded/native ownership. This disables adapter duplicate filtering, **not forwarding**; it can fail when future definitions disagree. Identical definitions passed isolated merge/discovery checks, but authenticated Zed ACP sessions still require verification. Keeping Codex-owned entries and leaving this toggle unset preserves native ownership, with the duplicate warning still possible.

Source references: [Zed forwarding](https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/agent_servers/src/acp.rs#L44-L65), [agent settings schema](https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/settings_content/src/agent.rs#L842-L904), and [adapter toggle](https://github.com/agentclientprotocol/codex-acp/blob/v2.5.0/src/CodexAcpClient.ts#L1620-L1623).

---

### 2.4 Pinned Snapshot Recovery & Rollback

**Symptom**: Upstream repository changes broke a server build or altered expected tool schemas.

**Root Cause**: Moving `main`/`master` branch contains unreleased or breaking changes.

**Fix**:
Restore known-good, audited release snapshot:
```bash
./setup.sh --snapshot v1.5.1 --profile dev-workspace --non-interactive
```

---

### 2.5 SQLite Database Lock or Corruption (`HeLa Genome`)

**Symptom**: `database is locked` or `SQLite error` in `project-mcp`.

**Possible causes**: Competing writers, a long transaction, permissions, filesystem failures, or a damaged database. A lock error alone does not prove corruption or missing WAL mode.

**Fix**:
1. Identify the actual database path and owning processes. Inspect integrity read-only:
   ```bash
   sqlite3 -readonly /absolute/path/to/memory.db "PRAGMA integrity_check;"
   ```
2. Take an online, validated backup that includes committed WAL data. Do not copy only the main file while SQLite is active; no daily-backup schedule is implied by the package.
3. Restore only to a new, absent destination with no SQLite sidecars, verify integrity, and review a controlled switchover. Never overwrite an active database. Preserve divergent Obsidian notes and existing conflict archives instead of choosing a winner automatically.

---

### 2.6 External Hardware Driver Issues

#### HeLa Receptor (Android / ADB)
* **Verify ADB availability**: `adb version`
* **Verify device connectivity**: `adb devices` (ensure device is authorized with USB debugging enabled).

#### HeLa Cytosol (Browser Automation)
* **Install Playwright browsers**:
  ```bash
  npx playwright install chromium
  ```

#### HeLa Plastid (Blender 3D)
* **Verify Blender CLI in PATH**:
  ```bash
  blender --version
  ```
* If installed outside standard PATH, create a symlink:
  ```bash
  sudo ln -s /path/to/blender /usr/local/bin/blender
  ```

---

## 3. Getting Further Support

* **Run Integration Tests**: `npm test` discovers the installed cells; use `-- --profile <id>` for a selected subset. Tool counts depend on enabled features.
* **Run Matrix Tests**: `npm run test:matrix` verifies 80 profile/client configuration combinations, not GUI authentication or hardware operations.
* **File an Issue**: Open an issue at [`Hela-Ecosystem/hela-mcp-ecosystem/issues`](https://github.com/Hela-Ecosystem/hela-mcp-ecosystem/issues) with reviewed/redacted output from `./setup.sh doctor --json` and the failed check. Do not attach private configs or environments.
