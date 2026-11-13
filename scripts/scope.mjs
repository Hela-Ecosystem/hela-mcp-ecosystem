import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { loadInventory, resolveServerDir, selectProfile } from './inventory.mjs';

export function parseScopeArgs(argv, usage) {
  const result = { all: false, profile: null, keys: [], help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--all') result.all = true;
    else if (value === '--profile') {
      result.profile = argv[++i];
      if (!result.profile || result.profile.startsWith('--')) throw new Error('Missing value for --profile');
    } else if (value === '--help' || value === '-h') result.help = true;
    else if (value.startsWith('--')) throw new Error(`Unknown option: ${value}`);
    else result.keys.push(value);
  }
  if (result.all && (result.profile || result.keys.length)) throw new Error('--all cannot be combined with --profile or server keys');
  if (result.profile && result.keys.length) throw new Error('--profile cannot be combined with server keys');
  if (result.help) console.log(usage);
  return result;
}

async function chooseScope(data) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const choice = (await input.question('Scope: 1) all servers  2) profile  3) server keys [1]: ')).trim() || '1';
    if (choice === '2') {
      const profiles = data.profiles;
      profiles.forEach((profile, index) => console.log(`  ${index + 1}) ${profile.name ?? profile.id} [${profile.id}]`));
      const selected = Number((await input.question(`Profile [1-${profiles.length}]: `)).trim());
      if (!Number.isInteger(selected) || selected < 1 || selected > profiles.length) throw new Error('Invalid profile selection');
      return { all: false, profile: profiles[selected - 1].id, keys: [] };
    }
    if (choice === '3') {
      const keys = (await input.question('Server keys (space separated): ')).trim().split(/\s+/).filter(Boolean);
      if (!keys.length) throw new Error('At least one server key is required');
      return { all: false, profile: null, keys };
    }
    return { all: true, profile: null, keys: [] };
  } finally {
    input.close();
  }
}

export async function selectedServers(root, scope) {
  const data = loadInventory(root);
  let resolved = scope;
  if (!scope.all && !scope.profile && scope.keys.length === 0) {
    if (!process.stdin.isTTY) throw new Error('Specify --all, --profile, or one or more server keys in non-interactive mode');
    resolved = await chooseScope(data);
  }
  let keys;
  if (resolved.all) keys = Object.keys(data.inventory);
  else if (resolved.profile) keys = selectProfile(data, resolved.profile).servers;
  else keys = resolved.keys.map((key) => data.aliases?.[key] ?? key);
  const seen = new Set();
  return keys.map((key) => {
    if (seen.has(key)) return null;
    seen.add(key);
    const spec = data.inventory[key];
    if (!spec) throw new Error(`Unknown server key: ${key}`);
    return { key, spec, dir: resolveServerDir(spec, root), alias: spec.alias ?? key };
  }).filter(Boolean);
}

export function packageScripts(directory) {
  try {
    const packageFile = path.join(directory, 'package.json');
    return JSON.parse(fs.readFileSync(packageFile, 'utf8')).scripts ?? {};
  } catch {
    return {};
  }
}
