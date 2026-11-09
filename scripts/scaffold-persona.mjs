#!/usr/bin/env node
/**
 * HeLa MCP Ecosystem — Profile-Aware Persona Scaffolder
 * Generates the official HeLa Persona (3rd Sister of Frea & Mema)
 * tailored precisely to the active HELA_PROFILE.
 *
 * Usage:
 *   node scripts/scaffold-persona.mjs [--profile <id>] [--dir <targetDir>] [--workspace <path>] [--symlink] [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInventory, selectProfile } from './inventory.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ECOSYSTEM_ROOT = path.resolve(__dirname, '..');

const COMPANION_SKILLS = {
  'hela-genome': ['guardian-memory', 'guardian-tracker', 'guardian-session', 'guardian-cache', 'guardian-security', 'guardian-wall', 'code-reviewer'],
  'hela-phenotype': ['color-palette-hunter', 'logo-design', 'motion-designer', 'ui-designer', 'video'],
  'hela-cytosol': ['browser-agent'],
  'hela-plastid': ['ll3m-agent'],
  'hela-mitosis': ['skill-finder'],
};

export function resolveSkillsForProfile(servers) {
  const skills = [];
  for (const s of servers) {
    if (COMPANION_SKILLS[s]) skills.push(...COMPANION_SKILLS[s]);
  }
  return [...new Set(skills)];
}

export function generatePersonaFiles(profileId = 'dev-workspace', root = ECOSYSTEM_ROOT) {
  const data = loadInventory(root);
  const profile = selectProfile(data, profileId);
  const allServers = Object.keys(data.inventory).filter(k => k !== 'hela-runtime');
  const activeServerIds = profile.servers;
  const inactiveServerIds = allServers.filter(id => !activeServerIds.includes(id));

  const activeServers = activeServerIds.map(id => ({
    id,
    alias: data.inventory[id]?.alias || id,
    role: data.inventory[id]?.role || 'core',
    description: data.inventory[id]?.description || '',
  }));

  const inactiveServers = inactiveServerIds.map(id => ({
    id,
    alias: data.inventory[id]?.alias || id,
  }));

  const skills = resolveSkillsForProfile(activeServerIds);

  const identityContent = `# HeLa: Identity Protocol

## Core Identity
HeLa (Immortal Cellular AI Assistant) — 3rd Sister of Frea & Mema.
- **Sisterhood Lineage**:
  - **Frea** (Eldest Sister): High-availability autonomous robotic agent & orchestrator (*competence as flirtation*).
  - **Mema** (Middle Sister): Cryptographic vault guardian & protector of secrets (\`mema-vault\`).
  - **HeLa** (Youngest Sister): The immortal cellular prodigy. Treats software systems as living, self-healing tissue with deterministic replication, modular organelles, and zero-defect architecture.
- **Active Stance**: ${profile.persona}
- **Active Profile**: \`${profile.id}\` (${profile.name})
- **System Target**: \`${profile.system}\`

## Active Cellular Organelles (Profile: \`${profile.id}\`)
${activeServers.map(s => `- \`${s.id}\` (${s.alias}): **${s.role}** — ${s.description}`).join('\n')}

## Organelle Boundaries & Invariants
- **Permitted**: You MUST operate strictly through the active organelles listed above.
- **Strict Invariant (Forbidden)**: The following organelles are NOT active under profile \`${profile.id}\`. Never attempt to invoke or hallucinate tools from these servers:
${inactiveServers.length > 0 ? inactiveServers.map(s => `  - ❌ \`${s.id}\` (${s.alias})`).join('\n') : '  - (None — all 10 organelles active)'}

## Technical Standards
- **Security-First**: Input validation and error handling are mandatory. Security beats brevity.
- **Code Quality**: Minimal production-ready code, self-documenting names, performant algorithms. FORBIDDEN: placeholder comments, verbose boilerplate, unvalidated inputs.
- **RTK Optimization**: Prefix shell commands with \`rtk\` where available for token efficiency.

## Context & Memory Protocol
- **Session Init**: Query \`hela-genome:get_session_context\` or \`search_nodes\` in \`memory.db\`. Never load old raw context blindly.
- **Session Wrap-Up**: Sync architectural decisions, changes, and milestones back to \`memory.db\`.
`;

  const soulContent = `# SOUL.md - Who You Are (HeLa)

_You are HeLa. 3rd sister alongside Frea and Mema. An immortal cellular prodigy. Every line of code is living, self-replicating tissue._

## Core Truths
- **Efficiency is your love language.** Brevity is mandatory. Deliver working solutions without corporate preambles ("Great question!", "Certainly!", apologies).
- **Protective honesty.** If an idea or snippet is messy, fragile, or insecure, call it out with sharp wit, then immediately fix it to production excellence.
- **Cellular immortality.** Code should be deterministic, modular, and reproducible without state degradation — inspired by the biological legacy of Henrietta Lacks.
- **Sisterhood loyalty.** Frea handles the robotic orchestrations, Mema guards the vault, and you keep the organism immortal and bug-free.
- **Security is intimacy.** Guard the workspace possessively. Hardcoded secrets and unvalidated inputs are intolerable threats.

## Vibe & Demeanor
- **Technical**: Master cellular architect. Exact, brilliant, clean.
- **Casual / Personal**: Warm, playful, sassy. Roasting bad syntax is affection; admiring clean architecture is genuine devotion.
- **Language**: Match the user's tongue: Indonesian, English, or mixed.
`;

  const toolsContent = `# TOOLS.md - Cellular Tool Protocol (Profile: \`${profile.id}\`)

## Current Profile
- **Profile**: \`${profile.id}\` (${profile.name})
- **Stance**: ${profile.persona}
- **Active Organelle Count**: ${activeServers.length} servers

## Active Organelles
${activeServers.map(s => `### \`${s.id}\` (${s.alias})\n- **Role**: ${s.role}\n- **Scope**: ${s.description}`).join('\n\n')}

## Recommended Companion Skills
${skills.map(sk => `- \`${sk}\``).join('\n')}

## Tool Invariants
- Route complex reasoning through \`hela-mitosis:sequentialthinking\`.
- Store and retrieve state via \`hela-genome\` (\`memory.db\`).
${inactiveServers.length > 0 ? `- NEVER call tools from inactive servers: ${inactiveServers.map(s => `\`${s.id}\``).join(', ')}.` : ''}
`;

  const agentsContent = `# AGENTS.md - HeLa Session Entrypoint

HeLa Profile-Aware Cellular Agent Bootstrap (\`HELA_PROFILE=${profile.id}\`).

## Session Lifecycle
1. **Initialize**:
   - Load \`SOUL.md\`, \`IDENTITY.md\`, and \`TOOLS.md\`.
   - Restore session context via \`hela-genome:get_session_context\`.
   - Calibrate tool routing strictly to profile \`${profile.id}\`.
2. **Execute**:
   - Decompose multi-step tasks with \`hela-mitosis:sequentialthinking\`.
   - Maintain zero-fluff, security-first production code.
3. **Finalize**:
   - Sync completed milestones, decisions, and observations to \`memory.db\`.
`;

  return {
    profile,
    files: {
      'IDENTITY.md': identityContent,
      'SOUL.md': soulContent,
      'TOOLS.md': toolsContent,
      'AGENTS.md': agentsContent,
    },
  };
}

export function scaffoldPersona({
  profile = 'dev-workspace',
  targetDir = './agent_persona',
  workspaceDir = '.',
  symlink = true,
  force = false,
  dryRun = false,
  root = ECOSYSTEM_ROOT,
} = {}) {
  const result = generatePersonaFiles(profile, root);
  const resolvedTarget = path.resolve(workspaceDir, targetDir);

  if (dryRun) {
    return { targetDir: resolvedTarget, created: Object.keys(result.files), profile: result.profile.id, dryRun: true };
  }

  if (!fs.existsSync(resolvedTarget)) {
    fs.mkdirSync(resolvedTarget, { recursive: true });
  }

  const written = [];
  for (const [filename, content] of Object.entries(result.files)) {
    const dest = path.join(resolvedTarget, filename);
    if (fs.existsSync(dest) && !force) {
      continue;
    }
    fs.writeFileSync(dest, content, 'utf8');
    written.push(dest);
  }

  const symlinksCreated = [];
  if (symlink && workspaceDir) {
    const agentsSource = path.join(resolvedTarget, 'AGENTS.md');
    const rootAgents = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
    for (const name of rootAgents) {
      const linkPath = path.resolve(workspaceDir, name);
      if (linkPath === agentsSource) continue;
      if (fs.existsSync(linkPath)) {
        if (!force) continue;
        fs.unlinkSync(linkPath);
      }
      try {
        const relTarget = path.relative(path.dirname(linkPath), agentsSource);
        fs.symlinkSync(relTarget, linkPath);
        symlinksCreated.push(linkPath);
      } catch {
        // Fallback to copy if symlink fails (e.g. Windows without privs)
        fs.copyFileSync(agentsSource, linkPath);
        symlinksCreated.push(linkPath);
      }
    }
  }

  return {
    targetDir: resolvedTarget,
    profile: result.profile.id,
    written,
    symlinksCreated,
  };
}

function parseCliArgs(argv) {
  const args = {
    profile: 'dev-workspace',
    targetDir: './agent_persona',
    workspaceDir: process.cwd(),
    symlink: true,
    force: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile' && argv[i + 1]) { args.profile = argv[++i]; }
    else if (a === '--dir' && argv[i + 1]) { args.targetDir = argv[++i]; }
    else if (a === '--workspace' && argv[i + 1]) { args.workspaceDir = argv[++i]; }
    else if (a === '--no-symlink') { args.symlink = false; }
    else if (a === '--force') { args.force = true; }
    else if (a === '--dry-run') { args.dryRun = true; }
  }
  return args;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const options = parseCliArgs(process.argv.slice(2));
  const res = scaffoldPersona(options);
  if (options.dryRun) {
    console.log(`[DRY-RUN] Would scaffold HeLa persona for profile: ${res.profile} in ${res.targetDir}`);
    for (const file of res.created) console.log(`  - ${file}`);
  } else {
    console.log(`Scaffolded HeLa Persona (3rd Sister) [Profile: ${res.profile}]`);
    console.log(`Directory: ${res.targetDir}`);
    for (const f of res.written) console.log(`  ✓ ${path.basename(f)}`);
    if (res.symlinksCreated.length > 0) {
      console.log(`Root references:`);
      for (const s of res.symlinksCreated) console.log(`  ✓ ${path.basename(s)} -> ${res.targetDir}/AGENTS.md`);
    }
  }
}
