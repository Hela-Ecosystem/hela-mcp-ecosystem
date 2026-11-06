# All-profile verification — 2026-11-06

HeLa changes apply to the shared servers/runtime, not a hardcoded lappy or servy configuration. Each installation keeps its selected profile. The runtime default remains `dev-workspace`; the distribution does not force everyone to `all`.

Machine configurations were preserved:

- Lappy has all ten standalone HeLa servers, equivalent to the `all` roster. Ten native Codex definitions were confirmed without printing environment values or credentials. This does not mean every client uses a single `HELA_PROFILE=all` runtime.
- Servy's systemd HTTP runtime selects `dev-workspace`, eight cells. The profile is not named `dev-workflow`. Receptor and Plastid remain intentionally absent there.
- Other installations can select any of the eight profiles in `config/profiles.json`.

## Acceptance checks

The new `npm run test:profiles` command passed on lappy for all eight profiles: `minimal`, `dev-workspace`, `headless-server`, `research`, `web-devops`, `android-testing`, `3d-modeling`, and `all`.

Each profile runs twice, with namespacing off and on: **16/16 runtime checks**. The verifier obtains actual tool schemas from the ten standalone cells, then checks that each runtime:

- Boots exactly the selected cells, with no additional cells.
- Exposes exactly their tools plus `hela.pipe`, without collisions or out-of-profile tools.
- Preserves each tool's input schema, including namespaced tool names.
- Includes all three Genome mission tools.
- Routes a safe Genome read-only call, plus a Nucleus session-list call where selected.

With model-backed features disabled, the `all` runtime exposes **291 tools**: 290 standalone tools plus `hela.pipe`. `dev-workspace` exposes **230** under the same conditions. Servy's feature-enabled live runtime exposes **236**; those feature-dependent differences are not profile failures.

Strict package/initialize/inventory/snapshot/revision verification also passes for all ten cells and runtime. The client-generation matrix passes **80/80** profile/client combinations. Probe regressions pass **4/4**, including explicit profile/namespacing isolation from the host environment.

All probes use disposable HOME/project/central-memory locations, excluding inherited credentials and live vault hooks. Model, Android, and Blender operations were not invoked. These checks establish MCP startup/discovery/schema/routing support, not hardware integration or authenticated GUI sessions. Published release snapshots were not rewritten to backdate this additional evidence.

## Repeating the checks

From the ecosystem checkout, using Node 22:

```bash
npm run test:profiles
npm run test:profiles -- --json
node scripts/verify-versions.mjs --profile all
npm run test:matrix
npm run test:probe
```

The full matrix requires all ten cells to be installed and built. A machine with only one selected profile can test that profile without installing unrelated hardware cells:

```bash
npm run test:profiles -- --profile dev-workspace
```

Missing required builds fail explicitly rather than silently skipping a profile. This command starts isolated test processes; it does not rewrite client configuration, change the live profile, or restart a service.
