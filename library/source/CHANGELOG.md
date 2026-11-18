## [1.9.16] - 2026-11-19

### Fixed
- Runtime prose sat outside the single-sourcing pipeline: the architecture cards (EN and ID) and the on-demand guide said `1.2.1` while the inventory said `1.3.2`, and CI stayed green because the generator skipped the `hela-runtime` prose entirely. `generate-docs` now rewrites those sentences from the inventory, `docs:check` fails on drift (verified by deliberately reverting a mention), and a test covers both languages while keeping the dated Servy rollout record at the version it actually deployed.

## [1.9.15] - 2026-11-18

### Fixed
- The tmux provisioning tests inherited `CI` from `process.env`, so on GitHub Actions provisioning short-circuited to `skipped`/`ci` before any assertion: eight failures that only existed on CI. The fixtures now strip CI variables, and the CI-disable case keeps its own explicit test.

## [1.9.14] - 2026-11-18

### Added
- Mitosis `3.0.6` bundles the registry `pcb` skill (KiCad workflow, verification scripts, JLCPCB preparation, MIT licence preserved). The staged copy contained a duplicate of itself under `skills/pcb/pcb`; 3.3 MB removed so discovery sees one definition.

### Fixed
- Cytosol `3.2.3`: `BROWSER_HEADLESS` defaults to auto — headless without `DISPLAY`, headful with one, explicit values still winning. Display-less service processes could not launch Chromium before. `resolveHeadless` is exported and tested.
- Browser CI pins `ubuntu-24.04`; `ubuntu-latest` moved to 26.04 where `playwright install --with-deps` exits without a Chromium build.
- Runtime `1.3.2` refreshes the Nix `npmDepsHash` after the version bump.

## [1.9.13] - 2026-11-18

### Fixed
- Every cell and the runtime now single-source the advertised MCP version in one module, guarded by a test against `package.json`. Six cells had shipped a stale `ServerInfo` this way (nucleus, enzyme, phenotype, receptor, cytosol, plastid), and a deliberate drift in mitosis was verified to fail its suite.

## [1.9.12] - 2026-11-18

### Added
- Hardware and live-service validation: receptor `3.0.4` makes the device integration suite runnable (it spawned a non-existent entrypoint) and passes 18 checks on a Pixel 8 — UI hierarchy, element discovery, app lifecycle, rotation, screen recording, session, screenshot, tap/swipe, clipboard.
- `npm run test:browserless` validates a remote Browserless instance with local fallback disabled; `npm run test:blender` drives the Blender bridge (scene, in-Blender code execution, object details); `npm run test:fallback` proves the search degradation chain with an invalid provider key.
- Scrcpy parses the `SET_CLIPBOARD` acknowledgement frame instead of resetting the buffer on it.

### Known limitations
- The remote Browserless context can be closed between calls; `browser_health` reports it but there is no automatic reconnect.
- Headless Blender reports a render path without writing a file; rendering still needs a GUI session.

## [1.9.11] - 2026-11-18

### Fixed
- Receptor `3.0.3`: the hardware integration harness spawned a non-existent entrypoint, so `npm run test:integration` could never pass; it now runs 18 checks against a real Pixel 8 (UI hierarchy, element discovery, app lifecycle, rotation, screen recording, session, screenshot, tap/swipe, clipboard).

### Changed
- Repins Receptor and publishes the `v1.9.11` snapshot.

## [1.9.10] - 2026-11-18

### Added
- `npm run test:acp` drives the Zed Codex adapter over ACP (`initialize` → `session/new` → `session/prompt`) and passes only on a real text reply, so the authenticated ACP session is verified without the GUI.

### Fixed
- Documented why the registry Codex adapter failed with `model_not_found` for every model: the bundled adapter (`codex-acp` 0.11.1) carries a Codex core older than the account's model list. `@agentclientprotocol/codex-acp` 2.7.0 works with the same ChatGPT login; the guide shows the custom `agent_servers.codex-acp` entry and the manual troubleshooting signature.

## [1.9.9] - 2026-11-18

### Added
- Mitosis `3.0.4` splits `terminal.execute` into one-shot execution (Nucleus) and `terminal.session` (Ribosome), so planning can tell "run pytest" from "drive a tmux session".
- Runtime `1.3.1` adds structured per-cell logs, per-cell start/restart/failure/tool counters on `/healthz`, and separate `/livez` and `/readyz` endpoints.

### Changed
- Ribosome `3.1.0` gains `npm run test:remote`, a live integration test for the ssh transport (spawn, tmux, reattach, kill on close, transport exit kind) verified against `servy`.
- Repins the coordinated `v1.9.9` snapshot; `latest-stable` moves to it.

## [1.9.8] - 2026-11-18

### Changed
- Repin every changed cell in `config/inventory.json` and publish the coordinated `v1.9.8` snapshot: Nucleus `3.0.3`, Ribosome `3.1.0`, Membrane `3.0.2`, Enzyme `4.0.2`, Receptor `3.0.2`, Plastid `3.0.2`, Phenotype `3.0.3`, and Mitosis at the mema-vault backup commit.
- Regenerate `config/tool-catalog.json` and the per-cell canonical tool references from the new pins; the catalog still advertises 292 base tools across ten cells.
- Sharpen the advertised versions that had drifted from `package.json`: Nucleus reported `3.0.2`, Enzyme's legacy entrypoint reported `4.0.1`, and Phenotype reported `3.0.2` from both the MCP server and export metadata.

# Changelog

All notable changes to this project.

## [1.9.7] - 2026-11-18

- Provision tmux for Nucleus/Ribosome profiles with `HELA_SYSTEM_DEPS_INSTALL=1` as an explicit noninteractive opt-in, still blocked by CI, failed sudo checks, and `--without-system-deps`.
- Report optional tmux readiness as a doctor warning and cover a Nucleus profile install plus doctor run in CI without changing system packages.
- Sweep runtime facades, pin the 292 cell-schema metric definition, generate the installer flag reference, and add a reproducible persona/discovery payload measurement script.

## [1.9.6] - 2026-11-15

### Added
- Bundle Google Chrome's Modern Web Guidance skill in Phenotype 3.0.3, pinned to upstream release `v1.0.0`, CLI package `1.0.0`, and corpus `2026_11_09-5bcc021b`.
- Add a dedicated prebuilt-skills catalog showing server ownership, availability in all eight profiles, and the install/sync lifecycle.
- Publish the coordinated `v1.9.6` snapshot and advance `latest-stable` to the new Phenotype revision.

## [1.9.5] - 2026-11-15

- Clarify that Frea and Mema are Azzar's personal AI assistant personas and that the distributable HeLa persona carries their documented operating principles without copying private state.

## [1.9.4] - 2026-11-15

- Install a complete profile-aware HeLa persona on a clean workspace, blending Frea's autonomous execution with Mema's security and operational discipline.
- Preserve existing `agent_persona/`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` files instead of overwriting a user's persona.

## [1.9.3] - 2026-11-15

- Bundle the registry `pcb` skill through HeLa Mitosis so selected profiles receive KiCad schematic, layout, routing, independent verification, and fabrication-preparation guidance through the normal skill-sync path.
- Document the recommended PCB workflow across Mitosis, Genome, Membrane, Nucleus, Cytosol, and Enzyme; no PCB project files, credentials, browser state, or personal paths are distributed.
- Publish Phenotype `3.0.2` with the research-backed `brand-architecture` skill and refresh the reproducible `latest-stable` pin to its new commit.

## [1.9.2] - 2026-11-14

### Added
- Make Needle and Mirage installer capabilities profile-aware: every canonical profile provisions Needle through Mitosis, while profiles containing Cytosol provision the managed Mirage Python bridge automatically.
- Add checksum-verified Windows x64/ARM64 Needle assets so native Windows profiles receive the same local agent capability without manual path configuration.
- Pass the managed Mirage and Windows-compatible Needle paths through launchers and generated configurations, and validate Mirage readiness in `doctor`.
- Publish Terminal/Nucleus `3.0.2` with checksum-verified user-local RTK bootstrap on Linux, macOS, Windows, and Windows ARM64.
- Move `latest-stable` to the coordinated `v1.9.2` snapshot while retaining `v1.9.1` unchanged.

### Fixed
- Align the mutable `latest-stable` metadata and generated Cytosol catalog with the current post-release documentation commit without rewriting the immutable `v1.8.0` snapshot.

## [1.9.1] - 2026-11-14

### Fixed
- Refresh every canonical cell and runtime revision to the latest validated default-branch commit.
- Publish the coordinated `v1.9.1` snapshot while retaining the immutable `v1.9.0` release.

## [1.9.0] - 2026-11-14

### Added
- Add a cross-platform Node update controller with read-only snapshot checks, explicit confirmation for apply, rollback records, and doctor verification.
- Add opt-in check-only schedules for systemd user timers, launchd agents, and Windows Task Scheduler; automatic checks never apply updates.
- Expose `hela.update.check` and confirmation-gated `hela.update.apply` through the profile-aware runtime agent catalog.
- Publish the immutable `v1.9.0` snapshot with runtime `1.3.0`.

## [1.8.0] - 2026-11-13

### Added
- Upgraded HeLa Cytosol to `3.2.0` with dedicated image analysis through local paths, safe HTTP(S) URLs, and base64 image input.
- Added the full Mirage VLM pipeline to the catalog: scene understanding, OCR, object detection, segmentation, spatial relations, and schema-based decisions.
- Published the reproducible `v1.8.0` snapshot and moved `latest-stable` to the dedicated-image release.

## [1.7.0] - 2026-11-13

### Added
- Upgraded HeLa Cytosol to `3.1.0` with first-class Mirage visual intelligence.
- Added lazy local model acquisition, managed Cactus runtime setup, and the `browser_visual_analyze` capability to the canonical catalog.
- Published the reproducible `v1.7.0` snapshot and moved `latest-stable` to the new Cytosol release.

## [1.6.4] - 2026-11-13

### Fixed
- Updated the `latest-stable` snapshot alias to the coordinated 1.6.3 cell and runtime release pins.

## [1.6.3] - 2026-11-13

- Add Node-first and PowerShell/CMD installer, updater, build, test, and clean entrypoints; retain Bash files as compatibility shims.
- Allow unsupported pinned Needle platforms to complete installation with an explicit runtime fallback instead of aborting the whole ecosystem install.

## [1.6.2] - 2026-11-08

- Adopt the Dependabot-updated Plastid and Receptor lockfiles, clearing the open MCP SDK and `@hono/node-server` advisories.
- Replace Plastid's `"@modelcontextprotocol/sdk": "latest"` with a caret range so future lock refreshes are reviewable instead of silent.
- Plastid keeps 12 passing regressions and `npm audit` reports zero vulnerabilities; Receptor keeps 123 passing tests.
- Cell versions and every other pin are unchanged from 1.6.1.

## [1.6.1] - 2026-11-08

- Add `setup.sh mode` to convert an existing managed installation between `individual`, `runtime`, `docker`, `docker-runtime`, and `nix` in place.
- Reuse cells already built at the pinned revision, preserve `data/` and the profile/snapshot, and verify the converted installation with doctor before reporting success.
- Restore the previous manifest and leave a pending marker when verification fails; refuse pending, unmanaged, or unchanged targets.
- Cover host-family switching, transport guards, pending markers, and Docker round-trips in tests and CI. Enzyme, runtime, and other cell pins are unchanged from 1.6.0.

## [1.6.0] - 2026-11-08

- Pin Enzyme 4.0.0, whose `google_search` now requires `query`. The old `q` argument is rejected rather than translated; batch tools keep `queries`.
- Share one strict search schema between Enzyme's shipped and modular entrypoints: trimmed non-empty queries, integer result counts from 1 to 10, unknown fields refused before any provider request.
- Add `setup.sh mode` to convert a managed installation between individual, runtime, Docker, Docker-runtime, and Nix in place, reusing verified builds and preserving data directories.
- Regenerate the canonical tool catalog and documentation from the new Enzyme schema. Tool counts and all other cell/runtime pins are unchanged.
- Preserve every historical snapshot from v1.0.0 through v1.5.3.

## [1.5.3] - 2026-11-07

- Render Genome relation links in canonical order so replicas with different SQLite insertion orders produce identical notes.
- Add an insertion-order regression; all 19 suites / 264 tests, the TypeScript build and zero-warning source lint pass.
- Preserve the published 1.5.2 snapshot and all other cell/runtime pins.

## [1.5.2] - 2026-11-07

- Pin Genome's replicated vault timestamp/order convergence fix and explicit archived repair API; ordinary CLI sync still leaves divergent notes unresolved.
- Replace Genome's unsafe `any` types with typed database results and validated request/import boundaries. Source lint now covers top-level files and fails on warnings; 19 suites / 263 tests and the TypeScript build pass.
- Retain the managed individual/runtime/Docker/Nix installer and doctor shipped after 1.5.1; its mechanism acceptance remains documented separately.
- Keep all other cell/runtime pins and historical versioned snapshots unchanged. No vault content, credentials, or operational backups are included in this source snapshot.

## [1.5.1] - 2026-11-06

- Refresh current EN/ID web pages, setup/integration/troubleshooting guides, and all ten cells' version/tool references from canonical metadata.
- Validate generated documentation, local links/anchors, and browser configuration previews before Pages publication.
- Refresh sanitized client examples and document deferred security, provider/hardware validation, SQLite safety, and optional Obsidian mirroring accurately.
- Pin documentation-only cell commits in a new immutable snapshot. Cells remain 3.0.0; runtime remains 1.2.0. Historical snapshots, vendor versions, and live services are unchanged.

## [1.5.0] - 2026-11-06

- Pin runtime 1.2.0 with true first-call startup and profile/build/config-aware schema caching.
- Generate standalone schema catalogs and documentation counts from canonical inventory metadata and isolated feature-variant probes.
- Share inventory validation/path resolution across config, doctor, version, profile, and integration tooling; verify runtime catalog parity without child startup.
- Measure cold/warm routing across all profiles; retain standalone compatibility and machine selections.

## [1.4.0] - 2026-11-06

- Pin current published cell/runtime revisions in a new snapshot; retain v1.0.0–v1.3.0 unchanged and correct runtime snapshot metadata to 1.1.0.
- Include Genome memory safety, atomic claims, runtime timeout recovery, and clean-install Zod 4 compatibility fixes.
- Replace process-alive smoke checks with isolated MCP initialize/tool discovery and strict version/pin agreement.
- Correct Codex TOML to `mcp_servers`, escape generated values, and verify the 80-combination configuration matrix.
- Record native x86_64/aarch64 Linux Nix builds separately from client authentication, hardware testing, and unresolved vault conflicts.

## [3.0.0] - 2026-10-31

### Changed
- **Version reset to 3.0.0** — per-server version metadata baseline reset (Phase 7). All `package.json`, MCP `ServerInfo.version`, and HTTP metadata now report `3.0.0`. This is a metadata/interface baseline reset; for `hela-plastid` it is not an upgrade from the previous `4.2.0` advert.
