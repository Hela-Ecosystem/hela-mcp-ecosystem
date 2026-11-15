# Prebuilt agent skills

HeLa MCP servers can ship companion agent skills alongside their MCP tools. Skills provide task workflows and reference material to compatible agent harnesses; they do not add MCP tools or change server authorization. The skill list belongs to each server's `skills` array in [`config/inventory.json`](../config/inventory.json), and selected profiles determine which servers' skills are eligible.

## Server catalog

| Server | Bundled skills | Source |
| :--- | :--- | :--- |
| **Mitosis** (`hela-mitosis`) | [`skill-finder`](https://github.com/Hela-Ecosystem/chaining-mcp/tree/master/skills/skill-finder), [`human-writing`](https://github.com/Hela-Ecosystem/chaining-mcp/tree/master/skills/human-writing), [`caveman`](https://github.com/Hela-Ecosystem/chaining-mcp/tree/master/skills/caveman), [`mema-vault`](https://github.com/Hela-Ecosystem/chaining-mcp/tree/master/skills/mema-vault), [`blotcat-illustrations`](https://github.com/Hela-Ecosystem/chaining-mcp/tree/master/skills/blotcat-illustrations), [`pcb`](https://github.com/Hela-Ecosystem/chaining-mcp/tree/master/skills/pcb) | [`chaining-mcp`](https://github.com/Hela-Ecosystem/chaining-mcp) |
| **Genome** (`hela-genome`) | [`code-reviewer`](https://github.com/Hela-Ecosystem/project-mcp/tree/master/skills/code-reviewer), [`guardian-cache`](https://github.com/Hela-Ecosystem/project-mcp/tree/master/skills/guardian-cache), [`guardian-memory`](https://github.com/Hela-Ecosystem/project-mcp/tree/master/skills/guardian-memory), [`guardian-security`](https://github.com/Hela-Ecosystem/project-mcp/tree/master/skills/guardian-security), [`guardian-session`](https://github.com/Hela-Ecosystem/project-mcp/tree/master/skills/guardian-session), [`guardian-tracker`](https://github.com/Hela-Ecosystem/project-mcp/tree/master/skills/guardian-tracker), [`guardian-wall`](https://github.com/Hela-Ecosystem/project-mcp/tree/master/skills/guardian-wall) | [`project-mcp`](https://github.com/Hela-Ecosystem/project-mcp) |
| **Cytosol** (`hela-cytosol`) | [`browser-agent`](https://github.com/Hela-Ecosystem/browser-mcp/tree/master/skill/browser-agent) | [`browser-mcp`](https://github.com/Hela-Ecosystem/browser-mcp) |
| **Phenotype** (`hela-phenotype`) | [`logo-design`](https://github.com/Hela-Ecosystem/designer-mcp/tree/master/skills/logo-design), [`motion-designer`](https://github.com/Hela-Ecosystem/designer-mcp/tree/master/skills/motion-designer), [`brand-architecture`](https://github.com/Hela-Ecosystem/designer-mcp/tree/master/skills/brand-architecture), [`modern-web-guidance`](https://github.com/Hela-Ecosystem/designer-mcp/tree/master/skills/modern-web-guidance), [`video`](https://github.com/Hela-Ecosystem/designer-mcp/tree/master/skills/video) | [`designer-mcp`](https://github.com/Hela-Ecosystem/designer-mcp) |
| **Membrane, Nucleus, Ribosome, Enzyme, Receptor, Plastid, Runtime** | No bundled agent skills declared in the current inventory. | See their repositories in [`config/inventory.json`](../config/inventory.json). |

## Profile availability

Every profile includes Mitosis and Genome, so their 13 skills are available in every profile. The specialist skills below are available only when the profile includes their server:

| Profile | Additional skill server(s) | Additional skills |
| :--- | :--- | :--- |
| `minimal` | — | — |
| `dev-workspace` | Cytosol, Phenotype | `browser-agent`, `logo-design`, `motion-designer`, `brand-architecture`, `modern-web-guidance`, `video` |
| `headless-server` | Phenotype | `logo-design`, `motion-designer`, `brand-architecture`, `modern-web-guidance`, `video` |
| `research` | Cytosol | `browser-agent` |
| `web-devops` | Cytosol, Phenotype | `browser-agent`, `logo-design`, `motion-designer`, `brand-architecture`, `modern-web-guidance`, `video` |
| `android-testing` | — | — |
| `3d-modeling` | — | — |
| `all` | Cytosol, Phenotype | `browser-agent`, `logo-design`, `motion-designer`, `brand-architecture`, `modern-web-guidance`, `video` |

The inventory and profile definitions are the source of truth. Regenerate or review this mapping after changing either `skills[]` in `config/inventory.json` or membership in `config/profiles.json`.

## How skills are installed and refreshed

- A skill is declared on its owning server with a repository-relative `path`. Its source directory must contain `SKILL.md`.
- `npm run skills:sync -- --profile <id>` mirrors skills from servers in that profile to the configured harness skills directory. Use `--all` for the complete catalog. The sync reads the installed source checkouts, so a profile without Phenotype does not receive Phenotype skills.
- `npm run skills:check -- --profile <id>` reports missing, changed, or duplicate skill copies without writing. Run the corresponding `skills:sync` command after updating server checkouts.
- Managed installations pin each server to a commit in their selected snapshot. The tracked `config/inventory.json` pins the source snapshot; release snapshots preserve their original commits and are not rewritten to absorb later skill changes.
- Skills are an agent-harness companion layer. A server may have tools without a skill, and an installed skill does not imply that its MCP server is active in the selected profile.

## Modern Web Guidance pin and requirements

Phenotype **3.0.3**, pinned in `config/inventory.json` to commit [`d9bf96d460f8de3adc5d5627efd76f8f23d8ee2a`](https://github.com/Hela-Ecosystem/designer-mcp/tree/d9bf96d460f8de3adc5d5627efd76f8f23d8ee2a), bundles the Apache-2.0 skill from [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) at release `v1.0.0`, commit [`4dd968349e54ca45a05dd5c818fb035c9054b022`](https://github.com/GoogleChrome/modern-web-guidance/tree/4dd968349e54ca45a05dd5c818fb035c9054b022). The bundled skill pins the CLI to `modern-web-guidance@1.0.0` and the guidance corpus to `2026_11_09-5bcc021b`. The skill and license are included in the Phenotype checkout and synced with its other skills; querying guidance uses the CLI and therefore needs Node.js 22+ and outbound network access. See the skill's [`UPSTREAM.md`](https://github.com/Hela-Ecosystem/designer-mcp/blob/d9bf96d460f8de3adc5d5627efd76f8f23d8ee2a/skills/modern-web-guidance/UPSTREAM.md) and [`SKILL.md`](https://github.com/Hela-Ecosystem/designer-mcp/blob/d9bf96d460f8de3adc5d5627efd76f8f23d8ee2a/skills/modern-web-guidance/SKILL.md).

Updating this skill requires refreshing the upstream skill files and license, verifying the CLI and corpus pins, updating Phenotype's installed-skills catalog, then recording the new Phenotype commit in the ecosystem inventory. Keep immutable historical snapshots unchanged.
