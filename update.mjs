#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'update-controller.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(`[hela-update] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
