#!/usr/bin/env node
/**
 * mcp-ecosystem — Config Generator
 * Emits target MCP client configurations for a chosen profile + backend.
 *
 * Usage:
 *   node scripts/generate-config.mjs <profileId> --backend <cursor|claude|opencode|zed|docker|print> [--root <path>] [--out <file>]
 *
 * Resolves every profile server against inventory.json and renders the config
 * with absolute paths derived from --root (defaults to the ecosystem root).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInventory, resolveServerDir } from './inventory.mjs';
import { readInstallation, composeConfiguration, containerArgs, modes } from './installation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ECOSYSTEM_ROOT = path.resolve(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function metadataRoot(root) {
  return fs.existsSync(path.join(root, 'config/inventory.json')) ? root : ECOSYSTEM_ROOT;
}

function readInventoryData(root) {
  const data = loadInventory(metadataRoot(root));
  return {
    inventory: data.inventory,
    aliases: data.aliases || {},
  };
}

function readProfiles(root) {
  return loadInventory(metadataRoot(root)).profiles;
}

function parseArgs(argv) {
  const args = {
    profile: null,
    backend: null,
    root: ECOSYSTEM_ROOT,
    out: null,
    runtime: false,
    mode: 'individual',
    openrouterKey: process.env.OPENROUTER_API_KEY || null,
    githubToken: process.env.GITHUB_TOKEN || null,
    googleKey: process.env.GOOGLE_API_KEY || null,
    googleCseId: process.env.GOOGLE_CSE_ID || null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--backend' || arg === '--client') args.backend = argv[++i];
    else if (arg === '--profile') args.profile = argv[++i];
    else if (arg === '--root') args.root = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--stdout') args.out = null;
    else if (arg === '--runtime') args.runtime = true;
    else if (arg === '--mode') args.mode = argv[++i];
    else if (arg === '--prefix') args.prefix = argv[++i];
    else if (arg === '--image') args.image = argv[++i];
    else if (arg === '--url') args.url = argv[++i];
    else if (arg === '--openrouter-key' || arg === '--openrouter') args.openrouterKey = argv[++i];
    else if (arg === '--github-token' || arg === '--github') args.githubToken = argv[++i];
    else if (arg === '--google-key' || arg === '--google') args.googleKey = argv[++i];
    else if (arg === '--google-cse-id' || arg === '--cse') args.googleCseId = argv[++i];
    else if (args.profile === null && !arg.startsWith('-')) args.profile = arg;
    else throw new Error(`Unknown configuration option: ${arg}`);
  }
  return args;
}

function resolveServers(profile, inventory, aliases = {}) {
  const resolved = [];
  const seen = new Set();
  for (const rawId of profile.servers) {
    const id = aliases[rawId] || rawId;
    if (seen.has(id)) continue;
    seen.add(id);
    const info = inventory[id] || inventory[rawId];
    if (!info) {
      console.error(`[warn] Profile "${profile.id}" references unknown server "${rawId}". Skipping.`);
      continue;
    }
    if (info.clientFacing === false) {
      console.error(`[info] Skipping non-client-facing entry "${rawId}" in profile "${profile.id}".`);
      continue;
    }
    resolved.push({ id: info.id || id, ...info });
  }
  return resolved;
}

function entryArgs(server, root, options = {}) {
  if (options.installation?.mode.startsWith('docker')) {
    const installed = options.installation;
    const args = containerArgs(installed.imageId, `/opt/hela/${server.dir}/${server.entry}`, {
      profile: installed.profile, workspace: installed.workspace, data: path.join(installed.prefix, 'data', server.id) });
    if (process.platform === 'linux') args.splice(1, 0, '--user', `${process.getuid()}:${process.getgid()}`);
    const env = buildServerEnv(server, root, options);
    for (const key of Object.keys(env)) args.splice(1, 0, '--env', key);
    return args;
  }
  if (options.installation) return [path.join(options.installation.ecosystemRoot, 'scripts/launch.mjs'), server.id];
  if (!server.entry) return [];
  const dir = resolveServerDir(server, root);
  return [path.join(dir, server.entry)];
}

function launchCommand(server, options) { return options.installation?.mode.startsWith('docker') ? 'docker' : options.installation?.node || server.runtime || 'node'; }

function buildServerEnv(s, root, options = {}) {
  if (options.installation) {
    return Object.fromEntries([['OPENROUTER_API_KEY', options.openrouterKey], ['GITHUB_TOKEN', options.githubToken],
      ['GOOGLE_API_KEY', options.googleKey], ['GOOGLE_CSE_ID', options.googleCseId]].filter(([, value]) => value));
  }
  const env = {};
  const serverDir = resolveServerDir(s, root);
  for (const key of (s.env || [])) {
    if (key === 'MEMORY_FILE_PATH') {
      env[key] = path.join(serverDir, 'data/memory.json');
    } else if (key === 'CHAINING_TOOL_TIMEOUT_MS') {
      env[key] = '10000';
    } else if (key === 'CHAINING_LLM_ENABLED') {
      env[key] = options.openrouterKey ? 'true' : 'false';
    } else if (key === 'MITOSIS_AGENT_ENABLED') {
      const value = process.env.MITOSIS_AGENT_ENABLED?.toLowerCase();
      if (value === 'true' || value === 'false') env[key] = value;
    } else if (key === 'CHAINING_LLM_MODEL') {
      env[key] = 'openrouter/free';
    } else if (key === 'CHAINING_LLM_BASE_URL') {
      env[key] = 'https://openrouter.ai/api/v1';
    } else if (key === 'OPENROUTER_API_KEY') {
      if (options.openrouterKey) env[key] = options.openrouterKey;
    } else if (key === 'GITHUB_TOKEN') {
      if (options.githubToken) env[key] = options.githubToken;
    } else if (key === 'GOOGLE_API_KEY') {
      if (options.googleKey) env[key] = options.googleKey;
    } else if (key === 'GOOGLE_CSE_ID') {
      if (options.googleCseId) env[key] = options.googleCseId;
    } else if (key === 'WIKIPEDIA_CACHE_MAX') {
      env[key] = '100';
    } else if (key === 'WIKIPEDIA_CACHE_TTL') {
      env[key] = '300000';
    } else if (key === 'WIKIPEDIA_DEFAULT_LANGUAGE') {
      env[key] = 'en';
    } else if (key === 'HELA_PROFILE') {
      env[key] = options.profile && options.profile !== 'runtime' ? options.profile : 'minimal';
    } else if (key.startsWith('HELA_GENOME_OBSIDIAN_')) {
      // Optional Obsidian vault mirror; set manually by the user (see project-mcp README).
      // Skip auto-fill so generated configs don't contain placeholder secrets.
      continue;
    } else if (key === 'HELA_ECOSYSTEM_ROOT') {
      env[key] = root;
    } else if (key === 'HELA_HTTP_PORT') {
      // Optional HTTP health endpoint; disabled by default to avoid port conflicts.
      // Set manually (e.g. HELA_HTTP_PORT=8790) if desired.
      continue;
    } else if (/_AVAILABLE$|_ENABLED$/.test(key)) {
      env[key] = 'true';
    }
  }
  return env;
}

function renderOpencode(servers, root, options) {
  const mcp = {};
  for (const s of servers) {
    const name = s.id.replace('-mcp-server', '').replace('-mcp', '');
    const args = entryArgs(s, root, options);
    const entry = args.length > 0;
    const block = {
      type: 'local',
      enabled: !!entry,
      command: entry ? [launchCommand(s, options), ...args] : [],
    };
    const env = buildServerEnv(s, root, options);
    if (Object.keys(env).length) block.environment = env;
    mcp[name] = block;
  }
  return JSON.stringify({ mcp }, null, 2);
}

function renderKilo(servers, root, options) {
  const mcp = {};
  for (const s of servers) {
    const name = s.id.replace('-mcp-server', '').replace('-mcp', '');
    const args = entryArgs(s, root, options);
    const block = {
      type: 'local',
      enabled: true,
      command: args.length ? [launchCommand(s, options), ...args] : [],
    };
    const env = buildServerEnv(s, root, options);
    if (Object.keys(env).length) block.environment = env;
    mcp[name] = block;
  }
  return JSON.stringify({ mcp }, null, 2);
}

function renderNode(servers, root, keyName = 'mcpServers', options) {
  const serversObj = {};
  for (const s of servers) {
    const name = s.id.replace('-mcp-server', '').replace('-mcp', '');
    const env = buildServerEnv(s, root, options);
    serversObj[name] = {
      command: launchCommand(s, options),
      args: entryArgs(s, root, options),
      ...(Object.keys(env).length ? { env } : {}),
    };
  }
  return JSON.stringify({ [keyName]: serversObj }, null, 2);
}

function renderCodexToml(servers, root, options) {
  const sections = ['# Generated Codex / ChatGPT MCP Server Configuration'];
  for (const s of servers) {
    const name = s.id.replace('-mcp-server', '').replace('-mcp', '');
    const args = entryArgs(s, root, options);
    const argStr = args.map((a) => JSON.stringify(a)).join(', ');
    const sectionLines = [
      `[mcp_servers.${name}]`,
      `command = ${JSON.stringify(launchCommand(s, options))}`,
      `args = [${argStr}]`,
    ];
    const env = buildServerEnv(s, root, options);
    if (Object.keys(env).length > 0) {
      sectionLines.push(`[mcp_servers.${name}.env]`);
      for (const [k, v] of Object.entries(env)) {
        sectionLines.push(`${k} = ${JSON.stringify(v)}`);
      }
    }
    sections.push(sectionLines.join('\n'));
  }
  return sections.join('\n\n');
}

function renderDocker(servers, options) {
  const version = loadInventory(metadataRoot(options.root)).version;
  const image = options.installation?.imageId || options.image || `hela-ecosystem:${options.profile}-${version}`;
  return JSON.stringify(composeConfiguration(servers, image, options.profile, options.installation ?? options), null, 2);
}

function renderHttp(options) {
  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid MCP HTTP URL');
  if (options.backend === 'codex') return `[mcp_servers.hela-runtime]\nurl = ${JSON.stringify(url.href)}\n`;
  if (['opencode', 'kilo'].includes(options.backend)) return JSON.stringify({ mcp: { 'hela-runtime': { type: 'remote', url: url.href, enabled: true } } }, null, 2) + '\n';
  if (options.backend === 'cursor') return JSON.stringify({ mcpServers: { 'hela-runtime': { url: url.href } } }, null, 2) + '\n';
  throw new Error('Unverified HTTP client backend; configure its MCP URL manually');
}

function renderPrint(servers, root) {
  const lines = servers.map((s) => {
    const tag = s.needsGui ? ' [GUI]' : s.needsDevice ? ' [DEVICE]' : '';
    return `  - ${s.id}${tag}  ${s.runtime || 'node'} ${entryArgs(s, root).join(' ') || '(manual)'}`;
  });
  return ['Profile servers:', ...lines].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.profile) args.profile = process.env.HELA_PROFILE || 'minimal';
  if (!args.profile || !args.backend) {
    console.error('Usage: node scripts/generate-config.mjs <profileId> --backend <cursor|claude|gemini|antigravity|opencode|kilo|zed|codex|docker|print|skip> [--root <path>] [--out <file>]');
    process.exit(1);
  }

  if (!modes.includes(args.mode)) throw new Error('Unknown configuration mode');
  if (args.prefix) {
    args.installation = readInstallation(path.resolve(args.prefix));
    if (args.installation.profile !== args.profile || args.installation.mode !== args.mode) throw new Error('Installation/configuration selection mismatch');
    args.root = args.installation.ecosystemRoot;
    if (args.installation.transport === 'http') args.url ||= `http://127.0.0.1:${args.installation.port ?? 8080}/mcp`;
  } else if (args.mode !== 'individual' && args.backend !== 'docker') throw new Error('Install this mode first and provide --prefix');
  const profiles = readProfiles(args.root);
  const profile = profiles.find((p) => p.id === args.profile);
  if (!profile) {
    console.error(`Unknown profile "${args.profile}". Available: ${profiles.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }

  const { inventory, aliases } = readInventoryData(args.root);
  let servers = resolveServers(profile, inventory, aliases);
  if (args.runtime || ['runtime', 'nix', 'docker-runtime'].includes(args.mode)) {
    const rt = inventory['hela-runtime'];
    if (!rt) { console.error('hela-runtime not in inventory'); process.exit(1); }
    servers = [{ id: rt.id || 'hela-runtime', ...rt }];
    // pass the chosen profile through as HELA_PROFILE (not 'runtime')
    if (!args.profile || args.profile === 'runtime') args.profile = 'minimal';
  }
  const root = path.resolve(args.root);
  if (args.installation && servers.some(server => !args.installation.servers.some(installed => installed.id === server.id))) throw new Error('Selected server is not installed in this prefix');

  let out;
  if (args.url && args.backend !== 'docker') out = renderHttp(args);
  else switch (args.backend) {
    case 'cursor':
    case 'claude':
    case 'gemini':
    case 'antigravity':
      out = renderNode(servers, root, 'mcpServers', args) + '\n';
      break;
    case 'zed':
      out = renderNode(servers, root, 'context_servers', args) + '\n';
      break;
    case 'opencode':
      out = renderOpencode(servers, root, args) + '\n';
      break;
    case 'kilo':
      out = renderKilo(servers, root, args) + '\n';
      break;
    case 'codex':
      out = renderCodexToml(servers, root, args) + '\n';
      break;
    case 'docker':
      out = renderDocker(servers, args) + '\n';
      break;
    case 'print':
      out = renderPrint(servers, root) + '\n';
      break;
    case 'skip':
      out = 'Config generation skipped.\n';
      break;
    default:
      console.error(`Unknown backend "${args.backend}". Use cursor|claude|gemini|antigravity|opencode|kilo|zed|codex|docker|print|skip.`);
      process.exit(1);
  }

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), out, { mode: 0o600 });
    console.log(`Wrote ${path.resolve(args.out)}`);
  } else {
    process.stdout.write(out);
  }
}

main();
