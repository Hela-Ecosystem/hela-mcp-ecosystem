# Servy runtime update — 2026-11-19

Records the lappy → servy rollout of ecosystem **1.9.19** and runtime **1.3.3**. Evidence for this host only; it does not describe other machines.

## Host layout (unchanged by this update)

- Source checkouts: `/home/ubuntu/MCPservers/*` (ecosystem, runtime, eight cells).
- Service: `hela-runtime.service`, `HELA_PROFILE=dev-workspace`, `HELA_ECOSYSTEM_ROOT=/home/ubuntu/MCPservers/hela-mcp-ecosystem`, HTTP on `0.0.0.0:8090`.
- Roster: **eight cells** — Mitosis, Genome, Membrane, Nucleus, Ribosome, Enzyme, Phenotype, Cytosol. Receptor and Plastid are deliberately absent: this host has neither `adb` nor `blender`. Lappy runs the ten-cell `all` roster; the difference is an installation choice, not a code fork.
- ExecStart comes from the `10-nix-package.conf` drop-in and points at a wrapper in a dated deployment directory, which execs a Nix-built runtime with the pinned Node 22.23.4.

## What ran

1. `memory.db`, `hela-runs.db` and the local tool-catalog copy backed up to `/home/ubuntu/.local/state/hela/backups/pre-1.9.18-20261119T015844Z/`.
2. All ten checkouts pulled fast-forward to the 1.9.19 revisions (`hela-runtime` 6ca8b61, ecosystem 61f848e, cells at their release commits). `researcher-mcp` was on a detached HEAD and was moved onto `master` first.
3. Cells rebuilt (`npm ci` + `npm run build`) — eight cells plus runtime, all green.
4. Runtime packaged with Nix: `hela-runtime-1.3.3` at `/nix/store/pc49i4nc1qs7nfkkk5mz81mnc9jqj508-hela-runtime-1.3.3`, GC-rooted at `~/.local/state/hela/gcroots/runtime-1.3.3`.
5. Staged wrapper under `~/.local/state/hela/deployments/servy-1.9.18-20261118T190500Z/`, smoke-tested on port 8091 (health reported 1.3.3) before touching the live unit.
6. Drop-in backed up, ExecStart switched, `daemon-reload`, `systemctl restart`. Old deployment directory and drop-in backup retained for rollback.

## Result

- `systemctl is-active` → active; `/healthz` → `{"version":"1.3.3"}`.
- HTTP MCP doctor → READY, **240 tools**.
- Lazy boot verified: `terminal_session_list` started Nucleus and answered.

## Gotcha worth remembering

After the rebuild, the runtime advertised only 209 tools and refused `terminal_session_list` and `keyword_extraction` as unknown. Cause: the runtime trusts a cell manifest only when its build digest matches the catalog, and cells rebuilt on this host hash differently from the catalog produced on lappy — two manifests were rejected and those cells vanished from the surface silently.

Fix: regenerate the catalog on the host that runs the cells (`node scripts/generate-tool-catalog.mjs --profile dev-workspace`), then restart. The runtime is on-demand, so nothing else changed. A profile-scoped catalog is a deployment artifact here; the repository copy is untouched.

## Rollback

```sh
sudo cp /etc/systemd/system/hela-runtime.service.d/10-nix-package.conf.bak-<stamp> \
        /etc/systemd/system/hela-runtime.service.d/10-nix-package.conf
sudo systemctl daemon-reload && sudo systemctl restart hela-runtime
```

The previous wrapper (`servy-update-20261114T063237Z`) and its Nix runtime are still on disk.

## 1.9.24 rollout (servy, 2026-11-19T21:01Z)

Second pass on the same day, carrying the RPC and search releases.

1. Checkouts pulled fast-forward: `project-mcp` b720edf (3.0.5), `terminal-mcp` 0088f0b (3.0.6), `researcher-mcp` eb257b8 (4.0.6), `browser-mcp` 8f0b39f (3.2.6), `hela-runtime` c2b02ff (1.3.6), ecosystem d193cc4 (1.9.24). The repository catalog copy was reverted before the pull — on this host it is a deployment artifact, as noted below.
2. Those four cells rebuilt (`npm run build`).
3. Catalog regenerated **on servy** with `--profile dev-workspace` before any restart, so the digests match the builds on this host.
4. Runtime packaged with Nix: `hela-runtime-1.3.6` at `/nix/store/g1npgvsii07mpclxzsxc9lm3gd15n12m-hela-runtime-1.3.6`, GC-rooted by `runtime-nix` inside the new deployment directory.
5. Staged wrapper at `~/.local/state/hela/deployments/servy-1.9.24-20261118T210125Z/runtime/bin/hela-runtime`, drop-in backed up to `10-nix-package.conf.bak-20261118T210124Z`, ExecStart switched, `daemon-reload`, restart.
6. Verified over HTTP: `/healthz` → `1.3.6`; `tools/list` → **239 tools** on the 8-cell `dev-workspace` profile (297 unique cell tools at profile all, minus Receptor 46 and Plastid 15, plus the 3 runtime tools); `hela.agent.run` present and the cell-local `agent_run` gone; `execute_command` with `cd /tmp && echo marker-ok` returned `stdout "marker-ok\n"`, exit 0; the scatter query returned zero Wikipedia hits.

239 rather than the earlier 240 because Mitosis now contributes one schema variant (24 tools) instead of the union across its four variants (29). Not a missing cell: Nucleus and Enzyme were both present and callable, which is the failure mode this host hit at 1.9.19.

Rollback is unchanged: restore the drop-in backup and restart. The 1.9.21 deployment directory and its Nix runtime stay on disk.
