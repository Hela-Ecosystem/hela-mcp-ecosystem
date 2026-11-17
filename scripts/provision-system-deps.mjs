import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createInterface } from 'node:readline/promises';

const MINIMUM_TMUX = [1, 8]; // The tmux -V version probe is available from 1.8.
const MANAGERS = {
  apt: { command: 'apt-get', args: ['install', '-y', 'tmux'], manual: 'apt-get install -y tmux' },
  dnf: { command: 'dnf', args: ['install', '-y', 'tmux'], manual: 'dnf install -y tmux' },
  pacman: { command: 'pacman', args: ['-S', '--noconfirm', 'tmux'], manual: 'pacman -S tmux' },
  apk: { command: 'apk', args: ['add', 'tmux'], manual: 'apk add tmux' },
  brew: { command: 'brew', args: ['install', 'tmux'], manual: 'brew install tmux', requiresRoot: false },
};

function invoke(command, args, env) {
  return spawnSync(command, args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 1024 * 1024 });
}

function parseVersion(output) {
  const match = output.match(/(?:^|\s)tmux\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
  return match ? { text: `${match[1]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`, parts: match.slice(1).map(value => Number(value ?? 0)) } : null;
}

function meetsFloor(parts) {
  return parts[0] > MINIMUM_TMUX[0] || (parts[0] === MINIMUM_TMUX[0] && parts[1] >= MINIMUM_TMUX[1]);
}

function managerFor(platform, env) {
  if (platform === 'darwin') return MANAGERS.brew;
  if (platform !== 'linux') return null;
  const id = (env.HELA_OS_ID ?? '').toLowerCase();
  if (id) {
    if (['debian', 'ubuntu', 'linuxmint', 'pop'].includes(id)) return MANAGERS.apt;
    if (['fedora', 'rhel', 'centos', 'rocky', 'almalinux'].includes(id)) return MANAGERS.dnf;
    if (['arch', 'manjaro'].includes(id)) return MANAGERS.pacman;
    if (['alpine'].includes(id)) return MANAGERS.apk;
    return null;
  }
  let release;
  try { release = fs.readFileSync('/etc/os-release', 'utf8').match(/^ID=(?:"([^"]+)"|'([^']+)'|([^\n]+))/m); } catch { return null; }
  return managerFor('linux', { ...env, HELA_OS_ID: release?.[1] ?? release?.[2] ?? release?.[3] ?? '' });
}

function result(status, version = null, method = null) { return { status, version, method }; }

async function confirmInstall(nonInteractive, confirm, env) {
  if (confirm) return Boolean(await confirm());
  if (env.HELA_SYSTEM_DEPS_INSTALL === '1') return true;
  if (nonInteractive || !process.stdin.isTTY) return false;
  const input = createInterface({ input: process.stdin, output: process.stderr });
  try { return /^y(?:es)?$/i.test((await input.question('Install tmux with the system package manager? [y/N] ')).trim()); }
  finally { input.close(); }
}

/** Probe and, only after explicit consent, install tmux without upgrading an existing version. */
export async function provisionSystemDeps({ enabled = true, nonInteractive = false, nix = false, platform = process.platform,
  env = process.env, confirm, isRoot = typeof process.getuid === 'function' && process.getuid() === 0, onStatus = () => {} } = {}) {
  if (nix) return result('present', null, 'nix-devshell');
  if (!enabled || env.CI) return result('skipped', null, env.CI ? 'ci' : 'flag');

  const probe = invoke('tmux', ['-V'], env);
  const version = parseVersion(`${probe.stdout ?? ''} ${probe.stderr ?? ''}`);
  if (!probe.error && probe.status === 0) {
    if (!version) return result('incompatible', null, 'path');
    return result(meetsFloor(version.parts) ? 'present' : 'incompatible', version.text, 'path');
  }
  if (!probe.error && probe.status !== 0 && probe.status !== 127) return result('incompatible', version?.text ?? null, 'path');

  const manager = managerFor(platform, env);
  if (!manager) return result('unsupported', null, 'platform');
  const needsPrivilege = manager.requiresRoot !== false;
  const sudoCheck = isRoot || !needsPrivilege ? null : invoke('sudo', ['-n', 'true'], env);
  const canUseSudo = isRoot || !needsPrivilege || (!sudoCheck.error && sudoCheck.status === 0);
  if (!canUseSudo) {
    const command = `sudo ${manager.manual}`;
    onStatus(`tmux is missing. Install it manually with: ${command}`);
    return result('skipped', null, 'manual-command');
  }

  if (!(await confirmInstall(nonInteractive, confirm, env))) {
    const command = isRoot ? manager.manual : `sudo ${manager.manual}`;
    onStatus(`tmux installation declined. Manual command: ${command}`);
    return result('declined', null, 'consent');
  }

  const elevate = !isRoot && needsPrivilege;
  const command = elevate ? 'sudo' : manager.command;
  const args = elevate ? ['-n', manager.command, ...manager.args] : manager.args;
  const installed = invoke(command, args, env);
  if (installed.error || installed.status !== 0) {
    const manual = isRoot ? manager.manual : `sudo ${manager.manual}`;
    onStatus(`tmux installation did not complete. Install it manually with: ${manual}`);
    return result('skipped', null, 'install-failed');
  }
  const verify = invoke('tmux', ['-V'], env);
  const installedVersion = parseVersion(`${verify.stdout ?? ''} ${verify.stderr ?? ''}`);
  if (!installedVersion) return result('skipped', null, manager.command);
  return result(meetsFloor(installedVersion.parts) ? 'installed' : 'incompatible', installedVersion.text, manager.command);
}

export const systemDependencyRegistry = Object.freeze({ tmux: { minimumVersion: '1.8', versionArgv: ['-V'], managers: MANAGERS } });
