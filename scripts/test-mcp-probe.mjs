import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { probeMcp } from './mcp-probe.mjs';

test('probes a real MCP handshake without inheriting production memory or credentials', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hela-probe-fixture-'));
  const fixture = join(root, 'server.mjs');
  const inherited = { ...process.env };
  process.env.HELA_GENOME_OBSIDIAN_VAULT = '/production-vault-must-not-be-used';
  process.env.HELA_GENOME_OBSIDIAN_SYNC_CMD = 'must-not-run';
  process.env.OPENROUTER_API_KEY = 'synthetic-sentinel';
  try {
    writeFileSync(fixture, `import readline from 'node:readline';
      readline.createInterface({input:process.stdin}).on('line',line=>{
        const m=JSON.parse(line);if(m.id===undefined)return;
        const result=m.method==='initialize'?{serverInfo:{name:'fixture',version:'1.0.0'},capabilities:{tools:{}}}:
          {tools:[{name:'fixture',inputSchema:{type:'object'},description:JSON.stringify({
            vault:!!process.env.HELA_GENOME_OBSIDIAN_VAULT,hook:!!process.env.HELA_GENOME_OBSIDIAN_SYNC_CMD,
            credential:!!process.env.OPENROUTER_API_KEY,testMode:process.env.NODE_ENV==='test',
            isolatedRoot:process.env.GUARDIAN_PROJECT_ROOT===process.cwd()})}]};
        console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result}));
      });`);
    const result = await probeMcp(fixture, { timeoutMs: 1000 });
    assert.equal(result.serverInfo.version, '1.0.0');
    assert.deepEqual(JSON.parse(result.tools[0].description), {
      vault: false, hook: false, credential: false, testMode: true, isolatedRoot: true,
    });
  } finally {
    process.env = inherited;
    rmSync(root, { recursive: true, force: true });
  }
});

test('silent and early-exiting processes cannot pass readiness checks', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hela-probe-fixture-'));
  try {
    const silent = join(root, 'silent.mjs');
    writeFileSync(silent, 'setInterval(()=>{},1000);');
    await assert.rejects(probeMcp(silent, { timeoutMs: 100 }), /timed out/);
    const exited = join(root, 'exited.mjs');
    writeFileSync(exited, 'process.exit(0);');
    await assert.rejects(probeMcp(exited, { timeoutMs: 1000 }), /exited before verification/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('MCP and payload-level tool failures cannot pass a read-only probe', async () => {
  const root = mkdtempSync(join(tmpdir(), 'hela-probe-fixture-'));
  try {
    for (const result of [{ isError: true, content: [] }, { content: [{ type: 'text', text: '{"success":false}' }] }]) {
      const fixture = join(root, 'failed-tool.mjs');
      writeFileSync(fixture, `import readline from 'node:readline';
        readline.createInterface({input:process.stdin}).on('line',line=>{
          const m=JSON.parse(line);if(m.id===undefined)return;
          const result=m.method==='initialize'?{serverInfo:{name:'fixture',version:'1.0.0'},capabilities:{tools:{}}}:
            m.method==='tools/list'?{tools:[{name:'failed',inputSchema:{type:'object'}}]}:${JSON.stringify(result)};
          console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result}));
        });`);
      await assert.rejects(probeMcp(fixture, { timeoutMs: 1000, calls: [{ name: 'failed' }] }), /Verification tool failed/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
