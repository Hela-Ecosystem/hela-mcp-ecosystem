#!/usr/bin/env node
/**
 * HeLa MCP Ecosystem — Diagnostic Health Checker (doctor)
 *
 * Inspects:
 *  1. Host environment (Node.js >=20.18.1, Git, SQLite3, OS, Arch)
 *  2. Selected profile / all 10 HeLa MCP servers
 *  3. Git revisions vs. pinned snapshot commits
 *  4. Build artifacts & executable entrypoints
 *  5. Isolated MCP initialize/discovery and optional cold runtime catalog parity
 *  6. External runtimes (Playwright/Chromium, ADB/Android, Blender CLI, PTY)
 *  7. API keys & graceful offline fallback modes
 *
 * Usage:
 *   node scripts/doctor.mjs [--profile <id>] [--runtime] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { probeMcp } from './mcp-probe.mjs';
import { loadInventory, resolveServerDir, selectProfile } from './inventory.mjs';
import { parseOptions, readInstallation } from './installation.mjs';
import { checkInstallation } from './doctor-installation.mjs';
import { probeHttpEndpoint } from './http-probe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ECOSYSTEM_ROOT = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
};

function logHeader(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function checkServerProcess(entryPath, dirPath, profile) {
  if (!fs.existsSync(entryPath)) {
    return { ok: false, reason: 'Entrypoint file missing' };
  }
  try {
    const runtime = path.basename(dirPath) === 'hela-runtime';
    const result = await probeMcp(entryPath, { ecosystemRoot: ECOSYSTEM_ROOT, runtime, profile });
    return { ok: true, note: 'Isolated MCP initialize and tools/list passed', version: result.serverInfo.version,
      tools: result.tools.length, toolNames: result.tools.map(tool => tool.name), bootedCells: result.discoveryBootedCells, discoveryMs: result.discoveryMs };
  } catch (error) { return { ok: false, reason: error.message }; }
}

function getGitCommit(dir) {
  let cur = dir;
  for (let i = 0; i < 3; i++) {
    if (fs.existsSync(path.join(cur, '.git'))) {
      try {
        return execSync('git rev-parse HEAD', { cwd: cur, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      } catch {
        return null;
      }
    }
    cur = path.dirname(cur);
  }
  return null;
}

async function runDoctor(options = {}) {
  const parsed = parseOptions(process.argv.slice(2), ECOSYSTEM_ROOT);
  if (parsed.help) {
    console.log('Usage: ./setup.sh doctor [--prefix PATH] [--mode individual|runtime|docker|docker-runtime|nix] [--profile ID] [--runtime] [--json], or --url URL');
    return;
  }
  if (parsed.url) {
    const result = await probeHttpEndpoint(parsed.url);
    const expected = loadInventory(ECOSYSTEM_ROOT).inventory['hela-runtime'].version;
    const report = { status: result.serverInfo.version === expected ? 'READY' : 'DEGRADED', transport: 'http', version: result.serverInfo.version,
      expectedVersion: expected, tools: result.tools.length, scope: result.scope };
    console.log(parsed.json ? JSON.stringify(report, null, 2) : `HTTP MCP: ${report.status}, version ${report.version}, ${report.tools} tools. ${report.scope}`);
    process.exitCode = report.status === 'READY' ? 0 : 1;
    return;
  }
  if (fs.existsSync(path.join(parsed.prefix, '.hela-install.json')) || process.argv.includes('--prefix')) {
    const manifest = readInstallation(parsed.prefix);
    if (process.argv.includes('--profile') && parsed.profile !== manifest.profile) throw new Error('Doctor profile does not match installation');
    if ((process.argv.includes('--mode') || process.argv.includes('--runtime')) && parsed.mode !== manifest.mode) throw new Error('Doctor mode does not match installation');
    const report = await checkInstallation(parsed.prefix);
    if (parsed.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`HeLa ${report.mode}/${report.profile}: ${report.status}`);
      for (const server of report.servers) console.log(`${server.id}: ${server.status}${server.error ? ` (${server.error})` : ` — ${server.tools} tools`}`);
      if (report.error) console.log(report.error);
      if (report.integrations) console.log(report.integrations);
    }
    process.exitCode = report.status === 'READY' ? 0 : 1;
    return;
  }
  if (parsed.mode.startsWith('docker') || parsed.mode === 'nix') throw new Error('No managed installation found; specify --prefix or install this mode first');
  const isJson = options.json || process.argv.includes('--json');
  let targetProfileId = options.profile || process.env.HELA_PROFILE || 'minimal';
  const pIndex = process.argv.indexOf('--profile');
  if (pIndex !== -1) {
    targetProfileId = process.argv[pIndex + 1];
    if (!targetProfileId || targetProfileId.startsWith('--')) throw new Error('Missing doctor profile');
  }

  const inventoryData = loadInventory(ECOSYSTEM_ROOT);
  const selectedProfile = selectProfile(inventoryData, targetProfileId);
  const snapshot = readJson(path.join(ECOSYSTEM_ROOT, 'config/snapshots/latest-stable.json'));
  const inventory = inventoryData.inventory;
  const aliases = inventoryData.aliases || {};

  const report = {
    timestamp: new Date().toISOString(),
    system: {},
    dependencies: {},
    servers: [],
    status: 'READY',
    profile: selectedProfile.id,
  };

  // 1. Host System Inspection
  const nodeVer = process.version;
  const nodeMajor = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
  const [, nodeMinor, nodePatch] = nodeVer.replace('v', '').split('.').map(Number);
  const osType = `${os.type()} ${os.release()} (${os.arch()})`;

  let gitVer = null;
  try { gitVer = execSync('git --version', { encoding: 'utf8' }).trim(); } catch {}

  let sqliteVer = null;
  try { sqliteVer = execSync('sqlite3 --version', { encoding: 'utf8' }).split(' ')[0]; } catch {}

  report.system = {
    os: osType,
    node: { version: nodeVer, valid: nodeMajor > 20 || (nodeMajor === 20 && (nodeMinor > 18 || (nodeMinor === 18 && nodePatch >= 1))) },
    git: { version: gitVer, valid: !!gitVer },
    sqlite3: { version: sqliteVer, valid: !!sqliteVer },
  };

  // 2. External Runtimes
  let playwrightReady = false;
  try {
    if (!selectedProfile.servers.includes('hela-cytosol')) throw new Error('Not selected');
    const pwCheck = spawnSync(process.execPath, ['-e', 'require("playwright")'], { cwd: resolveServerDir(inventory['hela-cytosol'], ECOSYSTEM_ROOT), stdio: 'ignore' });
    playwrightReady = pwCheck.status === 0;
  } catch {}

  let adbReady = false;
  let adbDevices = [];
  try {
    if (!selectedProfile.servers.includes('hela-receptor')) throw new Error('Not selected');
    const adbOut = execSync('adb devices', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    adbReady = true;
    adbDevices = adbOut.split('\n').filter((l) => l.includes('\tdevice')).map((l) => l.split('\t')[0]);
  } catch {}

  let blenderReady = false;
  let blenderVer = null;
  try {
    if (!selectedProfile.servers.includes('hela-plastid')) throw new Error('Not selected');
    blenderVer = execSync('blender --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).split('\n')[0];
    blenderReady = !!blenderVer;
  } catch {}

  report.dependencies = {
    playwright: { ready: playwrightReady, note: playwrightReady ? 'Playwright installed' : 'Optional (needed for HeLa Cytosol)' },
    adb: { ready: adbReady, devices: adbDevices, note: adbReady ? `${adbDevices.length} device(s) connected` : 'Optional (needed for HeLa Receptor)' },
    blender: { ready: blenderReady, version: blenderVer, note: blenderReady ? blenderVer : 'Optional (needed for HeLa Plastid)' },
    pty: { ready: process.platform !== 'win32', note: process.platform !== 'win32' ? 'POSIX PTY supported' : 'Windows ConPTY' },
  };

  // 3. Secrets / API Keys (Safe Checks)
  report.secrets = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'Configured (value hidden)' : 'Not set',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ? 'Configured (value hidden)' : 'Not set',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? 'Configured (value hidden)' : 'Not set',
    GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID ? 'Configured' : 'Not set',
  };

  // 4. Server Selection
  const targetServerKeys = [...selectedProfile.servers];
  if (process.argv.includes('--runtime')) targetServerKeys.push('hela-runtime');

  // 5. Audit Servers
  let allHealthy = report.system.node.valid && report.system.git.valid;
  for (const key of targetServerKeys) {
    const s = inventory[key] || inventory[aliases[key]];
    if (!s) continue;

    const dirPath = resolveServerDir(s, ECOSYSTEM_ROOT);
    const exists = fs.existsSync(dirPath);
    const entryFile = s.entry ? path.join(dirPath, s.entry) : null;
    const entryExists = entryFile ? fs.existsSync(entryFile) : false;
    const currentCommit = exists ? getGitCommit(dirPath) : null;
    const snapshotCommit = snapshot.servers?.[s.id]?.commit;
    const isPinnedCommit = s.revision && currentCommit ? currentCommit === s.revision && currentCommit === snapshotCommit : false;

    let smokeStatus = { ok: false, reason: 'Not checked' };
    if (exists && entryExists) {
      smokeStatus = await checkServerProcess(entryFile, dirPath, selectedProfile.id);
    }

    // Version check (Phase 7): package.json vs inventory serverVersion
    let pkgVersion = null;
    if (exists) {
      const pkgCandidates = [path.join(dirPath, 'package.json'), path.join(dirPath, 'brain', 'package.json')];
      for (const pc of pkgCandidates) {
        if (fs.existsSync(pc)) { try { pkgVersion = readJson(pc).version; } catch {} break; }
      }
    }
    const expectedVersion = s.version || '3.0.0';
    const versionMatch = pkgVersion !== null && pkgVersion === expectedVersion && smokeStatus.version === pkgVersion
      && snapshot.servers?.[s.id]?.serverVersion === pkgVersion;
    if (!versionMatch && s.scope === 'core') allHealthy = false;

    const serverHealthy = exists && (s.entry ? entryExists : true) && smokeStatus.ok && versionMatch && isPinnedCommit;
    if (!serverHealthy && (targetProfileId || s.scope === 'core' || s.kind === 'runtime')) {
      allHealthy = false;
    }

    report.servers.push({
      id: s.id,
      alias: s.alias || s.name,
      source: s.source,
      scope: s.scope,
      role: s.role,
      dir: dirPath,
      exists,
      entryFile,
      entryExists,
      currentCommit: currentCommit ? currentCommit.slice(0, 7) : 'missing',
      pinnedCommit: s.revision ? s.revision.slice(0, 7) : 'none',
      commitMatch: isPinnedCommit,
      smoke: smokeStatus,
      version: pkgVersion,
      expectedVersion,
      versionMatch,
      snapshotCommit: snapshotCommit?.slice(0, 7) ?? 'missing',
      status: serverHealthy ? 'READY' : exists && entryExists ? 'WARNING' : 'ERROR',
    });
  }

  const runtimeReport = report.servers.find(server => server.id === 'hela-runtime');
  if (runtimeReport?.smoke.ok) {
    const expected = new Set(report.servers.filter(server => server.id !== 'hela-runtime').flatMap(server => server.smoke.toolNames ?? []));
    expected.add('hela.pipe');
    const actual = new Set(runtimeReport.smoke.toolNames);
    const catalogMatch = actual.size === expected.size && [...expected].every(name => actual.has(name));
    runtimeReport.catalogMatch = catalogMatch;
    runtimeReport.onDemand = runtimeReport.smoke.bootedCells.length === 0;
    if (!catalogMatch || !runtimeReport.onDemand) { allHealthy = false; runtimeReport.status = 'WARNING'; }
  }

  report.status = allHealthy ? 'READY' : 'DEGRADED';

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(allHealthy ? 0 : 1);
  }

  // Visual Console Output
  logHeader('HeLa MCP Ecosystem — System Diagnostic Report');
  console.log(`Node.js:     ${report.system.node.valid ? colors.green + '✓ ' : colors.red + '✗ '}${nodeVer}${colors.reset}`);
  console.log(`Git:         ${report.system.git.valid ? colors.green + '✓ ' : colors.red + '✗ '}${gitVer || 'Not found'}${colors.reset}`);
  console.log(`SQLite3:     ${report.system.sqlite3.valid ? colors.green + '✓ ' : colors.yellow + '○ '}${sqliteVer || 'Not found in PATH (Node bindings will be used)'}${colors.reset}`);
  console.log(`Host OS:     ${osType}`);

  logHeader('External Runtime & Hardware Drivers');
  console.log(`Playwright:  ${playwrightReady ? colors.green + '✓ Ready' : colors.yellow + '○ Optional (npm i playwright for HeLa Cytosol)'}${colors.reset}`);
  console.log(`ADB Bridge:  ${adbReady ? colors.green + '✓ Ready (' + adbDevices.length + ' devices)' : colors.yellow + '○ Optional (adb not found; needed for HeLa Receptor)'}${colors.reset}`);
  console.log(`Blender CLI: ${blenderReady ? colors.green + '✓ Ready (' + blenderVer + ')' : colors.yellow + '○ Optional (blender not found; needed for HeLa Plastid)'}${colors.reset}`);
  console.log(`PTY Support: ${report.dependencies.pty.ready ? colors.green + '✓ Ready' : colors.yellow + '○ Emulated'}${colors.reset}`);

  logHeader('Optional API Keys & Graceful Fallbacks');
  for (const [k, v] of Object.entries(report.secrets)) {
    const isSet = !v.startsWith('Not set');
    console.log(`${k.padEnd(20)}: ${isSet ? colors.green + '✓ ' : colors.cyan + '○ '}${v}${colors.reset}`);
  }

  logHeader(`Component Health (${targetProfileId ? 'Profile: ' + targetProfileId : 'All 10 Servers'})`);
  console.log(`${'Component'.padEnd(18)} ${'Scope'.padEnd(8)} ${'Revision'.padEnd(10)} ${'Entrypoint'.padEnd(12)} ${'Diagnostics'}`);
  console.log('-'.repeat(78));

  for (const s of report.servers) {
    const statusColor = s.status === 'READY' ? colors.green : s.status === 'WARNING' ? colors.yellow : colors.red;
    const revTag = s.commitMatch ? s.currentCommit : `${s.currentCommit}*`;
    const entryTag = s.entryExists ? 'present' : 'missing';
    const diagNote = s.smoke.ok ? 'Stdio JSON-RPC OK' : s.smoke.reason;
    const verTag = s.versionMatch ? `${s.version}` : `${s.version || '?'}!=${s.expectedVersion}`;
    const verColor = s.versionMatch ? colors.green : colors.red;
    console.log(
      `${s.alias.padEnd(18)} ${s.scope.padEnd(8)} ${revTag.padEnd(10)} ${verColor}${verTag.padEnd(8)}${colors.reset} ${entryTag.padEnd(12)} ${statusColor}[${s.status}] ${diagNote}${colors.reset}`
    );
  }

  console.log('\n' + '='.repeat(78));
  if (allHealthy) {
    console.log(`${colors.green}${colors.bold}SUCCESS: Selected MCP components verified; optional hardware/provider integrations are separate.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}ATTENTION: Some core servers or dependencies require attention. Review table above.${colors.reset}\n`);
    process.exit(1);
  }
}

  runDoctor().catch(error => {
    if (process.argv.includes('--json')) console.log(JSON.stringify({ status: 'DEGRADED', error: error.message, servers: [] }));
    else console.error(error.message);
    process.exitCode = 1;
  });
