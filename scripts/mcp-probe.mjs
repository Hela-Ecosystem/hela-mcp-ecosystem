import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export async function probeMcp(entry, { ecosystemRoot, profile = 'minimal', runtime = false, namespaced = false, featureFlags = {}, timeoutMs = 20000, calls = [], prepareWorkspace } = {}) {
  for (const [key, value] of Object.entries(featureFlags)) {
    if (!/^[A-Z][A-Z0-9_]*_ENABLED$/.test(key) || typeof value !== 'boolean') throw new Error('Invalid probe feature flag');
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-mcp-probe-'));
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace);
  prepareWorkspace?.(workspace);
  const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'SystemRoot', 'SYSTEMROOT']
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  Object.assign(env, {
    HOME: root, USERPROFILE: root, XDG_DATA_HOME: path.join(root, 'data'),
    XDG_CONFIG_HOME: path.join(root, 'config'), XDG_CACHE_HOME: path.join(root, 'cache'),
    NODE_ENV: 'test', GUARDIAN_PROJECT_ROOT: workspace, GUARDIAN_CENTRAL_DB: path.join(root, 'central.db'),
    MEMORY_FILE_PATH: path.join(root, 'memory.json'), CHAINING_LLM_ENABLED: 'false',
    MITOSIS_AGENT_ENABLED: 'false', AGENT_ESCALATION_ENABLED: 'false',
    AWESOME_COPILOT_ENABLED: 'true', RELIABILITY_MONITORING_ENABLED: 'false',
    HELA_PROFILE: profile, HELA_BROWSER_ALLOW_EVAL: 'false', HELA_ALLOWED_ROOTS: workspace,
    HELA_NAMESPACE_TOOLS: namespaced ? '1' : '0',
  });
  if (ecosystemRoot) env.HELA_ECOSYSTEM_ROOT = ecosystemRoot;
  for (const [key, value] of Object.entries(featureFlags)) env[key] = String(value);
  const started = performance.now();
  const child = spawn(process.execPath, [path.resolve(entry)], {
    cwd: workspace, env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pending = new Map();
  let nextId = 0;
  let buffer = '';
  let bootOutput = '';
  let failure;
  const booted = new Set();
  const rejectPending = error => {
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  child.on('error', error => rejectPending(new Error(`MCP spawn failed (${error.code || 'process error'})`)));
  child.on('exit', (code, signal) => rejectPending(new Error(`MCP exited before verification (${code ?? signal})`)));
  child.stdin.on('error', () => rejectPending(new Error('MCP input closed')));
  child.stderr.on('data', chunk => {
    bootOutput = (bootOutput + chunk.toString()).slice(-8192);
    for (const match of bootOutput.matchAll(/\[hela-runtime\] booted (hela-[a-z-]+)/g)) booted.add(match[1]);
  });
  child.stdout.on('data', chunk => {
    buffer += chunk.toString();
    if (buffer.length > 8 * 1024 * 1024) return rejectPending(new Error('MCP response exceeded limit'));
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(`MCP request failed (${message.error.code ?? 'unknown code'})`));
      else request.resolve(message.result);
    }
  });
  function request(method, params) {
    if (failure) return Promise.reject(failure);
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, {
        resolve: result => { clearTimeout(timer); resolve(result); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  function signalGroup(signal) {
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  try {
    const initialized = await request('initialize', {
      protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'hela-isolated-probe', version: '1.0.0' },
    });
    if (!initialized?.serverInfo?.version || !initialized.capabilities) throw new Error('Invalid MCP initialize response');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const result = await request('tools/list', {});
    if (!Array.isArray(result?.tools) || !result.tools.length) throw new Error('MCP tools/list returned no tools');
    const names = new Set();
    for (const tool of result.tools) {
      if (typeof tool.name !== 'string' || !tool.inputSchema || names.has(tool.name)) throw new Error('Invalid or duplicate MCP tool schema');
      names.add(tool.name);
    }
    const discoveryMs = performance.now() - started;
    const discoveryBootedCells = [...booted].sort();
    const responses = [];
    for (const call of calls) {
      if (!names.has(call.name)) throw new Error(`Verification tool unavailable: ${call.name}`);
      const args = typeof call.arguments === 'function' ? call.arguments(workspace) : call.arguments || {};
      const callStarted = performance.now();
      const response = await request('tools/call', { name: call.name, arguments: args });
      const durationMs = performance.now() - callStarted;
      if (response?.isError) throw new Error(`Verification tool failed: ${call.name}`);
      for (const block of response?.content || []) {
        if (block.type !== 'text') continue;
        let payload;
        try { payload = JSON.parse(block.text); } catch { continue; }
        if (payload?.success === false || payload?.error) throw new Error(`Verification tool failed: ${call.name}`);
      }
      responses.push({ name: call.name, result: JSON.parse(JSON.stringify(response).replaceAll(root, '<sandbox>')), durationMs });
    }
    return { serverInfo: initialized.serverInfo, tools: result.tools, calls: responses, discoveryMs, discoveryBootedCells, bootedCells: [...booted].sort(), isolated: true };
  } finally {
    rejectPending(new Error('MCP verification complete'));
    if (child.pid) {
      signalGroup('SIGTERM');
      if (child.exitCode === null && child.signalCode === null) {
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 3000);
          child.once('exit', () => { clearTimeout(timer); resolve(); });
        });
      }
      signalGroup('SIGKILL');
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
