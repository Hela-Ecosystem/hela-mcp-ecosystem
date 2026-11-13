# HeLa MCP Ecosystem: Keys & Secrets Guide

![Blotcat Secrets & Credentials Vault](../assets/blotcat-secrets.jpg)

This document explains prerequisites and optional provider credentials. Keyless operation is not the same as offline operation or a guarantee of free/unlimited external services. See [current versions](current-versions.md) for software metadata and [security status](security-audit.md) for unresolved access-control work.

---

## 1. System Prerequisites

Before running setup, ensure your system meets the baseline requirements:

- **Node.js:** 22 LTS is the tested full-stack environment. Enzyme requires at least 20.18.1 and Receptor requires 22; other packages declare their own standalone ranges.
- **npm:** use the version bundled with the selected Node runtime and install locked dependencies with `npm ci`; no global npm upgrade is required by this guide.
- **Git:** use a current version (release snapshots specify at least 2.30).
- **SQLite:** Genome uses Node SQLite bindings; the SQLite CLI is optional for inspection. Do not replace active database files during upgrades.
- **Docker/Compose:** optional, and generated Compose files are scaffolds requiring transport/device/persistence review.

---

## 2. Keys & Secrets Catalog

Provider credentials are optional for MCP discovery and keyless capabilities. A selected external operation can still require credentials, network access, an installed local engine, or a live external service.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HELA MCP KEY MATRIX                             │
├───────────────────────┬──────────────────────┬─────────────┬───────────┤
│ Secret Name           │ Target Component     │ Necessity   │ Fallback  │
├───────────────────────┼──────────────────────┼─────────────┼───────────┤
│ OPENROUTER_API_KEY    │ HeLa Mitosis         │ Optional    │ Local*    │
│ GITHUB_TOKEN          │ HeLa Mitosis         │ Optional    │ Bundled   │
│ GOOGLE_API_KEY        │ HeLa Enzyme          │ Optional    │ Wikipedia │
│ GOOGLE_CSE_ID         │ HeLa Enzyme          │ Optional    │ Wikipedia │
└───────────────────────┴──────────────────────┴─────────────┴───────────┘
```

`Local*` depends on the bundled/configured Needle engine and model. The matrix is not a guarantee that every tool can complete without its required provider or hardware.

---

### 1. `OPENROUTER_API_KEY`

* **Target Component**: **HeLa Mitosis** (`hela-mitosis` / `chaining-mcp`)
* **Purpose**: Powers dynamic LLM intelligence for task decomposition (`llm_decompose_task`), AI route ranking (`llm_suggest_route`), and query routing (`llm_query`).
* **Where to get it**:
  1. Visit [OpenRouter API Keys](https://openrouter.ai/keys).
  2. Create a free account.
  3. Generate an API key (`sk-or-v1-...`).
  4. Provider model availability, quotas, and pricing can change; check the provider before relying on a free route.
* **If you DO NOT have it**:
   * **Consequence**: Provider-backed calls need some configured provider credentials; another configured provider can still be used when supported. Local planning can work without keys when its engine/model are available.
   * **Fallback Behavior**: Needle planning/execution and budgeted escalation are separate. Unavailable escalation can hand control back to the caller; `brainstorming` needs a generative model and fails when none is configured. This is not a universal latency, crash-freedom, or offline guarantee.

---

### 2. `GITHUB_TOKEN`

* **Target Component**: **HeLa Mitosis** (`hela-mitosis` / `chaining-mcp`)
* **Purpose**: Synchronizes the latest community prompt collections, guidelines, and chatmodes from GitHub repositories at runtime.
* **Where to get it**:
  1. Visit [GitHub Personal Access Tokens](https://github.com/settings/tokens).
  2. Generate a token with public read-only access.
* **If you DO NOT have it**:
  * **Consequence**: Live GitHub syncing is disabled.
   * **Fallback Behavior**: Bundled prompt/instruction catalogs remain available. This does not make unrelated research, browser, provider, or remote-runtime operations offline.

---

### 3. `GOOGLE_API_KEY` & `GOOGLE_CSE_ID`

* **Target Component**: **HeLa Enzyme** (`hela-enzyme` / `researcher-mcp`)
* **Purpose**: Optional Tier 1 web search queries via the Google Custom Search JSON API.
* **Where to get them**:
   1. **API Key**: Use [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and check current Custom Search API availability and quotas for your account.
  2. **CSE ID**: Create a Search Engine ID at [Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all) (set Search the entire web = ON).
* **If you DO NOT have them**:
   * **Consequence**: Configured Google CSE is unavailable; supported keyless network fallbacks may still work. Network failures, rate limits, and provider availability remain possible.
  * **Fallback Behavior**: Live web search cascades to keyless parallel search (DuckDuckGo, Bing, etc.) and Wikipedia fallback. `academic_search` queries arXiv's public OpenSearch API, `news_monitor` queries Google News RSS feeds, `search_trends` queries Hacker News Algolia, and content extraction falls back to Jina Reader (`r.jina.ai`).

---

## 3. Configuration & Diagnostics

### Initial Setup
Run the setup script:
```bash
node setup.mjs
```
The installer reads optional provider keys from environment and never prompts for or accepts secret values as CLI flags. Keyless defaults can still use the network. Generated private client fragments can contain supplied credentials; review them before sharing, and merge them into client settings deliberately.

### Reconfiguring Keys Anytime
To update keys or change clients on an installed ecosystem:
```bash
node setup.mjs --reconfigure
```

### Safe Diagnostic Health Check
To verify your environment and check which fallbacks are active without exposing keys in logs:
```bash
node setup.mjs doctor
```
