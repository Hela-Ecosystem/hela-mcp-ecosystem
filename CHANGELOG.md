# Changelog

All notable changes to this project.

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
