#!/usr/bin/env node
/**
 * Verify an authenticated ACP session without the GUI.
 *
 * Zed talks to Codex through a codex-acp adapter over newline-delimited
 * JSON-RPC. Handshakes were verified before, but the authenticated session
 * (initialize -> session/new -> session/prompt) was only ever checked by hand
 * inside Zed, so the gate stayed open.
 *
 * This drives the same adapter Zed does, using the credentials already on the
 * machine (codex login), and reports a pass only when the agent returns a text
 * reply for a real prompt. Nothing is written to disk and no credentials are
 * read or copied by this script.
 *
 * Usage:
 *   node scripts/verify-acp.mjs [--json] [--prompt "Reply with OK"] [--timeout-ms 180000]
 *
 * Environment:
 *   HELA_ACP_AGENT_BINARY  adapter path (default: newest Zed registry codex-acp)
 *   HELA_ACP_CWD           working directory for the session (default: repo root)
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = { json: false, prompt: 'Reply with the single word OK and nothing else.', timeoutMs: 180000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--prompt') options.prompt = argv[++i];
    else if (arg === '--timeout-ms') options.timeoutMs = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) throw new Error('--timeout-ms must be >= 1000');
  return options;
}

/** Adapter path from a custom `agent_servers.codex-acp` entry, when one is configured. */
function adapterFromZedSettings() {
  const file = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'zed/settings.json');
  if (!fs.existsSync(file)) return null;
  try {
    const entry = JSON.parse(fs.readFileSync(file, 'utf8'))?.agent_servers?.['codex-acp'];
    if (entry?.type === 'custom' && typeof entry.command === 'string' && fs.existsSync(entry.command)) return entry.command;
  } catch {}
  return null;
}

/** Adapter path: env override, then a custom Zed entry, then the newest registry build. */
function discoverAdapter() {
  if (process.env.HELA_ACP_AGENT_BINARY) return process.env.HELA_ACP_AGENT_BINARY;
  const custom = adapterFromZedSettings();
  if (custom) return custom;
  const registry = path.join(os.homedir(), '.local/share/zed/external_agents/registry/codex-acp');
  if (!fs.existsSync(registry)) throw new Error('codex-acp not found in the Zed registry; set HELA_ACP_AGENT_BINARY');
  const candidates = fs.readdirSync(registry)
    .map((name) => path.join(registry, name, 'codex-acp'))
    .filter((file) => fs.existsSync(file))
    .map((file) => ({ file, mtime: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!candidates.length) throw new Error('codex-acp binary missing under the Zed registry');
  return candidates[0].file;
}

function run(options) {
  const binary = discoverAdapter();
  const cwd = process.env.HELA_ACP_CWD || root;
  const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'], cwd, env: process.env });
  const summary = { adapter: binary, cwd, protocolVersion: null, agent: null, authMethods: [], sessionId: null, stopReason: null, text: '', events: 0, methods: [] };
  let buffer = '';
  let nextId = 1;
  const pending = new Map();
  let stderr = '';
  let settled = false;

  const send = (method, params) => {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
  };

  const finish = (error, code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    try { child.kill('SIGTERM'); } catch {}
    if (error) summary.error = error;
    if (stderr.trim()) summary.stderr = stderr.trim().split('\n').slice(-6);
    if (options.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(`ACP session: ${error ? 'FAIL' : 'PASS'}`);
      console.log(`  adapter:  ${summary.adapter}`);
      console.log(`  agent:    ${summary.agent ?? 'unknown'} (protocol ${summary.protocolVersion})`);
      console.log(`  session:  ${summary.sessionId ?? 'none'}`);
      console.log(`  stop:     ${summary.stopReason ?? 'none'}, ${summary.events} update(s)`);
      if (summary.text) console.log(`  reply:    ${JSON.stringify(summary.text.slice(0, 120))}`);
      if (stderr.trim()) console.log(`  stderr:   ${stderr.trim().split('\n').slice(-2).join(' | ')}`);
      if (error) console.log(`  error:    ${error}`);
    }
    process.exitCode = error ? 1 : 0;
  };

  const timer = setTimeout(() => finish(`timed out after ${options.timeoutMs}ms`), options.timeoutMs);

  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (error) => finish(`failed to spawn adapter: ${error.message}`));
  child.on('exit', (code) => { if (!settled) finish(`adapter exited early with code ${code}`); });

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }

      if (message.method) summary.methods.push(message.method);
      if (message.method && message.id !== undefined && !message.result && !message.error) {
        // Client-side request from the agent: answer only what we can safely answer.
        const reply = message.method.startsWith('session/request_permission')
          ? { outcome: { outcome: 'selected', optionId: 'approved-for-session' } }
          : null;
        child.stdin.write(JSON.stringify(reply === null
          ? { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `unsupported client method ${message.method}` } }
          : { jsonrpc: '2.0', id: message.id, result: reply }) + '\n');
        continue;
      }
      if (message.method === 'session/update') {
        summary.events++;
        const update = message.params?.update ?? {};
        const text = update.content?.text ?? update.text ?? update.delta ?? '';
        if (typeof text === 'string' && text) summary.text += text;
        continue;
      }
      if (message.id !== undefined && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message ?? JSON.stringify(message.error)}`));
        else waiter.resolve(message.result ?? {});
      }
    }
  });

  (async () => {
    const init = await send('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
    summary.protocolVersion = init.protocolVersion ?? null;
    summary.agent = init.agentInfo ? `${init.agentInfo.name} ${init.agentInfo.version}` : null;
    summary.authMethods = (init.authMethods ?? []).map((method) => method.id);

    const session = await send('session/new', { cwd, mcpServers: [] });
    summary.sessionId = session.sessionId ?? null;
    if (!summary.sessionId) throw new Error('session/new returned no sessionId');

    const prompt = await send('session/prompt', {
      sessionId: summary.sessionId,
      prompt: [{ type: 'text', text: options.prompt }],
    });
    summary.stopReason = prompt.stopReason ?? null;
    const replied = summary.text.trim().length > 0;
    finish(replied && summary.stopReason === 'end_turn' ? null : `no text reply (stopReason ${summary.stopReason ?? 'none'})`);
  })().catch((error) => finish(error.message));
}

try {
  run(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(`[verify-acp] ${error.message}`);
  process.exitCode = 1;
}
