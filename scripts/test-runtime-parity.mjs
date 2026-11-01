#!/usr/bin/env node
/**
 * HeLa Runtime parity + crash-recovery harness.
 *
 * Compares a set of safe tool calls executed against:
 *   (A) individual cells (direct MCP), and
 *   (B) the HeLa Runtime daemon (single endpoint).
 * Also verifies crash recovery: killing one cell keeps the rest alive.
 *
 * Usage:
 *   node scripts/test-runtime-parity.mjs [--runtime-only] [--crash-test]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MCP_ROOT = path.resolve(ROOT, '..');
const INV = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'inventory.json'), 'utf8'));

const args = process.argv.slice(2);
const runtimeOnly = args.includes('--runtime-only');
const crashTest = args.includes('--crash-test');

// Safe, read-only probe calls: tool name + args
const PROBES = [
  { tool: 'terminal_session_list', args: {} },
  { tool: 'get_session_context', args: { limit: 3 } },
  { tool: 'list_directory', args: { path: '.' } },
];

function startProc(cmd, argsArr, cwd, env = {}) {
  return spawn(cmd, argsArr, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } });
}

function makeClient(proc) {
  let buffer = '';
  const pending = new Map();
  let nextId = 1;
  proc.stdout.on('data', (c) => {
    buffer += c.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {}
    }
  });
  function request(method, params = {}, t = 15000) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, t);
      pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  async function init() {
    await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'parity', version: '1' } });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  }
  async function callTool(name, toolArgs) {
    const r = await request('tools/call', { name, arguments: toolArgs }, 30000);
    if (r.error) return { error: r.error };
    return r.result;
  }
  return { proc, request, init, callTool };
}

function cellEntry(id) {
  const s = INV.inventory[id];
  const dir = path.join(MCP_ROOT, s.dir.replace('-mcp', '')); // best-effort
  // resolve properly
  const candidates = [path.join(MCP_ROOT, s.dir), path.join(ROOT, '..', s.dir)];
  const realDir = candidates.find((c) => fs.existsSync(c)) || candidates[0];
  return { dir: realDir, entry: s.entry };
}

async function runParity() {
  console.log('=== Parity: individual vs runtime ===');
  // Start runtime
  const rtProc = startProc('node', [path.join(MCP_ROOT, 'hela-runtime', 'dist', 'index.js')], path.join(MCP_ROOT, 'hela-runtime'));
  const rt = makeClient(rtProc);
  await rt.init();
  // wait for boot
  await new Promise((r) => setTimeout(r, 18000));

  // Start individual cells for probes (lazy: only needed ones)
  const neededCells = new Set();
  // map tool -> cell
  const toolCell = {};
  for (const id of Object.keys(INV.inventory)) {
    if (INV.inventory[id].kind === 'runtime') continue;
    const s = INV.inventory[id];
    const candidates = [path.join(MCP_ROOT, s.dir), path.join(ROOT, '..', s.dir)];
    const realDir = candidates.find((c) => fs.existsSync(c));
    if (!realDir) continue;
    const proc = startProc('node', [path.join(realDir, s.entry)], realDir);
    const c = makeClient(proc);
    await c.init();
    await new Promise((r) => setTimeout(r, 2000));
    const lr = await c.request('tools/list', {});
    for (const t of lr.result?.tools || []) toolCell[t.name] = { client: c, proc, id };
  }

  let pass = 0, fail = 0;
  for (const probe of PROBES) {
    if (!toolCell[probe.tool]) { console.log(`SKIP ${probe.tool} (not found in any cell)`); continue; }
    const ind = await toolCell[probe.tool].client.callTool(probe.tool, probe.args);
    const run = await rt.callTool(probe.tool, probe.args);
    const indOk = !ind.error;
    const runOk = !run.error;
    const status = indOk === runOk ? 'OK' : 'DIFF';
    if (status === 'OK') pass++; else fail++;
    console.log(`${status.padEnd(4)} ${probe.tool} (individual=${indOk}, runtime=${runOk})`);
  }

  // cleanup
  for (const k of Object.keys(toolCell)) try { toolCell[k].proc.kill(); } catch {}
  rtProc.kill();
  console.log(`\nParity: ${pass} passed, ${fail} differed`);
  return fail === 0;
}

async function runCrashTest() {
  console.log('\n=== Crash recovery test ===');
  const rtProc = startProc('node', [path.join(MCP_ROOT, 'hela-runtime', 'dist', 'index.js')], path.join(MCP_ROOT, 'hela-runtime'));
  const rt = makeClient(rtProc);
  await rt.init();
  await new Promise((r) => setTimeout(r, 18000));

  // find a cell pid by checking /proc? Instead, kill via rtProc? We can't easily kill one child.
  // Instead, verify that calling a tool on a booted cell works, then kill runtime's child by name.
  // Use pgrep to find a cell process (e.g., terminal-mcp) and kill it.
  const { execSync } = await import('node:child_process');
  let killed = false;
  try {
    const pids = execSync('pgrep -f "terminal-mcp/build/index.js"', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    if (pids.length) { process.kill(parseInt(pids[0], 10), 'SIGKILL'); killed = true; console.log('Killed terminal-mcp pid', pids[0]); }
  } catch (e) { console.log('could not kill cell:', e.message); }

  await new Promise((r) => setTimeout(r, 3000));
  // other cells should still respond
  const r1 = await rt.callTool('list_directory', { path: '.' });
  console.log('list_directory after crash:', r1.error ? 'FAIL' : 'OK');

  // wait for restart
  await new Promise((r) => setTimeout(r, 6000));
  const r2 = await rt.callTool('terminal_session_list', {});
  console.log('terminal_session_list after restart:', r2.error ? 'FAIL (not restarted?)' : 'OK (restarted)');

  rtProc.kill();
  return !r1.error;
}

(async () => {
  let ok = true;
  if (!runtimeOnly) ok = (await runParity()) && ok;
  if (crashTest) ok = (await runCrashTest()) && ok;
  if (!runtimeOnly && !crashTest) {
    // default: run both
    ok = (await runParity()) && ok;
    ok = (await runCrashTest()) && ok;
  }
  console.log('\n=== RESULT ===', ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
})();
