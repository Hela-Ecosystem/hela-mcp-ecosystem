# Installer acceptance — 2026-11-07

Local acceptance of the managed installer on Linux x86_64 with Node 22. This records working-tree changes, not a published release or a live-service rollout. Ecosystem release metadata remains 1.5.1; cells remain 3.0.0 and runtime 1.2.0.

## Real execution

- All eight profiles passed all five modes: `individual`, `runtime`, `docker`, `docker-runtime`, and `nix` — 40 mode/profile checks.
- Doctor verified 269 cell/runtime endpoints across those checks, including 24 private runtime HTTP probes.
- All 320 profile/mode/client-format configurations passed structural checks. The generated Cursor-format commands were also executed: 162 actual client connections, including reconnects for persistence.
- All 40 cases created an isolated Genome entity, restarted the client connection, and read the entity back. Runtime cases started no cells during discovery and only Genome on the first memory call.
- The matrix reused freshly built isolated full-source artifacts, a Nix runtime package, and a full Docker image. These are **not 40 independent cold builds**. Native fixture repositories are linked into temporary prefixes; production installation still refuses symlinked source repositories.

Separate real installations passed fresh doctor checks: native individual/minimal, native runtime/all, Nix/minimal with and without the model, Docker-runtime/all with the model, and Docker/minimal without it. The model-free Nix and Docker installations were checked to contain no Needle model. The Docker image default profile was checked as well.

Explicitly started native, Nix, and Docker Compose HTTP listeners passed `doctor --url`, then were stopped. Compose attached stdio also passed a real Genome mutation/reconnect/read cycle using named volumes, with no published stdio ports. The isolated Compose projects and their test volumes were removed. No doctor containers remained after acceptance.

Nix runtime output links were verified as GC roots. The runtime derivation can be reused from the local Nix store; cell dependencies are still installed from lockfiles and built in their managed source directories.

The pinned Needle engine/model completed an actual offline tool-selection smoke test on both the host and the full Docker image, returning a successful `read_graph` call. This supplements engine execution, asset checksums, and license verification; it is not a planner-quality benchmark.

## Regression gates

- 52 installer tests: profile/mode plans, isolated fixture installs and reinstalls, malformed options, snapshot/checkout failures and retry, repository origin/dirty/symlink refusal, output preservation, missing interpreters, changed builds, model checksum failures, HTTP protocol errors, and Docker cleanup on failure.
- 74 documentation/configurator tests.
- 80 standalone profile/client configuration cases.
- Four MCP isolation/failure probes.
- Documentation metadata consistency, shell syntax, and Git whitespace checks.

The secret scan completed; its sole finding was the existing synthetic credential sentinel in the isolation test, not a credential. This is not a container CVE audit.

## Reproduce

Build isolated fixtures first using the [installation guide](installation.md). The source fixture must include all ten cells plus runtime; the Docker fixture must contain the full image. Then run:

```bash
npm run test:install
npm run test:docs
npm run test:matrix
npm run test:probe
npm run docs:check
npm run test:install:modes -- \
  --source-prefix /path/to/fresh-runtime-all \
  --nix-prefix /path/to/fresh-nix-install \
  --docker-prefix /path/to/fresh-docker-all \
  --out /path/to/modes.json
```

The matrix uses temporary private workspaces/data directories and deletes only its own temporary fixtures. It does not reuse production databases, vaults, or provider credentials. Generated client defaults may advertise more optional tools than doctor's deliberately provider-disabled baseline.

## Boundaries

Real installation acceptance here is Linux x86_64 only. The added CI jobs cover clean Docker/Nix installs and fixture regressions, but remote CI has not yet run for these working-tree changes. macOS, ARM64, and WSL cold installs were not repeated in this acceptance pass; native Windows remains untested.

Browser executables, Android/Blender bridges, external providers, authenticated GUI/ACP clients, host device/SSH access from containers, and security hardening remain separate checks. `READY` certifies the stated MCP/install checks, not every tool's external integration. Existing services, databases, vault conflicts, and historical release snapshots were not migrated or replaced.
