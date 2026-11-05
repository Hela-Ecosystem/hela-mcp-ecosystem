# Changelog

All notable changes to this project.

## [1.4.0] - 2026-11-06

- Pin current published cell/runtime revisions in a new snapshot; retain v1.0.0–v1.3.0 unchanged and correct runtime snapshot metadata to 1.1.0.
- Include Genome memory safety, atomic claims, runtime timeout recovery, and clean-install Zod 4 compatibility fixes.
- Replace process-alive smoke checks with isolated MCP initialize/tool discovery and strict version/pin agreement.
- Correct Codex TOML to `mcp_servers`, escape generated values, and verify the 80-combination configuration matrix.
- Record native x86_64/aarch64 Linux Nix builds separately from client authentication, hardware testing, and unresolved vault conflicts.

## [3.0.0] - 2026-10-31

### Changed
- **Version reset to 3.0.0** — per-server version metadata baseline reset (Phase 7). All `package.json`, MCP `ServerInfo.version`, and HTTP metadata now report `3.0.0`. This is a metadata/interface baseline reset; for `hela-plastid` it is not an upgrade from the previous `4.2.0` advert.
