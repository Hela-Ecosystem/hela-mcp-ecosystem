# HeLa MCP Ecosystem Release Notes

## v1.11.7 — one wording fix

Cytosol 3.3.3 rewrote `browser_search`'s description and lost the word
"restricted", which the ecosystem boundary check asserts. The phrase is back and
the cell repinned; behaviour is identical to 3.3.3.

## v1.11.6 — crashes and clocks

Two cells: the browser's new-tab switch crashed on every call and its catalogue
search returned nothing, while genome wrote a fabricated year into harness
timestamps and read `[TAG]` as a date. Both fixed with tests that reproduce the
reported inputs.

## v1.11.5 — derive the tool count, do not retype it

Cytosol gained a tool in 3.3.2, and a hand-written "75 tools" in the site copy
and `llms.txt` failed the docs job. Both the prose and the test now take the
count from the generated catalog.

## v1.11.4 — consent, claims and citations

Three places where a tool acted on the caller's behalf without asking: a
JavaScript `confirm()` was auto-accepted, a mission could be completed by an
agent that did not hold it, and a citation dropped two of three authors. Dialogs
now default to dismiss with an explicit override and a history, missions have
claimant-checked transitions with a lease and an explicit requeue, and citations
follow each style's author rules.

Carries 1.11.3.

## v1.11.3 — Nix hash for the 1.4.1 runtime

The 1.4.1 release changed the package version, which is part of the npm deps
derivation input, so the fixed-output hash stopped matching and the Nix verify
job failed on 1.11.2. The hash is refreshed and the runtime repinned at
`14cc13e`; behaviour is identical to 1.11.2.

## v1.11.2 — a result can now say "degraded"

`hela.pipe` reports `status: ok | degraded | failed` next to `ok`, each step
carries its own status, and a degraded step contributes a reason. A tool that
truncates, filters or substitutes sets that marker; the pipe surfaces it instead
of a clean success. Mitosis 3.1.1 is the first cell to adopt it (`get_skill`).

The nine false-success instances in #8 were already fixed one by one. This
release turns the pattern into a shape that can be tested, documented in the
runtime as `docs/response-contract.md`.

Carries 1.11.1; runtime 1.4.1.

## v1.11.1 — the follow-ups 1.11.0 exposed

Four cells needed a second pass: a deletion that survived project sync but not
central sync, sentiment that still read "never recommend" as praise, tool
payloads sitting in a field MCP clients drop, and React components that ignored
their props. Each fix ships with the test that failed without it.

Carries 1.11.0; runtime unchanged.

## v1.11.0 — six cells that stop guessing

Every fix in this release removes a claim the tool could not support. Trends no
longer call result-page counts "interest". Planners name the tool they will call
or say why they cannot. Analysis tools return `null` instead of a constant.
Cookies are the active page's, redacted. A deleted entity stays deleted. A scan
leaves the database's WAL locks alone, so a write after a scan is not lost.

The rest are failures that were invisible to callers: an orchestrator reporting
failed steps as completed, an agent loop recording `success:false` as `ok:true`,
a `complete` decision with no successful call, dialogs auto-accepted, payloads
dropped because they sat in a non-standard field. Each now says what happened.

Carries 1.10.10; runtime unchanged at 1.4.0.

## v1.10.10 — phenotype measures what it claims

Three of the five fixes in Phenotype 3.1.0 are about claims the tools could not back up.

`design_audit` flagged inline contrast only when the colour strings were identical, so
white-on-white (1.01:1) and yellow-on-white (1.07:1) passed and the page graded A/96. It now
computes WCAG relative luminance; the same page grades B/75 with measured issues. Palette
variants no longer add saturation to greys (an undefined hue was read as red, turning
`#767676` into `#816a6a`), the High Contrast variant names the surface its AAA claim is
measured against, and the derived focus token is clamped into sRGB instead of being emitted
outside it.

The fifth is a surface fix: the five Stitch tools that need the CLI are advertised only when
the CLI resolves — 23 tools instead of 28 on a host without it, with
`HELA_PHENOTYPE_STITCH` to override either way.

Carries 1.10.9; runtime unchanged.

## v1.10.9 — the Nix pin catches up with the runtime fix

Bumping the runtime to 1.4.0 changed the npm-deps derivation input, so `flake.nix`'s
fixed-output hash no longer matched. The runtime repository fixed it; the ecosystem still pinned
the older revision, so the installer and the clean-install CI job kept building the stale tree
and failing at hash verification.

This release pins the corrected revision. Nothing changes at runtime — the runtime code is
identical; only the Nix dependency hash moves.

## v1.10.8 — scoring weights that actually compute

`research_brief` scored candidates without a corpus, so the IDF half of the scorer never
engaged: every term kept a uniform weight and only morphological folding applied. Enzyme
4.2.2 builds the corpus from the pages it returned, so a term present in every title
contributes almost nothing and a rare one carries the match.

Carries 1.10.7; runtime unchanged.

## v1.10.7 — the enzyme fix that actually ships

The backoff and feedback work released as 4.1.0/4.2.0 compiled into
`src/combinedMcp.ts`, while the executable entry (`dist/index.js`) loads the root
`research-server.ts`, which carries its own `research_brief`. Unit tests passed, the pin
said 4.2.0, and the deployed cell still behaved like 4.0.9 — no backoff, no feedback
handle, no spool writes.

Enzyme 4.2.1 ports all three into the entry production runs, and corrects the trigger:
backoff now fires when the **ranked** result is empty, since pages that all fall below the
relevance floor still read as "No results from any source".

Found by verifying the deployed cell end to end after the previous release, not by the test
suite, which exercises the other entry. Carries 1.10.6; runtime unchanged.

## v1.10.6 — pipe stops lying about success

`hela_pipe` exists so intermediate results never pass through the model, which means the
model cannot see a step failing — the runtime is the only thing positioned to notice, and it
did not. A three-step chain with a failed middle step returned `ok: true` and then fed the
error string to the next tool, which produced a plausible keyword analysis of `ENOENT`.

Runtime 1.4.0 makes the pipe fail closed: `ok` reflects every step, `failedStep` names the
first failure, `onError` defaults to `stop` (with `continue` for deliberate best-effort), each
result carries its own `ok`, and `{{prev}}` is unset after a failure instead of carrying the
error onward. The next step's payload is now the parsed result rather than the MCP envelope.

The default change is breaking on purpose — a caller checking `ok` was getting an answer that
was wrong. Cells carry forward from 1.10.5.

## v1.10.5 — membrane answers match what happened

Four tools in the filesystem cell returned a shape that promised more than the code did.
Ranged reads split UTF-8 characters and lost them at every chunk edge; extraction dropped
path-traversal entries silently and called the remainder a success; `watch_file` started a
watcher whose events were discarded on return; `compare_files` measured characters where the
rest of the cell measures bytes.

Membrane 3.0.6 fixes the four: boundary-snapped ranges with `startByte`/`endByte`, extraction
that lists every skipped entry and why, buffered watch events collected by polling (and a
wait for chokidar's initial scan), and bytes plus a separate `characters` field.

Carries 1.10.4. Runtime unchanged at 1.3.7.

## v1.10.4 — the priors loop is closed

The adaptive ranking mechanism had been built and never fed. Enzyme observed which source
produced a result a caller actually used, but could not write the table; genome owned it and
nothing called the writer.

Enzyme 4.2.0 now appends one record per observed follow-up to a spool file, with the display
rank so position bias stays visible. Genome 3.0.7 drains that spool into `source_feedback` on
the next `search_priors` or `search_feedback` call: claimed by rename so two processes cannot
import the same line twice, malformed lines skipped, failed inserts put back for a later pass.

The header still reports `priors: static` until five samples accumulate per class — that is
the system being honest, and now it can stop being honest.

Carries mitosis 3.0.9, nucleus 3.0.7 and enzyme's query/scoring work. Runtime unchanged.

## v1.10.3 — Mitosis can see the organism again

Under `--mode runtime` the cells sit behind one endpoint, so Mitosis's config-based peer
discovery found none of them and `validate_tool_chain` rejected every real tool. It now also
reads the runtime's generated `config/tool-catalog.json`, which already knows each cell's
tools and is revision-validated at build time. Verified against the installed catalog: ten
cells, 299 tools.

Availability is three-state rather than two: a discovered server missing a tool is an error,
a server that was not discovered is a warning ("could not be verified"), and a run with no
catalog produces one warning instead of one error per step. The previous behaviour failed in
the direction that discards correct plans.

Carries the nucleus 3.0.7 and enzyme 4.1.0 fixes from 1.10.2. Runtime unchanged at 1.3.7.

## v1.10.2 — the cells stop reporting quiet failures

Two cell releases, both about a step that failed while looking like it succeeded.

Nucleus 3.0.7 runs local commands from a script file rather than through `sh -c`, so a
`pkill -f` in a compound command no longer matches and kills its own wrapper (then reports
exit 1 with empty output), and `pgrep -f` no longer counts the wrapper as a live process.
Its RTK summariser now refuses a summary below 5% of the source, keeps the original output
and names it, and only treats `Error`/`warning` at line start as log mode.

Enzyme 4.1.0 reshapes a query once when every source returns nothing and says so in the
header, since Google CSE over-constrains on long natural-language questions. Scoring folds
`tool`/`tools`-style variants and weights terms by rarity among the candidates, and each
brief now carries the `query_class`/`source` handle needed to record feedback — with the
exact genome call, including when a follow-up tool opens a URL the brief returned.

Runtime unchanged at 1.3.7.

## v1.10.1 — doctor diagnostics for uninstalled and non-default prefixes

Two lookups produced a report that blamed the host for what was really a path miss. Doctor
now says `not installed` instead of `Not checked`, and when every component is missing it
prints the paths it resolved along with the install-then-diagnose commands. Separately, an
installation made with `--runtime` lives under `<profile>-runtime`, but doctor only checked
`<profile>-individual`; it now scans for sibling `<profile>-*` installations and names the
`--mode` or `--prefix` needed to diagnose each one, in human and JSON output alike.

No cell changes: revisions and versions pin unchanged from 1.10.0.

## v1.10.0 — host-layer doctor and a single MCP entry point

The doctor now covers the layer it previously ignored: the wiring between client
applications and the runtime. `node scripts/doctor.mjs --hosts` (also `npm run doctor:hosts`)
checks the interpreter floor derived from cell `engines`, whether `nodejs` is still marked
manual for apt, the gate file the launcher reads, credential-file modes and key presence,
all six client configs, backup exposure, and a live `initialize`/`tools/list` handshake.
Failures are actionable lines; `--repair` re-installs the pinned node package, re-asserts
the manual mark, and fixes credential-file and backup modes. Exit codes stay 0/1/2.

`scripts/host-entry.sh` is now the canonical client entry point, installed as
`~/.local/bin/hela-runtime-mcp`. It resolves the interpreter at spawn time, refuses to
start below the required major, sources one 0600 credentials file, and logs failures
because MCP hosts swallow child stderr. It is PATH-independent: every external command is
absolute, so it can report a stripped environment instead of dying inside it.

[The reliability contract](docs/reliability.md) documents the resulting chain with eight
diagrams. Sources are Mermaid (`assets/diagrams/*.mmd`) and the rendered SVG next to them;
the library pages embed the SVG because the document renderer carries `markdown-it`
without a Mermaid plugin and escapes raw HTML.

Credential handling also changed: every secret found in client-config backups was copied
into mema-vault before those backups were deleted, so `--hosts` reports a clean backup
surface instead of a permanent warning.

## v1.9.6 — pinned modern web guidance

HeLa Phenotype 3.0.3 now bundles Google's Modern Web Guidance agent skill. The skill, CLI package (`1.0.0`), upstream source commit, and guidance corpus (`2026_11_09-5bcc021b`) are pinned. Profiles that include Phenotype receive the skill through the normal skill-sync workflow; the command-line lookup needs Node.js 22+ and outbound network access.

The new [prebuilt-skills catalog](docs/prebuilt-skills.md) maps every bundled skill to its server and all eight profiles, and documents source pins, synchronization, and update handling. The coordinated v1.9.6 snapshot is immutable; `latest-stable` now resolves to it. v1.9.5 and older snapshots remain unchanged.

## v1.8.0 — dedicated Cytosol image analysis

HeLa Cytosol now accepts a dedicated local image path, HTTP(S) image URL, or base64 image directly through `browser_image_analyze`. The tool returns Mirage VLM scene understanding, OCR, object detection, segmentation, spatial relations, and schema-based decisions without launching a browser page. Image inputs are bounded and protected by workspace, content-type, redirect, and SSRF checks.

## v1.7.0 — Cytosol Mirage visual intelligence

HeLa Cytosol now includes first-class local visual intelligence through Cactus Mirage. The `browser_visual_analyze` tool can describe browser screenshots, detect objects, read text, return segmentation data and relations, and extract values against a schema. The Cactus runtime is managed per Cytosol installation while Mirage model weights remain lazy and are cached on first use.

## v1.6.4 — stable snapshot alias correction

The `latest-stable` snapshot now resolves to the coordinated release pins and
versions published in the 1.6.3 cell/runtime release set.

## v1.6.3 — cross-platform maintenance entrypoints

The installer and maintenance workflow is now Node-first. Use `node setup.mjs`,
`setup.ps1`, or `setup.cmd` for installation and doctor checks; `update.ps1` and
`update.cmd` provide the corresponding Windows update path. The Bash entrypoints
remain compatibility shims.

Profile-scoped build, test, clean, and update operations now run through portable
Node scripts. Runtime Needle discovery also recognizes `needle3.exe` and
`needle.exe` automatically. Native Windows cold-install acceptance is still
tracked separately from this source-level portability work.

## v1.6.2 — Plastid and Receptor dependency refresh

Plastid moves to `aa43877` and Receptor to `1b21cb7`, adopting the lockfile updates that had accumulated on their default branches. Both carried open advisories against `@modelcontextprotocol/sdk`; the refreshed locks resolve them, and `npm audit` is clean for Plastid's runtime dependencies while Receptor reports none.

Plastid's manifest also declared `"@modelcontextprotocol/sdk": "latest"`. That is why its lockfile drifted without a reviewable diff; it is now `^1.32.2`. Builds and the existing suites pass — 12 Plastid regressions and 123 Receptor tests — and no cell version changed.

Exposure was limited: the SDK advisories concern HTTP transports, body-size limits, and OAuth flows, while Plastid and Receptor run over stdio. Updating still removes the drift and the noise. Hardware, the Blender bridge, GUI clients, and providers remain separate checks.

## v1.6.1 — switch deployment modes in place

`./setup.sh mode --prefix PATH --mode MODE` converts an existing managed installation to another execution mechanism without a second prefix or a data migration. All five modes are valid targets. Profile, snapshot, workspace, transport, port, and the per-cell `data/` directories carry over; host-mode switches reuse packages already built at the pinned revision with a clean worktree, and Docker modes build or drop their image and `compose.json` accordingly.

The command runs the same verification as a fresh installation and generates a new client fragment instead of editing live client settings. Failed verification restores the previous manifest and writes a pending marker so doctor reports the degraded state. Pending or unmanaged prefixes are refused, HTTP targets require a runtime mode, and re-selecting the current mode is an error.

Enzyme stays at 4.0.0 and the runtime at 1.2.0; every cell pin is unchanged from 1.6.0. Tests cover host-family round-trips, transport guards, pending markers, and Docker switches.

## v1.6.0 — consistent Enzyme search input

Pin Enzyme source `eb98982`. `google_search` now takes `query`, matching every other single text search in the cell. The former `q` argument is removed, so a client that still sends it gets an MCP validation error instead of a silent translation; requests that send both fields are rejected as well. Batch tools keep `queries`, and provider HTTP parameters are unaffected internally.

Both Enzyme entrypoints share one strict schema: the query is trimmed and must be non-empty, `num` is an integer from 1 to 10, and unknown fields are refused before any provider call. Enzyme's contract tests cover discovery, dispatch, rejection of obsolete input, and provider failure for the shipped and modular servers; 32 contract tests and 111 total Enzyme tests pass with a clean TypeScript build and no lint errors. Enzyme moves to 4.0.0 because this is a breaking argument change.

The catalog, generated documentation, and profile counts are rebuilt from the new schema. Counts stay at 24 Enzyme tools, so profile totals do not change. Other cells, the runtime, and every snapshot from v1.0.0 to v1.5.3 are untouched.

## v1.5.3 — canonical relation ordering

Pin Genome source `9ba1d0e`. Relation links now render in one canonical order regardless of database insertion order, preventing relation-order-only conflicts after a lossless repair. All 19 suites / 264 tests pass; the TypeScript build and zero-warning source lint pass. The published 1.5.2 snapshot remains unchanged, as do all other cell/runtime pins and package versions.

## v1.5.2 — replicated vault convergence

Pin Genome source `c32ae94`: replicated notes keep the earliest creation timestamp and latest update timestamp, while incoming observation supersets can retain their order without losing database-only facts. The explicit programmatic repair API archives both originals, respects snapshot/lock checks, and permits rejecting a plan before publication. Normal CLI sync does not choose conflict winners automatically.

Genome's 19 suites / 263 tests and TypeScript build pass, including regressions reproducing the previous timestamp/order loops and validating SQL bindings, JSON rows and tool arguments. Source lint reports zero errors and warnings, covers top-level files and fails on warnings. Package versions remain 3.0.0 for cells and 1.2.0 for runtime; this source snapshot records the exact fixed Genome commit. Other pins and historical snapshots are unchanged. Real vault repair and MCP reconnection require separate, backed-up operational verification; no private vault data is published here.

## v1.5.1 — current documentation and bilingual website

Documentation-only refresh: all ten cells remain **3.0.0**, and runtime remains **1.2.0**. The new source snapshot pins the documentation commits without rewriting v1.0.0–v1.5.0. Plastid and Receptor documentation was merged into their default branches without discarding unrelated dependency updates; the snapshot deliberately pins the documentation-only parents, not those dependency changes.

The EN/ID website now loads generated versions, canonical tool names, and profile metadata. Configuration previews use real repository directories and Codex `mcp_servers` sections. Source guides cover all eight profiles, cold discovery, optional integrations, safe backup/restore, and the limits of current verification. Generated private configurations may contain supplied credentials; committed examples are regenerated with a sanitized environment.

Documentation checks cover 74 regression cases plus local links/anchors and structured metadata; the CLI matrix covers 80 combinations. Browser verification covers 64 visible selections per language and all 16 pages at desktop/mobile widths. These are documentation/UI checks, not new authenticated ACP, provider, Android, or Blender acceptance. Publication does not restart the runtime or change deferred access controls, credentials, databases, or vault conflicts.

## v1.5.0 — on-demand runtime and canonical discovery

Runtime **1.2.0** starts cells only when invoked, shares concurrent startup attempts, and discovers schemas without spawning cells. Revision/build/config-aware caches reject stale entries; legacy/corrupt caches fall back to a validated generated catalog. Unknown calls no longer start unrelated cells. Standalone servers, all eight profiles, and the `dev-workspace` default are preserved.

The canonical inventory drives config generation, doctor/version/profile checks, schema catalogs, and generated documentation counts. Doctor can verify exact runtime discovery with no cell startup via `--runtime`. A new immutable v1.5.0 snapshot pins runtime `9c92dbf`; older versioned snapshots are unchanged.

Verification: **32** runtime regressions on both Linux architectures, **16** all-profile namespace-mode checks, **80** client configurations, four probe regressions, and four inventory regressions. Cold/warm measurements are recorded, not treated as universal benchmarks. See [implementation and verification scope](docs/on-demand-runtime.md). ACP authentication, external client reloads, gateway retirement, vault conflict review, hardware/provider integrations, and deferred security remain separate work.

**Servy rollout verified:** public/local discovery exposes 236 tools without starting any cells; the first safe Nucleus call starts only Nucleus. Deployed doctor, catalog, and revision checks pass. Fresh backups and rollback material are retained, and all 633 existing conflict archive files are unchanged. See the [rollout evidence](docs/on-demand-runtime.md#historical-servy-rollout--runtime-120).

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
