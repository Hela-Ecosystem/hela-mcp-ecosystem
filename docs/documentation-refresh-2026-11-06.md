# Documentation refresh — 2026-11-06

Ecosystem **1.5.1** is a documentation-only source snapshot. The ten MCP cells remain **3.0.0**; runtime remains **1.2.0** at its existing implementation revision. [Current versions](current-versions.md) and [profile counts](generated-profile-counts.md) are generated from canonical metadata.

## Scope

- Audited all 12 repositories. Updated the ten cells' README version banners and generated canonical tool references; the runtime's existing 1.2.0 reference was already current.
- Completed all 16 English/Indonesian website pages, including current architecture, profiles, requirements, runtime behavior, diagnostics, privacy, and historical showcase labels.
- Corrected Codex keys and actual repository paths, including Plastid's `brain` entrypoint. Browser previews intentionally omit private environment values and are not byte-identical installation files.
- Regenerated seven committed client examples with a sanitized environment. The older seven-cell Compose file is explicitly a deployment scaffold, not full-profile or transport acceptance evidence.
- Preserved v1.0.0–v1.5.0 snapshots, historical release evidence, and independently versioned Blender/HyperFrames/vendor material.

## Verification

- Documentation generation is idempotent; `docs:check` and all **74** documentation/configuration regressions pass. These checks include local web links/anchors, unique IDs, JSON-LD, current versions, canonical tool lists, script ordering, and release cache-busting.
- CLI matrix: **80/80** profile/backend cases. Probe and inventory regressions: **4/4** each. Strict package/MCP/inventory/snapshot versions and revision pins: **11/11**.
- Standalone integration and safe cross-cell checks: **15/15** across ten servers, with no tool-name collisions in the feature-disabled probe environment.
- All eight profiles: **16/16** namespace-mode checks pass, with exact schemas, zero discovery startups, and safe read-only routing.
- Fresh native ARM probes validate all eight `dev-workspace` cells against the new documentation revisions. Schema parity retains both verified Nucleus build digests; compiled implementation bytes were reused, not rebuilt as a new software release.
- Browser checks: **64** visible configurator selections per language; **16** pages at **1200 px** and **390 px** widths without document-level horizontal overflow. Desktop/mobile screenshots were inspected. Canonical search links, successful copy, and denied-clipboard feedback were checked; failed clipboard writes no longer claim success.
- Current Markdown file-link scan: **104** references checked, no missing targets. This is not an exhaustive external-link availability guarantee.
- Secret scanning found only the pre-existing probe-test sentinel; no new credentials were added. Hardware, providers, and authenticated ACP/GUI sessions were not exercised by this documentation refresh.

## Publication boundaries

Plastid and Receptor had unrelated remote dependency updates. Documentation-only commits were merged into their default branches without discarding those updates. Snapshot v1.5.1 deliberately pins the documentation-only parents, not unvalidated dependency changes.

The Pages workflow validates generated documentation and its tests before publishing. Source commit: `7f95832b4f0b9e6ba3057ffbb7df84b62e2bcd91`. Published Pages commit: `3077d3f8d02436637b4322407c58621069dfe922`.

- [Ecosystem CI](https://github.com/Hela-Ecosystem/hela-mcp-ecosystem/actions/runs/42233639731): successful.
- [Validated site build/sync](https://github.com/Hela-Ecosystem/hela-mcp-ecosystem/actions/runs/42233639734): successful.
- [GitHub Pages deployment](https://github.com/Hela-Ecosystem/hela-mcp-ecosystem/actions/runs/42233666134): successful.
- Public checks at [hela.my.id](https://hela.my.id/) and its Indonesian pages: all **16** pages return HTTP 200 with v1.5.1 and versioned scripts; all **26** discovered internal resources return success. Generated data, app, stylesheet, counts, and the hero image load successfully.
- Public browser configurators pass **64 selections per language**, with exact profile membership, current metadata, working canonical search links, and no desktop/mobile document overflow.

No live runtime was restarted or reconfigured. Servy's service remained active at PID `715090`, with zero automatic restarts during native ARM catalog verification. Active databases, existing vault conflicts, security settings, credentials, and unrelated client configurations were not changed. Deferred endpoint security, authenticated ACP acceptance, deliberate external-client reloads, legacy gateway retirement, and conflict reconciliation remain separate work.
