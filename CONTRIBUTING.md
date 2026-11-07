# Contributing to the HeLa MCP Ecosystem

Thank you for your interest in contributing to the **HeLa MCP Ecosystem**! This document provides guidelines and information for contributors and maintainers.

![Blotcat carefully placing a new, glowing building block on top of an established, complex structure](assets/blotcat-contributing.jpg)

---

## 1. Architectural Boundaries & 10-MCP Ceiling

* **The 10-MCP Capability Ceiling**: The ecosystem maintains exactly 10 canonical MCP servers (7 core headless, 3 specialized GUI/device). Contributions focus on reliability, performance, tool quality, and testing rather than adding new server repositories.
* **The 4-Tier Naming Architecture**:
  * Tier 1: Public Identity (`HeLa <Component>`, e.g. *HeLa Mitosis*, *HeLa Genome*)
  * Tier 2: Machine Identifier (`hela-*`, e.g. `hela-mitosis`, `hela-genome`)
  * Tier 3: Technical Source Repository (`chaining-mcp`, `project-mcp`, etc.)
  * Tier 4: Immutable Commit Hash (the selected immutable snapshot in `config/snapshots/`)
* **Repository Autonomy**: Upstream repositories remain independent and modular.

---

## 2. Development & Verification Workflow

### 2.1 Local Environment Setup
```bash
git clone https://github.com/Hela-Ecosystem/hela-mcp-ecosystem.git
cd hela-mcp-ecosystem
./setup.sh --profile dev-workspace --client skip --non-interactive
```

### 2.2 Running Diagnostics & Tests
Before submitting changes, ensure all test suites pass locally:

```bash
# 1. Run diagnostic health checks
npm run doctor

# 2. Run 80-combination client configuration checks
npm run test:matrix

# 3. Run standalone MCP integration (tool counts depend on features)
npm test

# 4. Keep generated versions, tool references and site metadata current
npm ci --ignore-scripts
npm run docs:generate
npm run docs:check
npm run test:docs

# 5. Run configured pre-commit checks
pre-commit run --all-files
```

### 2.3 Build and preview the complete documentation site

Use Node.js 22 LTS. Markdown rendering is a pinned build-only dependency; visitors receive static HTML, not a client-side Markdown framework.

```bash
npm ci --ignore-scripts
npm run docs:generate
npm run docs:build
python3 -m http.server 8080 --bind 127.0.0.1 --directory _site
```

Open `http://127.0.0.1:8080/library.html`. The builder publishes tracked root documentation, all Markdown under `docs/` (except website source files), Conductor records, the license, and public configuration examples. Add new documents to Git before building so they enter the publication inventory. Untracked notes, credentials, databases, Git internals and unrelated directories are not published.

The document bodies remain in their source language; English and Indonesian navigation lead to the same source content. Dated verification reports and milestone tracks are labeled historical. Relative document links, heading anchors and illustrations resolve within the website; original source downloads and `llms-full.txt` are generated from the same files.

`npm run test:docs` checks publication coverage, links and anchors, safe Markdown rendering, source downloads, search, and deterministic builds. The existing Pages workflow installs the locked dependencies, checks the docs, and publishes `_site` to `gh-pages` when public documentation changes. Do not edit `_site` by hand.

---

## 3. Pull Request Guidelines

1. **Target Branch**: Target the maintained default branch (`master`) unless a maintainer requests a release/development branch.
2. **Commit Conventions**: Follow standard Conventional Commits:
   * `feat(scope): ...`
   * `fix(scope): ...`
   * `docs(scope): ...`
   * `test(scope): ...`
   * `chore(scope): ...`
3. **CI Matrix Conformance**: Configuration checks cover `ubuntu-latest` and `macos-latest` on Node.js 18, 20, and 22; documentation builds and tests run on Node 22. This is not MCP runtime compatibility evidence for Node 18; use Node 22 LTS for the tested full-stack development environment. Hardware, provider and authenticated GUI integrations need separate validation.

---

## 4. Attribution & Recognition

The HeLa project respectfully recognizes **Henrietta Lacks** and the enduring scientific legacy of HeLa cells as an inspiration for immortal, modular cellular architecture in software.
