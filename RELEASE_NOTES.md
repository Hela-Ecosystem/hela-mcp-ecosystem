# HeLa MCP Ecosystem Release Notes

## v1.5.1 — current documentation and bilingual website

Documentation-only refresh: all ten cells remain **3.0.0**, and runtime remains **1.2.0**. The new source snapshot pins the documentation commits without rewriting v1.0.0–v1.5.0. Plastid and Receptor documentation was merged into their default branches without discarding unrelated dependency updates; the snapshot deliberately pins the documentation-only parents, not those dependency changes.

The EN/ID website now loads generated versions, canonical tool names, and profile metadata. Configuration previews use real repository directories and Codex `mcp_servers` sections. Source guides cover all eight profiles, cold discovery, optional integrations, safe backup/restore, and the limits of current verification. Generated private configurations may contain supplied credentials; committed examples are regenerated with a sanitized environment.

Documentation checks cover 74 regression cases plus local links/anchors and structured metadata; the CLI matrix covers 80 combinations. Browser verification covers 64 visible selections per language and all 16 pages at desktop/mobile widths. These are documentation/UI checks, not new authenticated ACP, provider, Android, or Blender acceptance. Publication does not restart the runtime or change deferred access controls, credentials, databases, or vault conflicts.

## v1.5.0 — on-demand runtime and canonical discovery

Runtime **1.2.0** starts cells only when invoked, shares concurrent startup attempts, and discovers schemas without spawning cells. Revision/build/config-aware caches reject stale entries; legacy/corrupt caches fall back to a validated generated catalog. Unknown calls no longer start unrelated cells. Standalone servers, all eight profiles, and the `dev-workspace` default are preserved.

The canonical inventory drives config generation, doctor/version/profile checks, schema catalogs, and generated documentation counts. Doctor can verify exact runtime discovery with no cell startup via `--runtime`. A new immutable v1.5.0 snapshot pins runtime `9c92dbf`; older versioned snapshots are unchanged.

Verification: **32** runtime regressions on both Linux architectures, **16** all-profile namespace-mode checks, **80** client configurations, four probe regressions, and four inventory regressions. Cold/warm measurements are recorded, not treated as universal benchmarks. See [implementation and verification scope](docs/on-demand-runtime.md). ACP authentication, external client reloads, gateway retirement, vault conflict review, hardware/provider integrations, and deferred security remain separate work.

**Servy rollout verified:** public/local discovery exposes 236 tools without starting any cells; the first safe Nucleus call starts only Nucleus. Deployed doctor, catalog, and revision checks pass. Fresh backups and rollback material are retained, and all 633 existing conflict archive files are unchanged. See the [rollout evidence](docs/on-demand-runtime.md#verified-servy-rollout).

## v1.4.0 — memory safety and runtime verification

The v1.4.0 source snapshot pins the published cell revisions and runtime 1.1.0. Older versioned snapshots are unchanged. `latest-stable.json` tracks this source snapshot, not a guarantee that every optional integration or GUI session has been exercised.

- Genome: 19 suites / 242 tests with clean lockfile dependencies, including WAL-safe backups, isolated restore, vault conflicts, repeated imports, and exclusive mission claims.
- Runtime: 20 isolated fault tests covering hung children, SIGTERM/SIGKILL, actual process exit, one restart, profile/cache boundaries, and shutdown cleanup.
- Nix: real Node 22 package builds on x86_64-linux and native aarch64-linux, using pinned inputs and fixed-output npm dependencies.
- Dependencies: clean-install Zod 4 build fixes in Genome and Enzyme; Enzyme's 79 tests and Phenotype's 74 tests pass.
- Ecosystem: ten isolated standalone MCP handshakes and 80 configuration-generation combinations pass. Codex TOML now uses `mcp_servers` and is accepted by the native parser. These are not authenticated GUI tests.
- Discovery: 290 standalone tools with LLM and model-backed agent features disabled; the same isolated `dev-workspace` runtime exposes 230 tools including `hela.pipe`. Feature-enabled deployments can expose additional Mitosis tools and the optional agent alias; query `tools/list` rather than assuming a static total.

Known limits: Zed/Codex ACP authenticated-session verification remains pending; duplicate ownership warnings do not establish a connection failure. Existing live vault conflicts remain archived for deliberate review. Android/Blender discovery is not hardware integration. Endpoint authentication and credential rotation remain operator work, not changes included in this release.

**Servy deployment verified (2026-11-06):** the rooted ARM Nix package serves the eight-cell `dev-workspace` profile under systemd. Local/public discovery returns 236 live tools, versus 230 in feature-disabled probes; all three Genome mission tools are present. Deployed doctor and strict version/pin checks pass. Existing conflict archives and unrelated client processes were preserved. See [deployment evidence and remaining client/gateway work](docs/deployment-2026-11-06.md).

**All-profile follow-up (2026-11-06):** all eight profiles pass runtime startup/discovery, exact tool/schema parity, and safe read-only routing in both namespacing modes (**16/16** checks). All ten standalone cells plus runtime pass strict version/pin verification; the 80 client-configuration combinations and four probe regressions pass. Machine selections and release snapshots are unchanged. See [profile verification](docs/profile-verification-2026-11-06.md).

## Historical v1.0.0 notes

We are proud to announce the official **v1.0.0** release of the **HeLa MCP Ecosystem** — a modular, immortal cellular AI tooling stack built on the Model Context Protocol (MCP), engineered by Azzar.

---

## Architectural Vision & Metaphor

The **HeLa MCP Ecosystem** is named in respectful recognition of **Henrietta Lacks** (1920–1951) and the enduring scientific legacy of HeLa cells. Using a **cellular biology metaphor**, the ecosystem organizes 10 specialized MCP servers into a harmonious organism:

* **Cellular Specialization**: Distinct organelles (Nucleus, Membrane, Enzyme, Ribosome, Plastid) perform targeted domains.
* **Deterministic Immortality**: Environments can be snapshot-pinned (`config/snapshots/v1.0.0.json`) and restored cleanly on any machine.
* **Repository Independence**: Underlying source repositories, technical package names, and Git commit histories remain 100% autonomous.

---

## Key Highlights & Milestones Delivered

### 1. Dual-Backbone Architecture
Every profile is grounded by two core backbones:
* **HeLa Mitosis (`chaining-mcp`)**: Cellular division and orchestration backbone. Bundled Needle 3 agent runtime (plan → execute → observe, offline-first), Needle-backed sequential reasoning (`sequentialthinking`, `agent_run`), task decomposition, and 40 domain prompts. No external sequential-thinking server.
* **HeLa Genome (`Project-Guardian-mcp-server`)**: Living memory and state backbone. SQLite knowledge graph (`memory.db`), entity-relation tracking, cross-session context restoration, and decision memory.

### 2. 10-MCP Component Taxonomy
* **HeLa Membrane** (`filesystem-mcp-server`): Sandboxed workspace filesystem operations and search.
* **HeLa Nucleus** (`terminal-mcp-server`): Isolated command execution with RTK token optimization.
* **HeLa Ribosome** (`menager-mcp-server`): Interactive PTY session multiplexing and Regex hook engine.
* **HeLa Enzyme** (`research-assistant-mcp-server`): Unified Google Custom Search + Wikipedia caching.
* **HeLa Cytosol** (`Browser-Agent`): Playwright browser automation and DOM accessibility perception.
* **HeLa Phenotype** (`the-designer`): UI/UX design tokens, OKLCH palettes, and Tailwind component synthesis.
* **HeLa Receptor** (`scrcpy-mcp`): Android mobile automation via ADB bridge.
* **HeLa Plastid** (`ll3m-agent`): Autonomous Blender procedural 3D modeling and rendering.

### 3. Diagnostic Health Checker (`setup.sh doctor`)
Comprehensive automated diagnostic tool auditing host prerequisites (Node.js >=18, Git, SQLite3), server builds, commit pins, stdio JSON-RPC smoke readiness (<300ms), external runtimes (Playwright, ADB, Blender), and zero-key offline fallback modes.

### 4. 70-Combination Multi-Client Matrix (`npm run test:matrix`)
Full verification across all 10 client backends (Cursor, Claude, Gemini, Antigravity, OpenCode, Kilo, Zed, Codex TOML, Docker Compose, Skip) and 7 agent profiles with 100% schema accuracy.

### 5. Master Integration Test Suite (`npm test`)
Automated stdio JSON-RPC handshake and tools discovery across all 10 servers (**295 active tools discovered and validated in 2.5s**).

### 6. Interactive Documentation Website (`docs/site/`)
Modern, responsive documentation landing site featuring:
* Interactive live Client & Profile Configurator.
* Video showcases & embedded YouTube demos.
* Uploaded Asciinema terminal casts.
* Searchable 10-MCP Cellular Taxonomy directory.

---

## Quick Start

```bash
git clone https://github.com/Hela-Ecosystem/hela-mcp-ecosystem.git
cd hela-mcp-ecosystem
./setup.sh doctor
./setup.sh
```

---

## Documentation

* [Beginner's Step-by-Step Guide](docs/beginner-guide.md)
* [Architecture Guide](docs/architecture.md)
* [Cross-MCP Workflows A–F](docs/workflows.md)
* [Security & Reliability Audit](docs/security-audit.md)
* [Troubleshooting Guide](docs/troubleshooting.md)
* [Keys & Secrets Matrix](docs/keys-and-secrets.md)

---

## License & Attribution

Distributed under the MIT License. Developed by Azzar.

The HeLa project respectfully recognizes **Henrietta Lacks** and the enduring scientific legacy of HeLa cells.
