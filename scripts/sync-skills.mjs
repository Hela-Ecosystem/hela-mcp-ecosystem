#!/usr/bin/env node
/**
 * HeLa MCP Ecosystem — Agent Skill Sync
 *
 * Each MCP server may bundle agent skills (a directory with a SKILL.md plus
 * supporting references). Agent harnesses such as OpenCode discover those skills
 * from a shared directory, so installing/updating a server does not, by itself,
 * refresh them.
 *
 * This script mirrors the bundled skill catalog from the installed server
 * checkouts into the harness skills directory, using config/inventory.json as
 * the source of truth (`skills[]` on each server entry).
 *
 * Usage:
 *   node scripts/sync-skills.mjs [--all | --profile <id> | KEY...] [options]
 *
 * Options:
 *   --check            Report drift only; exit 1 when anything is out of sync
 *   --dry-run          Show the plan without writing or deleting anything
 *   --prune            Remove skill dirs that are not part of the manifest
 *   --target <dir>     Destination (default: $HELA_SKILLS_DIR or ~/.config/opencode/skills)
 *   --json             Machine-readable report
 *   -h, --help         Show this help
 *
 * Sync is a mirror: files missing or changed are copied, and files that no
 * longer exist in the source are removed so stale references cannot linger.
 * A skill whose source directory is missing or empty is skipped (never wiped).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(ROOT, 'config', 'inventory.json');
const PROFILES_PATH = path.join(ROOT, 'config', 'profiles.json');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function usage() {
  console.log(`Usage: sync-skills.mjs [--all | --profile <id> | KEY...] [options]

Mirror agent skills bundled with installed HeLa MCP servers into the harness
skills directory.

Options:
  --check            Report drift only; exit 1 when anything is out of sync
  --dry-run          Show the plan without writing or deleting anything
  --prune            Remove skill dirs that are not part of the manifest
  --target <dir>     Destination (default: $HELA_SKILLS_DIR or ~/.config/opencode/skills)
  --json             Machine-readable report
  -h, --help         Show this help`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function walk(dir, base = dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function snapshot(dir) {
  const files = new Map();
  for (const rel of walk(dir)) {
    const buf = fs.readFileSync(path.join(dir, rel));
    files.set(rel, { hash: sha256(buf), size: buf.length });
  }
  return files;
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Resolve a server checkout dir using the same fallbacks as scripts/lib.sh. */
function resolveServerDir(key, server) {
  const rel = server.dir || key;
  const short = rel.replace(/-mcp-server$/, '').replace(/-mcp$/, '');
  const candidates = [
    path.join(ROOT, rel),
    path.resolve(ROOT, '..', rel),
    short && short !== rel ? path.join(ROOT, short) : null,
    short && short !== rel ? path.resolve(ROOT, '..', short) : null,
    path.join(ROOT, key),
    path.resolve(ROOT, '..', key),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (isDir(candidate)) return candidate;
  }
  return path.join(ROOT, rel);
}

/** Read just the `name:` field of a SKILL.md frontmatter (CRLF tolerant). */
function declaredName(skillDir) {
  try {
    const text = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8').replace(/\r\n?/g, '\n');
    const block = text.match(/^---\n([\s\S]*?)\n---/);
    if (!block) return null;
    const name = block[1].match(/^name:\s*"?(.*?)"?\s*$/m);
    return name ? name[1].trim() : null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const opts = {
    check: false,
    dryRun: false,
    prune: false,
    json: false,
    target: process.env.HELA_SKILLS_DIR || path.join(os.homedir(), '.config', 'opencode', 'skills'),
    scope: { type: 'all', keys: [] },
  };
  const keys = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--check') opts.check = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--prune') opts.prune = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--target') opts.target = argv[++i];
    else if (arg === '--all') opts.scope = { type: 'all', keys: [] };
    else if (arg === '--profile') opts.scope = { type: 'profile', id: argv[++i] };
    else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      usage();
      process.exit(2);
    } else keys.push(arg);
  }
  if (keys.length > 0) opts.scope = { type: 'keys', keys };
  opts.target = path.resolve(opts.target);
  return opts;
}

function selectServers(inventory, opts) {
  const { inventory: servers, aliases = {} } = inventory;
  const allKeys = Object.keys(servers);
  if (opts.scope.type === 'keys') {
    return opts.scope.keys.map((k) => aliases[k] || k);
  }
  if (opts.scope.type === 'profile') {
    const profiles = readJson(PROFILES_PATH).profiles;
    const profile = profiles.find((p) => p.id === opts.scope.id);
    if (!profile) {
      console.error(`${C.red}Unknown profile: ${opts.scope.id}${C.reset}`);
      process.exit(2);
    }
    return profile.servers.map((k) => aliases[k] || k);
  }
  return allKeys;
}

function buildManifest(inventory, serverKeys) {
  const manifest = [];
  const problems = [];
  for (const key of serverKeys) {
    const server = inventory.inventory[key];
    if (!server) {
      problems.push(`Unknown server key: ${key}`);
      continue;
    }
    const serverDir = resolveServerDir(key, server);
    for (const skill of server.skills || []) {
      const source = path.join(serverDir, skill.path);
      manifest.push({
        key,
        alias: server.alias || key,
        name: skill.name || path.basename(skill.path),
        source,
      });
    }
  }
  return { manifest, problems };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inventory = readJson(INVENTORY_PATH);
  const serverKeys = selectServers(inventory, opts);
  const { manifest, problems } = buildManifest(inventory, serverKeys);

  const report = {
    target: opts.target,
    mode: opts.check ? 'check' : opts.dryRun ? 'dry-run' : 'sync',
    skills: [],
    filesCopied: 0,
    filesDeleted: 0,
    pruned: [],
    duplicates: [],
    warnings: [...problems],
  };

  if (!opts.json) {
    console.log(`\n${C.bold}${C.cyan}=== HeLa Skill Sync ===${C.reset}`);
    console.log(`${C.dim}source:${C.reset} config/inventory.json  ${C.dim}target:${C.reset} ${opts.target}`);
    console.log(`${C.dim}mode:${C.reset} ${report.mode}\n`);
    console.log(`${'Skill'.padEnd(20)} ${'Server'.padEnd(16)} ${'Files'.padEnd(7)} Result`);
    console.log('-'.repeat(72));
  }

  let drifted = 0;

  for (const entry of manifest) {
    const sourceFiles = snapshot(entry.source);
    const destDir = path.join(opts.target, entry.name);
    const destFiles = snapshot(destDir);
    const result = {
      name: entry.name,
      server: entry.key,
      source: entry.source,
      files: sourceFiles.size,
      added: 0,
      changed: 0,
      removed: 0,
      state: 'ok',
    };

    if (sourceFiles.size === 0) {
      report.warnings.push(`${entry.name}: source missing or empty (${entry.source}) — skipped`);
      result.state = 'skipped';
      report.skills.push(result);
      if (!opts.json) {
        console.log(`${entry.name.padEnd(20)} ${entry.key.padEnd(16)} ${String(0).padEnd(7)} ${C.yellow}SKIP${C.reset} source missing/empty`);
      }
      continue;
    }

    const toCopy = [];
    for (const [rel, meta] of sourceFiles) {
      const existing = destFiles.get(rel);
      if (!existing) {
        result.added += 1;
        toCopy.push(rel);
      } else if (existing.hash !== meta.hash) {
        result.changed += 1;
        toCopy.push(rel);
      }
    }
    const toDelete = [...destFiles.keys()].filter((rel) => !sourceFiles.has(rel));
    result.removed = toDelete.length;
    const delta = result.added + result.changed + result.removed;

    if (delta > 0) drifted += 1;

    if (opts.check) {
      result.state = delta === 0 ? 'ok' : 'drift';
      if (!opts.json) {
        const tag = delta === 0 ? `${C.green}IN SYNC${C.reset}` : `${C.yellow}DRIFT${C.reset}`;
        const detail = delta === 0 ? '' : ` +${result.added} ~${result.changed} -${result.removed}`;
        console.log(`${entry.name.padEnd(20)} ${entry.key.padEnd(16)} ${String(sourceFiles.size).padEnd(7)} ${tag}${detail}`);
      }
      report.skills.push(result);
      continue;
    }

    if (!opts.dryRun) {
      for (const rel of toCopy) {
        const destAbs = path.join(destDir, rel);
        fs.mkdirSync(path.dirname(destAbs), { recursive: true });
        fs.copyFileSync(path.join(entry.source, rel), destAbs);
        report.filesCopied += 1;
      }
      for (const rel of toDelete) {
        fs.rmSync(path.join(destDir, rel), { force: true });
        report.filesDeleted += 1;
      }
      for (const rel of toDelete) {
        const parent = path.dirname(path.join(destDir, rel));
        while (parent.startsWith(destDir) && parent !== destDir) {
          try {
            if (fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
            else break;
          } catch {
            break;
          }
          const up = path.dirname(parent);
          if (up === parent) break;
        }
      }
    } else {
      report.filesCopied += toCopy.length;
      report.filesDeleted += toDelete.length;
    }

    result.state = delta === 0 ? 'ok' : opts.dryRun ? 'would-sync' : 'synced';
    report.skills.push(result);
    if (!opts.json) {
      const tag = delta === 0 ? `${C.green}IN SYNC${C.reset}` : opts.dryRun ? `${C.yellow}WOULD SYNC${C.reset}` : `${C.green}SYNCED${C.reset}`;
      const detail = delta === 0 ? '' : ` +${result.added} ~${result.changed} -${result.removed}`;
      console.log(`${entry.name.padEnd(20)} ${entry.key.padEnd(16)} ${String(sourceFiles.size).padEnd(7)} ${tag}${detail}`);
    }
  }

  // Detect duplicate skill names already sitting in the target (e.g. leftover *-old copies).
  // Optional prune of skill dirs that the manifest does not manage runs first so the
  // duplicate report reflects only the copies that survived.
  let installed = isDir(opts.target)
    ? fs.readdirSync(opts.target, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];

  if (opts.prune) {
    const managed = new Set(manifest.map((m) => m.name));
    for (const dirName of installed) {
      if (managed.has(dirName)) continue;
      if (!fs.existsSync(path.join(opts.target, dirName, 'SKILL.md'))) continue;
      report.pruned.push(dirName);
      if (!opts.dryRun) fs.rmSync(path.join(opts.target, dirName), { recursive: true, force: true });
    }
    installed = installed.filter((dirName) => !report.pruned.includes(dirName));
  }

  const byName = new Map();
  for (const dirName of installed) {
    const name = declaredName(path.join(opts.target, dirName));
    if (!name) continue;
    byName.set(name, [...(byName.get(name) || []), dirName]);
  }
  for (const [name, dirs] of byName) {
    if (dirs.length > 1) {
      report.duplicates.push({ name, dirs });
      report.warnings.push(`duplicate skill "${name}" in ${dirs.join(', ')} — run with --prune to remove unmanaged copies`);
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('-'.repeat(72));
    for (const warning of report.warnings) console.log(`${C.yellow}!${C.reset} ${warning}`);
    if (report.pruned.length > 0) {
      console.log(`${C.green}pruned:${C.reset} ${report.pruned.join(', ')}${opts.dryRun ? ' (dry-run)' : ''}`);
    }
    if (opts.check) {
      const clean = drifted === 0 && report.duplicates.length === 0;
      console.log(
        clean
          ? `${C.green}${C.bold}All ${manifest.length} skill(s) in sync.${C.reset}\n`
          : `${C.yellow}${C.bold}${drifted} of ${manifest.length} skill(s) out of sync${report.duplicates.length > 0 ? `, ${report.duplicates.length} shadowing duplicate(s)` : ''}. Run: npm run skills:sync${C.reset}\n`
      );
    } else {
      console.log(
        `${C.green}${C.bold}Done:${C.reset} ${manifest.length} skill(s), ${report.filesCopied} file(s) copied, ${report.filesDeleted} file(s) removed${opts.dryRun ? ' (dry-run)' : ''}.\n`
      );
    }
  }

  const failed =
    report.warnings.some((w) => w.startsWith('Unknown')) ||
    (opts.check && (drifted > 0 || report.duplicates.length > 0));
  process.exit(failed ? 1 : 0);
}

main();

