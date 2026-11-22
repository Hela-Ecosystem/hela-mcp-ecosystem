## [1.11.6] - 2026-11-22

### Fixed
- `hela-cytosol` 3.3.3: `browser_switch_to_new_tab` no longer throws, quiz batches report real counts, macro export honours format and save, generated tests run, and catalogue search finds tool names.
- `hela-genome` 3.1.3: harness sync cannot store a fabricated year (zero and seconds timestamps are normalised or skipped with a reason, existing bogus rows repaired), `get_timeline` uses real timestamps with numeric `since` and sorts, and the dry run honours watermarks.

## [1.11.5] - 2026-11-22

### Fixed
- The Cytosol tool count in the site and `llms.txt` is derived from the generated catalog instead of a hand-written number, and the docs test compares against the catalog rather than the literal `75`. Adding `browser_list_dialogs` in cytosol 3.3.2 made the stale literal fail the gh-pages verification job.

## [1.11.4] - 2026-11-22

### Fixed
- `hela-genome` 3.1.2: mission transitions are guarded (queued → claimed → in_progress → completed/failed, cancel from any state, explicit requeue), lifecycle updates must name the claimant, and claims carry a 30-minute lease.
- `hela-enzyme` 4.3.2: citations keep every author, invert names per style, use et al. for MLA, and warn instead of dropping an unparseable name.
- `hela-cytosol` 3.3.2: dialogs are dismissed by default instead of auto-accepted, `browser_dialog` sets the next action and prompt text, `browser_list_dialogs` records them, and popup dismissal never clicks an affirmative control.

## [1.11.3] - 2026-11-22

### Fixed
- Runtime 1.4.1 repinned at `14cc13e`: the version bump changed the npm deps derivation input, so the fixed-output `npmDepsHash` no longer matched and the Nix verify job failed. Hash refreshed (`sha256-VlP6gbWoi6TTkbk4FSSKey/bTw/rNT40H+99k7J4A7c=`); no functional change from 1.11.2.

## [1.11.2] - 2026-11-22

### Added
- **Response contract for degraded results.** `hela.runtime` 1.4.1 reports `status: ok | degraded | failed` on `hela.pipe`, per-step status, and a `degraded` array naming the step and reasons. A step that marks itself `degraded`, `partial`, `truncated`, `status: "degraded"` or `warnings` makes the pipe degraded while `ok` stays true. Contract documented in `hela-runtime/docs/response-contract.md`.
- `hela.mitosis` 3.1.1 adopts it: `get_skill` marks a truncated or file-omitted answer `status: "degraded"` with a reason.

### Fixed
- The nine instances tracked by #8 were fixed individually; this release makes the convention enforceable rather than per-tool.

## [1.11.1] - 2026-11-22

### Fixed
- `hela-genome` 3.1.1: entity deletions are reconciled across project and central sync, sync reports what it deleted or skipped, and a root switch no longer imports another project into a fresh root.
- `hela-enzyme` 4.3.1: sentiment applies negation across a window, so "never recommend" and "hardly a success" score negative; the negations found and the lexicon caveat are reported.
- `hela-cytosol` 3.3.1: seventeen handlers expose their payload through `structuredContent` with a bounded text summary, and failures set `isError`.
- `hela-phenotype` 3.2.1: React components use their declared props and derive classes from the requested style and palette; the snippet is typechecked and rendered in tests.

## [1.11.0] - 2026-11-22

### Fixed
- `hela-phenotype` 3.2.0: theme colours and every derived token are inside sRGB (0 of 342 emitted values out of gamut); `stitch_sync_design_system` writes one accent; browser templates apply their palette; the 8-state component renders 8 distinct states; logo search matches catalogue facets; the export covers `index.html`.
- `hela-enzyme` 4.3.0: trends report a window and never page counts as interest; CSV escapes quotes and guards formulas; research sessions persist to disk; `news_monitor` enforces `dateRestrict` and resolves redirects.
- `hela-mitosis` 3.1.0: `workflow_orchestrator` dispatches to named cells and marks failed steps failed; planners name a tool or say why not; analysis tools stop inventing metrics; skill frontmatter parses properly and the response is bounded.
- `hela-ribosome` 3.2.1: opencode v2 CLI alignment; follow-ups resume the addressed session; the managed-server password is redacted from session output; hooks wait for output rather than their own echo.
- `hela-cytosol` 3.3.0: cookies are page-scoped and redacted with explicit widening; uploads are contained to workspace roots; `browser_extract_table` honours `header` without eating a data row.
- `hela-genome` 3.1.0: deletes are durable across central sync; the secret scan no longer opens live SQLite files, so WAL locks and post-scan writes survive.

## [1.10.10] - 2026-11-22

### Fixed
- `designer-mcp` 3.1.0: inline contrast is computed (WCAG 2.x) rather than string-matched, so white-on-white at 1.01:1 now fails and the sample page grades B/75 instead of A/96; palette variants pass achromatic inputs through unchanged; the High Contrast label names the surface it was measured against; derived `--color-focus` chroma is clamped into sRGB; and the five Stitch CLI tools are advertised only when the CLI is present (23 vs 28 tools, `HELA_PHENOTYPE_STITCH` overrides).

## [1.10.9] - 2026-11-22

### Fixed
- Repin the runtime to the commit that refreshes `npmDepsHash`. The 1.4.0 version bump changed the npm-deps derivation input, so the Nix verification job failed at build time on a fixed-output hash mismatch — the installer and CI both build from the pinned revision, which still carried the stale hash. No runtime behaviour change.

## [1.10.8] - 2026-11-22

### Fixed
- `researcher-mcp` 4.2.2: the IDF half of the scorer was inert in production because `research_brief` passed no candidate corpus. Terms are now weighted by how much they discriminate among the returned pages, so a common term contributes little and a rare one carries the match.

## [1.10.7] - 2026-11-22

### Fixed
- `researcher-mcp` 4.2.1: the enzyme fixes from 4.1.0/4.2.0 were compiled into a module the shipped entry never loads. The real `research_brief` (root `research-server.ts`) now backs off once on an empty ranked result, discloses it, returns the feedback handle, and appends spool signals from `extract_content`. Found by post-deploy verification: the pinned 4.2.0 cell still behaved like 4.0.9.

## [1.10.6] - 2026-11-22

### Changed
- **`hela.pipe` fails closed.** A chain whose middle step failed returned `ok: true` and piped the error text into the next step, which produced a confident result computed from `ENOENT`. `ok` now reflects every step, `failedStep` names the first failure, `onError` defaults to `stop`, and each result carries its own `ok`. This is a breaking default by intent: callers that checked `ok` were getting a wrong answer. Runtime 1.4.0.

## [1.10.5] - 2026-11-22

### Fixed
- `filesystem-mcp` 3.0.6: four responses promised what the implementation did not deliver. Ranged `read_file` now snaps to character boundaries and reports `startByte`/`endByte` (chunked reads of non-ASCII files no longer lose a character per boundary); `extract_archive` reports `extracted`/`entries`/`skipped` with a reason instead of a silent partial success; `watch_file` buffers events and returns them on the next call (plus waits for chokidar's initial scan); `compare_files` reports `size` in bytes with a separate `characters` field and a correct line count.

## [1.10.4] - 2026-11-22

### Added
- The adaptive search priors can now learn. Enzyme observes when a caller follows up on a URL a brief returned and appends a used=true record (with display rank) to `~/.local/state/hela/search-feedback.jsonl`; genome drains that spool into `source_feedback` whenever `search_feedback` or `search_priors` is called. One writer keeps the table honest, the file is claimed by rename so nothing imports twice, and failed inserts are preserved for a retry. `hela-enzyme` 4.2.0, `hela-genome` 3.0.7.

## [1.10.3] - 2026-11-22

### Fixed
- `chaining-mcp` 3.0.9: peer discovery reads the runtime's generated tool catalog, so Mitosis sees the ten cells it orchestrates when they are multiplexed behind one endpoint. `validate_tool_chain` no longer reports every real tool as unavailable (`read_file` on `hela-membrane` included), and availability now distinguishes an absent tool (error) from an undiscovered server or missing catalog (warning) — the direction that had been discarding correct plans. Verified against the installed catalog: 10 cells, 299 tools.

## [1.10.2] - 2026-11-22

### Fixed
- `terminal-mcp` 3.0.7: local commands run from a temporary script instead of `sh -c`, so `pkill -f` no longer matches and kills the wrapper shell, and `pgrep -f` no longer reports it as a live process. RTK summarisation rejects summaries below 5% of the source, retains and names the original output, and anchors its log heuristic to line starts. Two defects that both made a failed step look successful.
- `researcher-mcp` 4.1.0: `research_brief` retries once with a reduced query when every source returns nothing and discloses it (`backoff: "…"`); scoring folds morphological variants and weights terms by how much they discriminate among the candidates; the brief returns a feedback handle plus the exact `genome search_feedback` call, and a follow-up tool on a brief URL appends it with `used=true`.

## [1.10.1] - 2026-11-22

### Fixed
- Running `doctor` against a bare checkout printed ten rows of `missing*` / `Not checked` without naming a path or a next step, which is indistinguishable from a broken install — and reads as a platform bug when it happens on Windows. Rows now say `not installed`, and when every component is missing the report lists the paths it resolved plus the two commands that fix it (install, then `doctor --prefix`).
- A profile can be installed under any mode, but doctor only looked at `<profile>-individual` unless `--prefix` was passed. Installing with `--runtime` therefore made a healthy host report every component missing. When the default prefix has no manifest, doctor now scans for sibling `<profile>-*` installations and prints each one with the `--mode` or `--prefix` that would diagnose it; JSON output carries the same list under `installationCandidates`.

## [1.10.0] - 2026-11-21

### Added
- `doctor.mjs --hosts` inspects the layer the doctor previously ignored: the wiring between client applications and the runtime. It checks the interpreter floor derived from cell `engines`, whether `nodejs` is still marked manual for apt, the gate file the launcher reads, credential-file modes and key presence, all six client configs, backup exposure, and a live `initialize`/`tools/list` handshake. `--repair` reinstalls the pinned node package, re-asserts the manual mark and fixes credential/backup modes; exit codes remain 0/1/2.
- `scripts/host-entry.sh` is the canonical client entry point, installed as `~/.local/bin/hela-runtime-mcp`. It resolves the interpreter at spawn time, refuses to start below the required major, sources one 0600 credentials file, and logs failures because MCP hosts swallow child stderr. It is PATH-independent: every external command is absolute, so it reports a stripped environment instead of failing inside it.
- `docs/reliability.md` documents the host-to-cell failure model with eight diagrams. Sources are Mermaid under `assets/diagrams/`, renders are SVG beside them, because the document renderer carries `markdown-it` without Mermaid and escapes raw HTML.

### Changed
- Credentials found in client-config backups were copied into mema-vault before those backups were deleted, so the host doctor reports a clean backup surface instead of a permanent warning. `docs/reliability.md` documents vault-based recovery.

## [1.9.27] - 2026-11-19

### Fixed
- The Docker doctor reported `DEGRADED` with an empty `[]` on a clean image because it compared the runtime catalog against bare cell tool names. The container never receives `HELA_NAMESPACE_TOOLS`, so the runtime applies its new default and advertises `hela_membrane_read_file`; 23 of 24 expected names therefore looked missing. Coverage now accepts the runtime's namespaced name or the bare one, and a real gap names the cell and tool instead of printing an empty array. Unit tests cover both surfaces and a genuinely missing tool.
- Enzyme `4.0.9` runs its priors suite on Node 20 instead of failing at import: `node:sqlite` only exists from 22.5, so the database cases are gated on the runtime version while the resolution and collapse-guard tests still run. The package claims Node 20, where learned priors deliberately degrade to the static table.

## [1.9.26] - 2026-11-19

### Fixed
- Learned search priors never applied on a host whose genome still uses the legacy central store. Enzyme resolved `~/memory/memory.db` only, while genome keeps writing `~/memory.db` when its migration did not run — so every brief reported `priors: static` and the recorded decisions sat in a file nobody read. Enzyme now resolves the way genome does: the migrated path when it exists, otherwise the legacy file. Verified end to end with an isolated HOME: ten decisions land in the file the brief reads and it reports `priors: learned (10 samples)`.

## [1.9.25] - 2026-11-19

### Added
- The search loop closes through Genome. Genome `3.0.6` records which source produced the result a caller actually used in a `source_feedback` table in the central memory database, exposed as `search_feedback` (record) and `search_priors` (read). Enzyme `4.0.7` reads that table read-only with `node:sqlite` — no new dependency — and ranks `research_brief` / `multi_site_search` with the derived multipliers instead of constants, stating which table it used (`priors: static` or `priors: learned (N)`).
- The priors carry a collapse guard, because a feedback loop can starve itself: one unlucky run lowers a source's multiplier, the lower multiplier keeps its results under the relevance floor, no further samples arrive, and the mistake becomes permanent. A source with no samples in an active class, or whose newest sample is over 30 days old, is floored at 1.0 and lifted by 0.15 so it stays reachable. Three tests in each repo fail if the guard is removed.
- `scripts/check-prose-facts.mjs` now fails `docs:check` when hand-written prose restates a fact the build knows: an unknown Hela repository name, a live version literal, a roster claim that disagrees with the inventory or profile set, a licence no cell uses, or a per-profile server count that drifted. Ten tests prove each rule fires. It found two real drifts on its first run (a page claiming runtime 1.3.6 after the runtime moved, and a setup page pinning Phenotype 3.0.3 against an inventory at 3.0.5).

### Changed
- Runtime `1.3.7` namespaces cell tools by default: `hela_nucleus_execute_command` instead of `execute_command`. A bare name shadows whatever the host already exposes and the collision is settled by whichever server connected last. `HELA_NAMESPACE_TOOLS=0` restores the previous surface; this is breaking for clients that pin bare tool names, and the manifest cache key already covers the mode so a switching client rebuilds its fingerprints once.
- Genome creates the parent directory of a configured database path. `GUARDIAN_CENTRAL_DB` pointing into a directory that did not exist yet used to die with `SQLITE_CANTOPEN` on the first query.

### Closed
- Four Dependabot pull requests (chaining `#13`, `#18`; filesystem `#17`, `#16`) were closed as already satisfied: both default branches resolve zod 4.6.7, glob 14.0.6 and minimatch 11.0.9.
- `filesystem-mcp#15` (signed receipts) was answered: no signing keys in the server, but populated `artifacts[].sha256` digests for produced files are a change worth taking.

## [1.9.24] - 2026-11-19

### Fixed
- Cytosol `3.2.6` accepts what `browser_observe` actually reports. `browser_fill_form` keys resolve in order — a ref number from the last observe/get_state, a bare name or id, then the key as a CSS selector — so the observe → fill path no longer misses and every existing selector caller keeps working. Attribute values are quoted, so a field name containing a quote cannot break out of the selector. An unmatched key now aborts the call and names what it tried instead of reaching `page.fill` and blocking for the full 30-second locator timeout; a miss resolves in milliseconds.

## [1.9.23] - 2026-11-19

### Fixed
- Enzyme `4.0.6` scores every search result on query-term coverage with a phrase bonus, title weighted above snippet, and drops results below a named floor. Wikipedia's floor is higher (0.4) than Google's (0.16) because its OR-matched recall is cheap and its precision is not: the scatter query that returned Smalltalk and XML now returns nothing, while a precise query still returns five pages. `research_brief` and `multi_site_search` apply cheap query-class priors, every result line carries its score, and `academic_search` enforces `dateRange` on arXiv with a submittedDate window plus a published-date post-filter — a 2021 paper can no longer answer a `y2` query.
- Nucleus `3.0.6` passes any command containing `;`, `&` or `|` to the shell instead of treating the whole string as a working directory, so `cd /tmp && echo marker-ok` runs; only a standalone `cd` updates the session directory, and it takes its first path argument so a trailing option is not swallowed.
- Runtime `1.3.6` types the cell RPC boundary: `callTool` resolves a validated MCP tool result and raises `CellProtocolError` on a JSON-RPC error or an unexpected shape instead of forwarding `undefined`; cell directory resolution no longer consults `process.cwd()` and names the root and every path tried when a cell is missing; and a malformed JSON-RPC frame rejects its request immediately rather than costing a full timeout.

### Changed
- One agent tool: Mitosis's cell-local `agent_run` was advertised next to the runtime-native `hela.agent.run` and carried the runtime description, so callers could not tell which one ran. Only `hela.agent.run` is exposed now.
- Genome `3.0.5` adds `npm run vault:conflicts`, which archives frontmatter-only sync conflicts without rewriting the note and lists body-divergent ones for a per-note decision. First pass: 641 conflicts archived, 615 left across 302 notes.

## [1.9.22] - 2026-11-19

### Fixed
- The licence wording in the legal pages, `llms.txt` and the JSON-LD licence list was hand-written, so a seventh copyleft cell would have left those statements stale — the same failure mode as the old runtime prose. They are now generated from `config/inventory.json`: counts, cell names, the always-installed set, the structured-data licence URLs and the machine-readable line all follow the inventory, and meta descriptions no longer encode a count that can drift.
- A test recomputes those strings from the inventory and fails on any divergence; `docs:check` also rejects a stale page, verified by flipping one cell's licence.

## [1.9.21] - 2026-11-19

### Fixed
- Runtime `1.3.4` no longer hides a cell whose catalog manifest went stale: each cell's manifest source is logged with the regeneration command, only stale cells are probed once so their tools stay advertised, and the sources are exposed on `/readyz`. On servy this had silently reduced the surface from 240 to 209 tools.
- Cytosol `3.2.5` reconnects once when the browser context was closed under it; a blank page is reported instead of retried, because the previous call may already have acted.
- Plastid `3.0.5` fails honestly when a headless Blender render writes no file, instead of returning a path to nothing.
- Mitosis `3.0.8` and Membrane `3.0.5` complete the zod 4 / glob 14 migration; `npm audit --omit=dev` now reports zero vulnerabilities in every cell and the runtime.

### Added
- Genome `3.0.4` stamps `PRAGMA user_version` after creating its schema, treats a rerun as a no-op and refuses a database written by a newer build.
- `npm run nix:hash` in the runtime refreshes the flake's npm dependency hash and rebuilds to confirm, so a version bump no longer costs a CI round trip.

## [1.9.20] - 2026-11-19

### Added
- `docs/deployment-2026-11-19.md`: the servy rollout record for 1.9.19 / runtime 1.3.3 — eight-cell `dev-workspace` roster, Nix package, staged wrapper, drop-in switch, backups and rollback, plus the stale-digest failure that hid two cells until the catalog was regenerated on the host.

## [1.9.19] - 2026-11-19

### Fixed
- The legal pages still claimed the whole ecosystem was MIT and granted sublicensing and sale over code that is GPL-3.0-or-later. Terms (EN and ID), their meta and JSON-LD descriptions, `llms.txt` and the `SoftwareApplication` structured data now state the split: MIT repository, six GPL-3.0-or-later cells named explicitly, per-cell terms govern redistribution. A test fails if the blanket claim returns.

### Added
- Documented the runtime update tools (`hela.update.check`, `hela.update.apply`) in the README, the on-demand guide and `llms.txt`. They already shipped with runtime 1.3.x; the docs now name them so agents can find them.

## [1.9.18] - 2026-11-19

### Changed
- `npm audit fix` across nine cells and the runtime cleared a critical advisory in Mitosis and Cytosol plus twenty others: mitosis 11 to 3, cytosol 9 to 0, nucleus 8 to 0, membrane 10 to 3, genome/ribosome/enzyme/phenotype/runtime 2 to 0, receptor 1 to 0. The remaining findings need breaking majors (zod 4, glob 14) and stay with their open dependabot PRs.
- Runtime `1.3.3` refreshed its Nix fixed-output dependency hash, verified with a local `nix build` before release.
- No tool surfaces changed (292 base tools); the version guards kept every `ServerInfo` in step.

## [1.9.17] - 2026-11-19

### Added
- Per-cell licence disclosure (PR #7): `config/inventory.json` now carries each cell's licence, the library footer and page headers derive the real blend (MIT suite + six GPL-3.0-or-later cells) instead of a blanket MIT claim, and the architecture reference states which copyleft cells every profile installs. Derived from the inventory and covered by tests.

### Fixed
- `update --json` (PR #6) emits one compact document, so a caller reading the last stdout line cannot be defeated by installer output.

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
