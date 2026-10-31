#!/usr/bin/env node
/**
 * HeLa version-consistency verifier (Phase 7).
 * Compares, per server: package.json version, MCP initialize serverInfo.version,
 * inventory.json version, and latest-stable snapshot serverVersion.
 * Exits non-zero on any mismatch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INV = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/inventory.json'), 'utf8'));
const SNAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/snapshots/latest-stable.json'), 'utf8'));

function pkgVersion(dir) {
  for (const c of [path.join(dir, 'package.json'), path.join(dir, 'brain', 'package.json')]) {
    if (fs.existsSync(c)) { try { return JSON.parse(fs.readFileSync(c, 'utf8')).version; } catch {} }
  }
  return null;
}

function initVersion(entryPath, dirPath, timeout = 1500) {
  return new Promise((resolve) => {
    const proc = spawn('node', [entryPath], { cwd: dirPath, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    const msg = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'verify', version: '1.0.0' } } }) + '\n';
    proc.stdin.write(msg);
    setTimeout(() => {
      proc.kill();
      try {
        const line = out.split('\n').find((l) => l.trim().startsWith('{'));
        resolve(JSON.parse(line)?.result?.serverInfo?.version ?? null);
      } catch { resolve(null); }
    }, timeout);
  });
}

let failed = false;
console.log('server'.padEnd(18), 'pkg'.padEnd(10), 'init'.padEnd(10), 'inventory'.padEnd(10), 'snapshot'.padEnd(10), 'status');
for (const key of Object.keys(INV.inventory)) {
  const s = INV.inventory[key];
  const dir = path.join(ROOT, '..', s.dir); // sibling
  const realDir = fs.existsSync(dir) ? dir : path.join(ROOT, s.dir);
  const pv = pkgVersion(realDir);
  const iv = s.version ?? null;
  const sv = SNAP.servers?.[s.id]?.serverVersion ?? null;
  const bootTimeout = s.id === 'hela-runtime' ? 30000 : 1500;
  const initV = (fs.existsSync(path.join(realDir, s.entry)) ? await initVersion(path.join(realDir, s.entry), realDir, bootTimeout) : null);
  const all = [pv, initV, iv, sv].filter(Boolean);
  const ok = all.length > 0 && all.every((v) => v === pv) && (sv === null || sv === pv);
  if (!ok) failed = true;
  console.log(s.id.padEnd(18), String(pv).padEnd(10), String(initV).padEnd(10), String(iv).padEnd(10), String(sv).padEnd(10), ok ? 'OK' : 'MISMATCH');
}
process.exit(failed ? 1 : 0);
