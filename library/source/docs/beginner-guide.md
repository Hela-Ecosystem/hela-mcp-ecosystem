# Beginner's Guide: HeLa MCP Ecosystem

![Blotcat beginner setup](../assets/blotcat-beginner.jpg)

HeLa connects an AI client to tools for memory, files, commands, research, design, browsers, Android, and Blender. Install only the profile you need. Tools can change files and run commands with the server account's privileges; review your client's permissions before use.

Current software versions are listed in [current versions](current-versions.md). Setup time depends on dependencies and downloads; browser and hardware workflows need extra software.

## Requirements

- Node.js **22 LTS** is the tested full-stack environment. Enzyme requires at least 20.18.1; Receptor requires 22. Individual packages can declare different standalone engine ranges.
- Git and a terminal. Use a POSIX shell on Linux/macOS or WSL on Windows for `setup.sh`.
- Optional capabilities: Chromium/Playwright for browser work, ADB and a device for Android, and the Blender bridge for 3D.

## Install a profile

```bash
git clone https://github.com/Hela-Ecosystem/hela-mcp-ecosystem.git
cd hela-mcp-ecosystem
./setup.sh --profile dev-workspace --client opencode --non-interactive
```

Change the client to `cursor`, `claude`, `gemini`, `antigravity`, `kilo`, `zed`, or `codex` as appropriate. The installer prints its managed prefix and a private client fragment: review and merge that fragment into your client settings. It does not overwrite existing client files or reuse your working repositories. Run `./setup.sh` without flags for interactive profile/mode/client selection.

All eight profiles are supported:

- `minimal`: three research/memory cells.
- `dev-workspace`: eight development/browser/design cells; runtime default.
- `headless-server`: seven cells without browser/device dependencies.
- `research`: five research/browser/workspace cells.
- `web-devops`: six frontend/browser/design cells.
- `android-testing`: five cells including device control.
- `3d-modeling`: five cells including Blender.
- `all`: all ten cells.

See [profiles](profiles.md) for membership. Your selection is independent of other machines: lappy's ten-cell roster and servy's eight-cell roster are examples, not required configurations for everyone.

## One connection or separate servers

The installer normally configures separate MCP servers. Add `--runtime` to keep the same profile behind one endpoint:

```bash
./setup.sh --profile dev-workspace --client opencode --runtime --non-interactive
```

Runtime is a serve mode, not a profile named `runtime`. Its catalog advertises schemas without starting cells; a first call starts only its target. [Runtime details](on-demand-runtime.md) explain catalog generation, missing metadata, and recovery.

Other mechanisms are `--mode docker` (separate containers), `--mode docker-runtime` (one runtime container), and `--mode nix` (pinned toolchain and packaged runtime). Runtime modes also support `--transport http`. See [installation modes](installation.md) for exact requirements and commands; Docker needs a working daemon, and HTTP listeners are started explicitly.

## Optional keys

OpenRouter, GitHub, and Google keys are optional for discovery and keyless capabilities. Keyless does **not** mean every operation is offline: web research and external design services still need network access, and generative-model features require their configured provider or local engine. See [keys and services](keys-and-secrets.md).

Generated configuration can contain credentials you explicitly provide. Keep it private, and do not paste the complete file into a chat or issue.

## Verify the selected installation

```bash
./setup.sh doctor --profile dev-workspace
# If installed through the runtime:
./setup.sh doctor --profile dev-workspace --runtime
npm run test:matrix
```

Doctor checks selected paths, versions, revisions, and actual isolated MCP replies. Runtime checking also verifies catalog parity and zero discovery startups. The configuration matrix checks 80 profile/client combinations; it does not log in to GUI agents or exercise hardware.

For an explicit prefix, use `./setup.sh doctor --prefix /path/to/prefix`. For Docker or Nix defaults, select the same `--mode` and profile as installation. `doctor --url http://127.0.0.1:8080/mcp` checks a running HTTP endpoint; it does not inspect remote source revisions.

On a full ten-cell checkout you can also run `npm test` and `npm run test:profiles`. On a partial checkout use `npm run test:profiles -- --profile <id>`. Missing unselected hardware repositories are not a reason to change your machine's profile.

Reload the relevant client deliberately after reviewing configuration changes. Some clients, including Zed, can auto-reload servers when settings are saved. Do not change live vault hooks or restart unrelated clients merely to silence a warning. See [integration](integration.md) and [troubleshooting](troubleshooting.md).
