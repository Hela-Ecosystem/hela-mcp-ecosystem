# Servy deployment verification — 2026-11-06

This records the earlier runtime 1.1.0 rollout. The subsequent [runtime 1.2.0 on-demand deployment](on-demand-runtime.md#verified-servy-rollout) supersedes its process/startup state; the evidence below remains historical.

The v1.4.0 source release (`c9faa9b`) is deployed to servy's systemd-managed HTTP runtime. This record covers that deployment, not authenticated GUI sessions or live vault reconciliation.

## Published source and builds

- Genome: `16fc4f31735e139d690ae0ace8d4feaf1a603563`.
- Enzyme: `5399e33c7c8a5b75ad620dc33f66a1cbf49972f7`.
- Runtime: `797bad451b45d0d67631eeb8cdb1c93d259f614c`, version **1.1.0**.
- Remaining cell pins are in `config/snapshots/v1.4.0.json`. Historical v1.0.0–v1.3.0 snapshots were not modified.

Runtime recovery passes **20/20** isolated fault tests on x86_64-linux and native aarch64-linux; all 29 fixture PIDs per run were reaped. Coverage includes hung RPCs, SIGTERM/SIGKILL, exit-before-restart, pipe routing, bounded retries, profile boundaries, and shutdown cleanup. No live service cell was faulted during deployment.

Final-source Nix builds use the committed lockfile, fixed-output npm dependencies, production installation, and Node **22.23.4**:

- x86_64-linux: `/nix/store/gzxl62xr29nh36yb75c242gp4mnsibsh-hela-runtime-1.1.0`.
- aarch64-linux: `/nix/store/y9hqz9kyx860s5xqx3gk23x7acsghis2-hela-runtime-1.1.0`.

Genome's clean-install regression suite passes **19 suites / 242 tests**. Enzyme's **79 tests** and Phenotype's **74 tests** pass. Ten isolated standalone MCP handshakes, 80 client-configuration combinations, three probe regressions, and three isolated direct/runtime read-only parity calls pass. These checks do not establish authenticated GUI or hardware integration.

## Controlled promotion

All eight selected cells, runtime, and ecosystem checkouts were clean before fast-forward promotion. Validated staged builds were promoted; Genome, Ribosome, Enzyme, and Phenotype received fresh ARM dependency trees. Old build/dependency directories remain in the rollout's `rollback/` directory. All ten deployed checkouts passed `npm ls --depth=0`; source revisions agreed with lappy at source-release verification.

Before stopping the service, three online SQLite backups passed integrity checks and the live vault was archived again. Earlier backups were hash-verified. No active database file was replaced or restored.

Only `hela-runtime.service` was stopped/restarted. Its old ten processes, including a duplicate Genome child, exited. The new service owns one runtime plus exactly eight direct child cells; all use Nix Node 22.23.4. At verification, systemd reported active state, zero automatic restarts, and successful exit status.

The deployed package is rooted by:

`/home/ubuntu/.local/state/hela/deployments/todo102-z65w9kzr/runtime`

The drop-in `/etc/systemd/system/hela-runtime.service.d/10-nix-package.conf` selects that executable and prepends pinned Node to PATH. The original unit remains intact. Existing profile, vault setting, host, port, and endpoint-security configuration were not changed.

## Discovery and ownership

- Default profile: **dev-workspace**, eight cells; no Receptor or Plastid deployment on servy.
- Local `/healthz`: HTTP 200, runtime **1.1.0**.
- Local and public MCP initialize/tools discovery: **236 unique tools** at `/mcp`, including `create_mission`, `list_missions`, `update_mission`, and `hela.pipe`; hardware-only tools absent.
- Public endpoint: `https://hela-runtime.glassgallery.my.id/mcp`.
- A local HTTP `terminal_session_list` call passed MCP and payload-level error checks.
- Isolated strict package/initialize/inventory/snapshot/pin checks passed for eight cells and runtime; deployed doctor reported **8/8 READY**.

The isolated feature-disabled runtime exposes **230 tools**. The live configuration adds `llm_query`, `llm_decompose_task`, `llm_suggest_route`, `llm_summarize`, `agent_run`, and runtime alias `hela.agent.run`. No isolated tools were missing from live discovery. Those additional model-backed tools were discovered, not invoked.

The 211 unresolved divergent-note conflicts remain archived. All **633** existing servy conflict archive files retained their pre-rollout hashes. No conflict winner, explicit bulk deduplication, or deletion reconciliation was forced.

## Evidence and retained recovery material

Servy rollout directory:

`/home/ubuntu/.local/state/hela/deployments/todo102-z65w9kzr/`

It contains `manifest.json`, `backup/`, `rollback/`, the runtime GC root, `verify-versions.mjs.log`, `doctor.mjs.log`, `http-verification.json`, and `feature-difference.json`. These are local operational records, not public credential/configuration dumps.

Previous backups remain at:

- lappy: `/home/azzar/.local/state/hela/backups/pre-10.2-d9nokk5t/`.
- servy: `/home/ubuntu/.local/state/hela/backups/pre-10.2-m6j95llu/`.

Rollback material is retained, but no live rollback was performed. Any rollback must stop the service, preserve current databases/vaults, inspect compatibility, and select retained code/dependencies deliberately. Do not overwrite active databases or hard-reset repositories.

## Remaining work

- Authenticated Zed/Codex ACP session and GUI warning verification remain pending. Direct MCP and isolated Codex discovery passed; credentials were not copied and the optional ACP duplicate-filter override remains unset.
- Two older stdio runtimes owned by an active servy OpenCode client were preserved. They require a deliberate client reload; the HTTP service rollout does not update code already loaded in unrelated processes. Local client reload state also remains unverified.
- PM2 has no active or saved individual MCP cell entries. It still owns the legacy `mcp-gateway` on port **8010**, with no child cells and seven retired backends on **8011–8017** reporting down. Historical entries remain in `dump.pm2.bak`. Review consumers/routes before retiring this gateway; it does not serve the verified runtime endpoint on **8090**.
- Review archived vault conflicts before reconciliation. Deployment is not conflict resolution.
- True first-call ignition, full revision/configuration manifest invalidation, optional hardware integrations, and deferred endpoint authentication/credential rotation remain separate work.
