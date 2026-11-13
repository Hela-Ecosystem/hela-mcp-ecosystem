#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const command = argv[0] === 'doctor' ? 'doctor.mjs' : 'install.mjs';
const forwarded = argv[0] === 'doctor' ? argv.slice(1) : argv;
const nixRequested = forwarded.includes('--nix') || forwarded.some((value, index) => value === '--mode' && forwarded[index + 1] === 'nix');

if (process.platform === 'win32' && nixRequested) {
  console.error('[hela-install] --nix requires a Unix-compatible Nix environment; use WSL or a host installation mode on Windows.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [path.join(root, 'scripts', command), ...forwarded], { stdio: 'inherit' });
if (result.error) {
  console.error(`[hela-install] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
