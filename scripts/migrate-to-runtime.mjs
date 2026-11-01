#!/usr/bin/env node
/**
 * Migrate an existing MCP client config from 10 individual HeLa servers
 * to the single HeLa Runtime endpoint.
 *
 * Usage:
 *   node scripts/migrate-to-runtime.mjs --input ~/.config/opencode/opencode.json --output ./opencode.runtime.json
 *   node scripts/migrate-to-runtime.mjs --input ./cursor.json --output ./cursor.runtime.json --backend cursor
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { input: null, output: null, backend: 'auto', root: null, profile: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--input') a.input = argv[++i];
    else if (x === '--output') a.output = argv[++i];
    else if (x === '--backend') a.backend = argv[++i];
    else if (x === '--root') a.root = argv[++i];
    else if (x === '--profile') a.profile = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) { console.error('Usage: --input <config> [--output <file>] [--backend auto|opencode|cursor|claude]'); process.exit(1); }

const root = args.root || path.resolve(__dirname, '../..');
const runtimeEntry = path.join(root, 'hela-runtime', 'dist', 'index.js');
const ecosystemRoot = path.join(root, 'hela-mcp-ecosystem');

const raw = JSON.parse(fs.readFileSync(args.input, 'utf8'));

// Detect profile: if heavy/specialized cells were in use, keep 'all'; else dev-workspace
if (!args.profile) {
  const heavy = ['hela-receptor', 'hela-plastid', 'hela-cytosol'];
  const present = [];
  function collectKeys(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) if (k.startsWith('hela-')) present.push(k);
  }
  if (raw.mcp) collectKeys(raw.mcp);
  if (raw.mcpServers) collectKeys(raw.mcpServers);
  if (raw.context_servers) collectKeys(raw.context_servers);
  const hasHeavy = present.some((k) => heavy.includes(k));
  args.profile = hasHeavy ? 'all' : 'dev-workspace';
}

// collect env vars from existing hela-* entries to carry over
const carryKeys = ['OPENROUTER_API_KEY','GITHUB_TOKEN','GOOGLE_API_KEY','GOOGLE_CSE_ID','MEMORY_FILE_PATH','SCRCPY_SERVER_PATH','HELA_BROWSER_ALLOW_EVAL','HELA_ALLOWED_ROOTS'];
const carried = {};
function harvest(env) {
  if (!env || typeof env !== 'object') return;
  for (const k of carryKeys) if (env[k]) carried[k] = env[k];
}

// detect format
let format = args.backend;
if (format === 'auto') {
  if (raw && raw.mcp && !raw.mcpServers) format = 'opencode';
  else if (raw && raw.context_servers) format = 'zed';
  else if (raw && raw.mcpServers) format = 'cursor';
  else format = 'opencode';
}

let changed = false;

if (format === 'opencode') {
  const mcp = raw.mcp || {};
  // remove hela-* entries, harvest env
  for (const k of Object.keys(mcp)) {
    if (k.startsWith('hela-')) { harvest(mcp[k].environment || mcp[k].env); delete mcp[k]; changed = true; }
  }
  mcp['hela-runtime'] = {
    type: 'local',
    enabled: true,
    command: ['node', runtimeEntry],
    environment: {
      HELA_ECOSYSTEM_ROOT: ecosystemRoot,
      HELA_PROFILE: args.profile,
      HELA_HTTP_PORT: '8787',
      ...carried,
    },
  };
  raw.mcp = mcp;
} else if (format === 'zed') {
  const mcp = raw.context_servers || {};
  for (const k of Object.keys(mcp)) {
    if (k.startsWith('hela-')) { harvest(mcp[k].env || mcp[k].environment); delete mcp[k]; changed = true; }
  }
  mcp['hela-runtime'] = {
    enabled: true,
    command: 'node',
    args: [runtimeEntry],
    env: {
      HELA_ECOSYSTEM_ROOT: ecosystemRoot,
      HELA_PROFILE: args.profile,
      HELA_HTTP_PORT: '8787',
      ...carried,
    },
  };
  raw.context_servers = mcp;
} else {
  const mcp = raw.mcpServers || {};
  for (const k of Object.keys(mcp)) {
    if (k.startsWith('hela-')) { harvest(mcp[k].env); delete mcp[k]; changed = true; }
  }
  mcp['hela-runtime'] = {
    command: 'node',
    args: [runtimeEntry],
    env: {
      HELA_ECOSYSTEM_ROOT: ecosystemRoot,
      HELA_PROFILE: args.profile,
      HELA_HTTP_PORT: '8787',
      ...carried,
    },
  };
  raw.mcpServers = mcp;
}

const out = args.output || args.input + '.runtime.json';
fs.writeFileSync(out, JSON.stringify(raw, null, 2) + '\n');
console.log(`Migrated ${changed ? '10 hela-* entries' : 'entries'} -> single hela-runtime in ${out}`);
console.log('Carried env keys:', Object.keys(carried).join(', ') || '(none)');
