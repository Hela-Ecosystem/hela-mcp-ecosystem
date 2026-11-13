import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test, after } from 'node:test';
import { parseOptions, installationPlan, readInstallation, modes, run, profileCapabilities } from './installation.mjs';
import { checkInstallation, checkContainerInstallation } from './doctor-installation.mjs';
import { probeMcp } from './mcp-probe.mjs';
import { downloadVerified } from './provision-needle.mjs';
import { createHash } from 'node:crypto';
import { probeHttpEndpoint } from './http-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-install-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const metadata = path.join(scratch, 'metadata');
fs.mkdirSync(path.join(metadata, 'config/snapshots'), { recursive: true });
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config/inventory.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(root, 'config/profiles.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'config/snapshots/latest-stable.json'), 'utf8'));

const serverCode = `import fs from 'node:fs';import readline from 'node:readline';import http from 'node:http';
const id=process.argv[1].split('/').find(p=>p.endsWith('-mcp')||p==='hela-runtime');
const info=JSON.parse(fs.readFileSync(new URL('../fixture.json',import.meta.url)));
let tools=[{name:info.id+'_probe',inputSchema:{type:'object'}}];
if(info.id==='hela-runtime'){
 const root=process.env.HELA_ECOSYSTEM_ROOT;
 const profile=JSON.parse(fs.readFileSync(root+'/config/profiles.json')).profiles.find(p=>p.id===process.env.HELA_PROFILE);
 tools=[...profile.servers.map(id=>({name:id+'_probe',inputSchema:{type:'object'}})),{name:'hela.pipe',inputSchema:{type:'object'}}];
}
function reply(m){if(m.id===undefined)return;
 const result=m.method==='initialize'?{serverInfo:{name:info.id,version:info.version},capabilities:{tools:{}}}:{tools};
 return {jsonrpc:'2.0',id:m.id,result};}
if(process.argv.includes('--transport')){
 http.createServer((req,res)=>{
  if(req.url==='/healthz'){res.end('{}');return;}
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const result=reply(JSON.parse(body));
   if(!result){res.statusCode=202;res.end();return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));});
 }).listen(Number(process.argv[process.argv.indexOf('--port')+1]),'127.0.0.1');
}else readline.createInterface({input:process.stdin}).on('line',line=>{const result=reply(JSON.parse(line));if(result)process.stdout.write(JSON.stringify(result)+'\\n');});`;

for (const [id, spec] of Object.entries(inventory.inventory)) {
  const repository = path.join(scratch, 'repositories', spec.dir.split('/')[0]);
  const directory = path.join(scratch, 'repositories', spec.dir);
  fs.mkdirSync(directory, { recursive: true });
  const pkg = { name: id, version: spec.version, type: 'module', scripts: { build: 'node build.cjs' } };
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(pkg));
  fs.writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify({ name: id, version: spec.version, lockfileVersion: 3, packages: { '': pkg } }));
  fs.writeFileSync(path.join(directory, '.gitignore'), 'node_modules/\ndist/\nbuild/\nsrc/\n');
  fs.writeFileSync(path.join(directory, 'fixture.json'), JSON.stringify({ id, version: spec.version }));
  const manifest = `import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
export function repositoryRevision(p){return execFileSync('git',['rev-parse','HEAD'],{cwd:p,encoding:'utf8'}).trim();}
export function buildDigest(){return 'fixture-digest';}`;
  fs.writeFileSync(path.join(directory, 'build.cjs'), `const fs=require('fs'),path=require('path');const entry=${JSON.stringify(spec.entry)};
fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(entry,${JSON.stringify(serverCode)});
${id === 'hela-runtime' ? `fs.writeFileSync('dist/manifest.js',${JSON.stringify(manifest)});` : ''}`);
  run('git', ['init', '--quiet', '--initial-branch=main', repository]);
  run('git', ['add', '.'], { cwd: repository });
  run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Fixture'], { cwd: repository });
  const revision = run('git', ['rev-parse', 'HEAD'], { cwd: repository });
  const repo = pathToFileURL(repository).href;
  Object.assign(spec, { repo, revision, build: 'build' });
  Object.assign(snapshot.servers[id], { repo, commit: revision, branch: 'main' });
}
for (const [file, value] of [['inventory.json', inventory], ['profiles.json', profiles], ['snapshots/latest-stable.json', snapshot]]) {
  fs.writeFileSync(path.join(metadata, 'config', file), JSON.stringify(value));
}

function install(prefix, extra = [], env = {}) {
  const environment = { ...process.env, ...env };
  for (const key of ['OPENROUTER_API_KEY', 'GITHUB_TOKEN', 'GOOGLE_API_KEY', 'GOOGLE_CSE_ID', 'HELA_GENOME_OBSIDIAN_VAULT', 'HELA_GENOME_OBSIDIAN_SYNC_CMD']) delete environment[key];
  return spawnSync(process.execPath, [path.join(root, 'scripts/install.mjs'), '--root', metadata, '--prefix', prefix,
    '--profile', 'all', '--client', 'skip', '--non-interactive', ...extra], {
    encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024, env: environment,
  });
}

function switchMode(prefix, extra = [], env = {}) {
  const environment = { ...process.env, ...env };
  for (const key of ['OPENROUTER_API_KEY', 'GITHUB_TOKEN', 'GOOGLE_API_KEY', 'GOOGLE_CSE_ID', 'HELA_GENOME_OBSIDIAN_VAULT', 'HELA_GENOME_OBSIDIAN_SYNC_CMD']) delete environment[key];
  return spawnSync(process.execPath, [path.join(root, 'scripts/install.mjs'), 'mode', '--root', metadata, '--prefix', prefix,
    '--client', 'skip', '--non-interactive', ...extra], {
    encoding: 'utf8', timeout: 600000, maxBuffer: 8 * 1024 * 1024, env: environment,
  });
}

for (const profile of profiles.profiles) for (const mode of modes) {
  test(`installation plan: ${profile.id}/${mode}`, () => {
    const options = parseOptions(['--profile', profile.id, '--mode', mode, '--root', metadata, '--prefix', path.join(scratch, 'prefix with spaces')], root);
    const plan = installationPlan(options);
    assert.deepEqual(plan.profile.servers, profile.servers);
    assert.equal(plan.keys.length, profile.servers.length + (mode === 'individual' ? 0 : 1));
    for (const id of plan.keys) assert.equal(plan.data.inventory[id].revision, snapshot.servers[id].commit);
    if (profile.servers.includes('hela-plastid')) assert.equal(plan.data.inventory['hela-plastid'].dir, 'll3m-mcp/brain');
  });
}

test('strict arguments reject missing values, unknown flags/modes/clients and unsafe combinations', () => {
  for (const args of [['--profile'], ['--unknown'], ['--mode', 'bogus'], ['--client', 'bogus'], ['--mode', 'docker', '--dev'], ['--mode', 'nix', '--client', 'docker']]) {
    assert.throws(() => parseOptions(args, root));
  }
  assert.equal(parseOptions(['--runtime', '--client', 'docker'], root).mode, 'docker-runtime');
  assert.equal(parseOptions(['--mode', 'runtime', '--client', 'docker'], root).mode, 'docker-runtime');
  assert.equal(parseOptions(['--mode', 'runtime'], root).profile, 'minimal');
  assert.equal(parseOptions(['--system', 'headless'], root).profile, 'headless-server');
  assert.equal(parseOptions(['--profile', 'minimal', '--system', 'headless'], root).profile, 'minimal');
  assert.throws(() => parseOptions(['--profile', '../outside'], root), /Invalid profile/);
  const xdg = process.env.XDG_DATA_HOME;
  try {
    process.env.XDG_DATA_HOME = path.join(scratch, 'xdg');
    assert.equal(parseOptions(['--profile', 'minimal', '--mode', 'runtime'], root).prefix, path.join(scratch, 'xdg/hela/installations/minimal-runtime'));
  } finally { if (xdg === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = xdg; }
});

test('profile capability plan installs Needle and Mirage only when selected', () => {
  const byId = Object.fromEntries(profiles.profiles.map(profile => [profile.id, profileCapabilities(profile)]));
  for (const capabilities of Object.values(byId)) assert.equal(capabilities.needle, true);
  assert.equal(byId.minimal.mirage, false);
  assert.equal(byId['headless-server'].mirage, false);
  assert.equal(byId['android-testing'].mirage, false);
  assert.equal(byId['3d-modeling'].mirage, false);
  for (const id of ['dev-workspace', 'research', 'web-devops', 'all']) assert.equal(byId[id].mirage, true);
});

test('reconfigure infers existing mode/profile before validating transport and client', () => {
  const prefix = path.join(scratch, 'reconfigure-options');
  fs.mkdirSync(prefix);
  fs.writeFileSync(path.join(prefix, '.hela-install.json'), JSON.stringify({ format: 1, managedBy: 'hela-installer', mode: 'runtime', profile: 'minimal', transport: 'http', port: 18081, servers: [] }));
  const options = parseOptions(['--reconfigure', '--prefix', prefix, '--transport', 'http', '--client', 'codex'], root);
  assert.equal(options.mode, 'runtime');assert.equal(options.profile, 'minimal');assert.equal(options.port, 18081);
  assert.throws(() => parseOptions(['--reconfigure', '--prefix', prefix, '--client', 'zed'], root), /no verified HTTP/);
});

test('noninteractive help and invalid flags never prompt or start installs', () => {
  const help = spawnSync(path.join(root, 'setup.sh'), ['--help'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /docker-runtime/);
  const bad = spawnSync('bash', [path.join(root, 'setup.sh'), '--mode'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Missing value/);
});

test('clean all-cell individual install, nested package, private fragment and repeat install', async () => {
  const prefix = path.join(scratch, 'individual with spaces'), home = path.join(scratch, 'user-home');
  fs.mkdirSync(path.join(home, '.config/zed'), { recursive: true });
  const live = path.join(home, '.config/zed/settings.json');
  fs.writeFileSync(live, '{"unrelated":true}');
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = install(prefix, ['--client', 'zed'], { HOME: home });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readInstallation(prefix).servers.length, 10);
    const report = await checkInstallation(prefix);
    assert.equal(report.status, 'READY', JSON.stringify(report));
  }
  assert.equal(fs.readFileSync(live, 'utf8'), '{"unrelated":true}');
  const fragments = fs.readdirSync(prefix).filter(name => name.startsWith('client-zed-'));
  assert.equal(fragments.length, 2);
  for (const file of fragments) {
    assert.equal(fs.statSync(path.join(prefix, file)).mode & 0o777, 0o600);
    const config = JSON.parse(fs.readFileSync(path.join(prefix, file), 'utf8'));
    assert.equal(Object.keys(config.context_servers).length, 10);
    assert.ok(config.context_servers['hela-plastid'].args[0].endsWith('scripts/launch.mjs'));
    const launcher = config.context_servers['hela-plastid'];
    const result = await probeMcp('unused', { launch: { command: launcher.command, args: launcher.args } });
    assert.equal(result.serverInfo.version, inventory.inventory['hela-plastid'].version);
  }
  const absentRuntime = spawnSync(process.execPath, [path.join(root, 'scripts/generate-config.mjs'), 'all', '--client', 'cursor', '--prefix', prefix, '--runtime'], { encoding: 'utf8' });
  assert.equal(absentRuntime.status, 1);assert.match(absentRuntime.stderr, /not installed/);
  const changed = path.join(prefix, 'filesystem-mcp', inventory.inventory['hela-membrane'].entry);
  fs.appendFileSync(changed, '\n// altered fixture build\n');
  const report = await checkInstallation(prefix);
  assert.equal(report.status, 'DEGRADED');
  assert.match(report.servers.find(s => s.id === 'hela-membrane').error, /build differs/);
});

test('clean runtime install has exact cold catalog parity and no cell startup', async () => {
  const prefix = path.join(scratch, 'runtime');
  const result = install(prefix, ['--mode', 'runtime', '--client', 'codex']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = await checkInstallation(prefix);
  assert.equal(report.status, 'READY', JSON.stringify(report));
  assert.equal(report.catalogMatch, true);
  assert.equal(report.servers.find(s => s.id === 'hela-runtime').httpReady, true);
  const saved = readInstallation(prefix);
  fs.writeFileSync(path.join(prefix, '.hela-install.json'), JSON.stringify({ ...saved, node: path.join(scratch, 'missing-node') }));
  assert.equal((await checkInstallation(prefix)).status, 'DEGRADED');
  fs.writeFileSync(path.join(prefix, '.hela-install.json'), JSON.stringify(saved));
  fs.writeFileSync(path.join(prefix, '.hela-install.json'), JSON.stringify({ ...saved, transport: 'http', port: 18081 }));
  const httpConfig = JSON.parse(run(process.execPath, [path.join(root, 'scripts/generate-config.mjs'), 'all', '--client', 'cursor', '--prefix', prefix, '--mode', 'runtime']));
  assert.equal(httpConfig.mcpServers['hela-runtime'].url, 'http://127.0.0.1:18081/mcp');
  const wrongTransport = install(prefix, ['--mode', 'runtime', '--reconfigure', '--transport', 'stdio']);
  assert.equal(wrongTransport.status, 1);assert.match(wrongTransport.stderr, /cannot change transport/);
  fs.writeFileSync(path.join(prefix, '.hela-install.json'), JSON.stringify(saved));
  const fragment = fs.readdirSync(prefix).find(name => name.startsWith('client-codex-'));
  const config = fs.readFileSync(path.join(prefix, fragment), 'utf8');
  assert.equal(config.split('[mcp_servers.').length - 1, 1);
  assert.ok(config.includes('hela-runtime'));
  fs.writeFileSync(path.join(prefix, '.hela-install.pending.json'), '{}');
  assert.equal((await checkInstallation(prefix)).status, 'DEGRADED');
});

test('mode switching reuses builds, preserves data and regenerates the fragment', async () => {
  const prefix = path.join(scratch, 'switching');
  const first = install(prefix, ['--client', 'zed']);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(readInstallation(prefix).mode, 'individual');
  assert.equal(readInstallation(prefix).servers.length, 10);
  const dataFile = path.join(prefix, 'data', 'hela-genome', 'memory.db');
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, 'preserved memory');

  const toRuntime = switchMode(prefix, ['--mode', 'runtime', '--client', 'codex']);
  assert.equal(toRuntime.status, 0, toRuntime.stdout + toRuntime.stderr);
  const runtime = readInstallation(prefix);
  assert.equal(runtime.mode, 'runtime');
  assert.equal(runtime.profile, 'all');
  assert.equal(runtime.snapshot, snapshot.snapshot_version);
  assert.equal(runtime.servers.length, 11);
  assert.ok(runtime.servers.some(server => server.id === 'hela-runtime'));
  assert.equal(fs.readFileSync(dataFile, 'utf8'), 'preserved memory');
  const runtimeReport = await checkInstallation(prefix);
  assert.equal(runtimeReport.status, 'READY', JSON.stringify(runtimeReport));
  assert.equal(runtimeReport.catalogMatch, true);
  assert.ok(toRuntime.stderr.includes('Reusing verified build: hela-mitosis'), 'cells must not be rebuilt');
  const fragment = fs.readdirSync(prefix).find(name => name.startsWith('client-codex-'));
  assert.equal(fs.readFileSync(path.join(prefix, fragment), 'utf8').split('[mcp_servers.').length - 1, 1);

  const back = switchMode(prefix, ['--mode', 'individual']);
  assert.equal(back.status, 0, back.stdout + back.stderr);
  const individual = readInstallation(prefix);
  assert.equal(individual.mode, 'individual');
  assert.equal(individual.servers.length, 10);
  assert.equal(fs.readFileSync(dataFile, 'utf8'), 'preserved memory');
  assert.equal((await checkInstallation(prefix)).status, 'READY');

  const sameMode = switchMode(prefix, ['--mode', 'individual']);
  assert.equal(sameMode.status, 1);
  assert.match(sameMode.stderr, /already uses mode individual/);

  const httpOnIndividual = switchMode(prefix, ['--mode', 'runtime', '--transport', 'http', '--port', '18099']);
  assert.equal(httpOnIndividual.status, 0, httpOnIndividual.stdout + httpOnIndividual.stderr);
  assert.equal(readInstallation(prefix).transport, 'http');
  assert.equal(readInstallation(prefix).port, 18099);
  const toIndividual = switchMode(prefix, ['--mode', 'individual']);
  assert.equal(toIndividual.status, 1);
  assert.match(toIndividual.stderr, /HTTP transport requires runtime/);
  assert.equal(readInstallation(prefix).mode, 'runtime');
  fs.writeFileSync(path.join(prefix, '.hela-install.pending.json'), '{}');
  const pending = switchMode(prefix, ['--mode', 'individual']);
  assert.equal(pending.status, 1);
  assert.match(pending.stderr, /incomplete installation is pending/);
  fs.unlinkSync(path.join(prefix, '.hela-install.pending.json'));
});

test('mode switching refuses unmanaged prefixes and missing values', () => {
  const unmanaged = path.join(scratch, 'switch-unmanaged');
  fs.mkdirSync(unmanaged, { recursive: true });
  const result = switchMode(unmanaged, ['--mode', 'runtime']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /existing managed --prefix/);
  assert.equal(fs.readdirSync(unmanaged).length, 0);
  const missing = spawnSync(path.join(root, 'setup.sh'), ['mode', '--prefix', path.join(scratch, 'switching'), '--mode'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Missing value/);
});

test('unmanaged prefixes and existing output files are preserved', () => {
  const prefix = path.join(scratch, 'unmanaged');
  fs.mkdirSync(prefix);fs.writeFileSync(path.join(prefix, 'user.txt'), 'keep');
  const result = install(prefix);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unmanaged/);
  assert.equal(fs.readFileSync(path.join(prefix, 'user.txt'), 'utf8'), 'keep');
  const out = path.join(scratch, 'existing.json');fs.writeFileSync(out, 'keep');
  const rejected = install(path.join(scratch, 'unused'), ['--out', out]);
  assert.equal(rejected.status, 1);
  assert.equal(fs.readFileSync(out, 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(scratch, 'unused')), false);
});

test('missing selected snapshot and failed checkout cannot become READY', () => {
  const missing = install(path.join(scratch, 'missing-snapshot'), ['--snapshot', 'not-a-release']);
  assert.equal(missing.status, 1);
  const badSnapshot = structuredClone(snapshot);
  badSnapshot.servers['hela-mitosis'].commit = '0'.repeat(40);
  const file = path.join(scratch, 'bad-snapshot.json');fs.writeFileSync(file, JSON.stringify(badSnapshot));
  const prefix = path.join(scratch, 'bad-checkout');
  const failed = install(prefix, ['--snapshot', file]);
  assert.equal(failed.status, 1);
  assert.equal(fs.existsSync(path.join(prefix, '.hela-install.json')), false);
  assert.equal(fs.existsSync(path.join(prefix, '.hela-install.pending.json')), true);
  assert.equal(fs.existsSync(path.join(prefix, '.hela-install.lock')), false);
  const retried = install(prefix, ['--profile', 'minimal']);
  assert.equal(retried.status, 0, retried.stdout + retried.stderr);
  assert.equal(fs.existsSync(path.join(prefix, '.hela-install.pending.json')), false);
});

test('existing dirty, symlinked and wrong-origin repositories are refused without discarding work', () => {
  for (const kind of ['dirty', 'symlink', 'origin']) {
    const prefix = path.join(scratch, 'unsafe-' + kind), repository = path.join(prefix, 'chaining-mcp');
    fs.mkdirSync(prefix);
    fs.writeFileSync(path.join(prefix, '.hela-install.pending.json'), JSON.stringify({ managedBy: 'hela-installer', format: 1 }));
    const source = path.join(scratch, 'repositories/chaining-mcp');
    if (kind === 'symlink') fs.symlinkSync(source, repository, 'dir');
    else {
      run('git', ['clone', '--quiet', pathToFileURL(source).href, repository]);
      if (kind === 'dirty') fs.appendFileSync(path.join(repository, 'fixture.json'), '\n');
      else run('git', ['remote', 'set-url', 'origin', 'https://example.invalid/wrong.git'], { cwd: repository });
    }
    const result = install(prefix, ['--profile', 'minimal']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, kind === 'dirty' ? /dirty repository/ : kind === 'symlink' ? /symlinked repository/ : /origin mismatch/);
    if (kind === 'dirty') assert.ok(fs.readFileSync(path.join(repository, 'fixture.json'), 'utf8').endsWith('\n'));
  }
});

test('doctor missing-prefix JSON is machine-readable and fails', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/doctor.mjs'), '--prefix', path.join(scratch, 'absent'), '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, 'DEGRADED');
});

test('asset downloads verify checksums atomically and preserve existing files on failure', async () => {
  const previous = globalThis.fetch;
  const file = path.join(scratch, 'asset');
  const bytes = Buffer.from('fixture asset'), checksum = createHash('sha256').update(bytes).digest('hex');
  try {
    globalThis.fetch = async () => new Response(bytes);
    await downloadVerified('https://example.invalid/asset', file, checksum);
    assert.deepEqual(fs.readFileSync(file), bytes);
    globalThis.fetch = async () => new Response('corrupt');
    await assert.rejects(downloadVerified('https://example.invalid/asset', file, 'b'.repeat(64)), /checksum mismatch/);
    assert.deepEqual(fs.readFileSync(file), bytes);
    await assert.rejects(downloadVerified('https://example.invalid/asset', file, 'c'.repeat(64), 2), /exceeds/);
    assert.deepEqual(fs.readFileSync(file), bytes);
    assert.equal(fs.readdirSync(scratch).some(name => name.startsWith('asset.') && name.endsWith('.tmp')), false);
  } finally { globalThis.fetch = previous; }
});

test('HTTP doctor requires MCP replies, supports SSE/session headers and rejects duplicate schemas', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{"status":"ok"}');
    await assert.rejects(probeHttpEndpoint('http://localhost/mcp'), /invalid\/error reply/);
    const observed = [];
    globalThis.fetch = async (url, options) => {
      const request = JSON.parse(options.body);observed.push(options.headers);
      if (!request.id) return new Response(null, { status: 202 });
      const result = request.method === 'initialize' ? { serverInfo: { version: '1.2.0' }, capabilities: { tools: {} } }
        : { tools: [{ name: 'fixture', inputSchema: { type: 'object' } }] };
      return new Response('data: ' + JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n\n', {
        headers: { 'Content-Type': 'text/event-stream', 'Mcp-Session-Id': 'fixture-session' } });
    };
    assert.equal((await probeHttpEndpoint('http://localhost/mcp')).tools.length, 1);
    assert.equal(observed[2]['Mcp-Session-Id'], 'fixture-session');
    globalThis.fetch = async (url, options) => {
      const request = JSON.parse(options.body);
      if (!request.id) return new Response(null, { status: 202 });
      const tool = { name: 'duplicate', inputSchema: { type: 'object' } };
      const result = request.method === 'initialize' ? { serverInfo: { version: '1.2.0' }, capabilities: { tools: {} } } : { tools: [tool, tool] };
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
    };
    await assert.rejects(probeHttpEndpoint('http://localhost/mcp'), /duplicate/);
    await assert.rejects(probeHttpEndpoint('file:///private'), /Invalid MCP HTTP URL/);
    await assert.rejects(probeHttpEndpoint('https://user:password@example.invalid/mcp'), /Invalid MCP HTTP URL/);
  } finally { globalThis.fetch = previous; }
});

test('Docker doctor uses isolated named containers and removes them on MCP failure', async () => {
  const bin = path.join(scratch, 'fake-bin'), record = path.join(scratch, 'docker-calls.jsonl');
  fs.mkdirSync(bin);
  const imageId = 'sha256:' + 'a'.repeat(64);
  fs.writeFileSync(path.join(bin, 'docker'), `#!${process.execPath}\nconst fs=require('fs'),a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(record)},JSON.stringify(a)+'\\n');
if(a[0]==='image'){console.log(${JSON.stringify(imageId)});process.exit(0);}if(a[0]==='rm')process.exit(0);
if(a.includes('-e')){console.log(JSON.stringify({servers:[{id:'hela-genome',version:'3.0.0',revision:'fixture'}]}));process.exit(0);}
const rl=require('readline').createInterface({input:process.stdin});rl.on('line',line=>{const m=JSON.parse(line);if(m.id===undefined)return;
console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:m.method==='initialize'?{serverInfo:{name:'fixture',version:'wrong'},capabilities:{tools:{}}}:{tools:[{name:'fixture',inputSchema:{type:'object'}}]}}));});`, { mode: 0o755 });
  const previous = process.env.PATH;process.env.PATH = bin + path.delimiter + previous;
  try {
    const report = await checkContainerInstallation({ mode: 'docker', profile: 'minimal', imageId,
      servers: [{ id: 'hela-genome', dir: 'project-mcp', entry: 'dist/index.js', version: '3.0.0', revision: 'fixture' }] });
    assert.equal(report.status, 'DEGRADED');
    const calls = fs.readFileSync(record, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const start = calls.find(args => args[0] === 'run' && args.includes('--name'));
    assert.ok(start.includes('--network') && start.includes('none') && start.includes('--tmpfs'));
    assert.ok(!start.includes('--volume'));
    const name = start[start.indexOf('--name') + 1];
    assert.match(name, /^hela-doctor-/);
    assert.deepEqual(calls.at(-1), ['rm', '--force', name]);
  } finally { process.env.PATH = previous; }
});
