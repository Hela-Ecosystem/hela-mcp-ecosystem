# On-demand runtime and canonical discovery

Runtime **1.2.0** implements §10.3: no cell starts during runtime startup or `tools/list`. The first call starts only its target; concurrent calls share that startup. Cells already started retain the existing crash/timeout supervisor. Standalone MCP servers are unchanged, all eight profiles remain supported, and the runtime default stays `dev-workspace`.

## One inventory, generated schemas and counts

`config/inventory.json` remains the source of cell paths, revisions, versions, environment declarations, and conditional tool features. `config/profiles.json` selects membership. Config generation, doctor, version verification, integration, and profile tests use the same inventory loader/path resolution.

The generated `config/tool-catalog.json` contains actual standalone MCP schemas, revision/version metadata, verified build digests, and feature variants. It is a derived artifact, not another server registry. Mitosis currently has four LLM/agent feature combinations; other cells have one schema variant. The generator enables registration flags only for discovery and never invokes model-backed tools.

Build outputs can differ between machines even at one source revision. Multiple digests are retained together only if fresh probes return identical schemas for every declared variant. New or changed conditional tool registration must declare its switches under the cell's `toolFeatures`; other relevant settings belong in its `env` list. Configuration changes require a new runtime instance.

Run from the ecosystem checkout after building the selected cells and runtime:

```bash
npm run catalog:generate -- --profile dev-workspace
npm run catalog:check -- --profile dev-workspace
./setup.sh doctor --profile dev-workspace --runtime
npm run test:profiles -- --profile dev-workspace
```

The installer refreshes selected-profile catalog entries when installing the runtime. Partial installations do not need unrelated hardware cells. An installation with all cells can omit the profile argument to generate/check all entries.

The same generator writes [profile-count documentation](generated-profile-counts.md) and `docs/site/data/tool-counts.json`. Counts include `hela.pipe` and the optional agent alias; they are feature-dependent ranges, not fixed totals copied into each client configuration.

## Cache isolation and stale metadata

The format-2 private cache separates ecosystem roots, profiles, and namespace modes. Per-cell fingerprints cover declared and actual revisions, build contents, effective feature flags, and declared environment settings. Cache files contain fingerprints and schemas only, not environment values. Atomic publication prevents partial reads.

Legacy, corrupt, and mismatched cache entries are ignored. A valid generated catalog supplies cold schemas without child processes. Missing/stale catalog entries are not advertised. Unknown calls do not scan other cells. Explicit `hela.pipe` routing can start an uncatalogued named cell and learn its schemas; regenerating the catalog restores full cold discovery.

Doctor validates selected paths/builds, real isolated MCP handshakes, package/inventory/snapshot versions and revisions, and—when `--runtime` is requested—exact catalog/tool agreement with zero discovery spawns. Hardware checks are limited to the selected profile and remain separate from MCP readiness. API-key checks report presence, never values or assumed provider readiness.

## Verification scope

- **32/32** runtime regressions pass on x86_64 Linux and native ARM, covering timeout recovery, lazy startup, 24 concurrent first calls, cache invalidation, profile/root/namespace switching, legacy/corrupt caches, explicit bootstrap, and shutdown. **41 fixture PIDs** per run were verified reaped.
- All eight profiles pass **16/16** namespace-off/on discovery/schema/routing checks. Discovery starts zero cells; only the safe Genome/Nucleus probes start those cells. Cold discovery, cold first-call, and warm-call durations are recorded in JSON output without asserting machine-independent latency limits.
- The **80** client-configuration combinations, four probe regressions, and four canonical inventory regressions pass. Default standalone integration now excludes the multiplexing runtime from collision comparisons.
- Eight additional runtime discovery checks cover all four Mitosis feature combinations in both namespace modes, without invoking model tools or starting cells. Doctor reports READY with cold catalog parity for all eight profiles.
- Reproducible Nix packages use Node 22.23.4 and pinned/fixed-output inputs on both Linux architectures. Runtime versions derive from package metadata.

These checks do not authenticate GUI ACP sessions, reconcile live vault conflicts, exercise Android/Blender hardware, invoke model providers, or complete deferred endpoint security. Lappy retains its ten-server roster; servy retains its eight-cell `dev-workspace` selection.
