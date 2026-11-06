import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Compatible Needle 3 assets before upstream moved to the Cactus 4 runtime.
const revision = 'd6c7d6a2e9655505e0f8e23339356dd1705900eb';
const engines = {
  'linux/x64': ['linux-x86_64/needle', '77cd35ee75c53df8532b397e11ed7cf94a45d89a9f14f50881fd9c68ba54a2d0'],
  'linux/arm64': ['linux-arm64/needle', 'a7dd07f740763507edbca760dc7e7065b6da6b6bd6c3a05288ca974f14ce0fcb'],
  'darwin/arm64': ['macos-arm64/needle', '0a480f7e01d1fcf9df2e6dbc29af29411406720a5c5cb73024fcd6d16aa25b60'],
};
const modelHash = 'c9d915eca282ed42d1a09b143b592adb4cc6744ffe2d294adf5cfc5548170c38';

export async function downloadVerified(url, destination, expected, maximum = 64 * 1024 * 1024) {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('Invalid asset checksum');
  if (fs.existsSync(destination) && createHash('sha256').update(fs.readFileSync(destination)).digest('hex') === expected) return;
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!response.ok || !response.body) throw new Error(`Pinned asset download failed: HTTP ${response.status}`);
  const temporary = destination + '.' + randomUUID() + '.tmp';
  const hash = createHash('sha256');
  let size = 0;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, encoding, callback) {
      size += chunk.length;
      if (size > maximum) return callback(new Error('Asset exceeds download limit'));
      hash.update(chunk);callback(null, chunk);
    } }), fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    if (hash.digest('hex') !== expected) throw new Error('Asset checksum mismatch');
    fs.renameSync(temporary, destination);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export async function provisionNeedle(directory, withoutModel) {
  if (!fs.existsSync(path.join(directory, 'scripts/ensure-needle.mjs'))) return null;
  if (withoutModel) return { ready: false, note: 'Local model explicitly omitted with --without-model' };
  const engine = engines[`${process.platform}/${process.arch}`];
  if (!engine) throw new Error('No pinned Needle binary for this platform; use --without-model for core MCP only');
  const base = `https://huggingface.co/Cactus-Compute/needle3/resolve/${revision}/`;
  const enginePath = path.join(directory, 'assets/needle/needle3');
  const modelPath = path.join(directory, 'assets/needle/needle3.cact');
  await downloadVerified(base + engine[0], enginePath, engine[1]);
  await downloadVerified(base + 'needle3.cact', modelPath, modelHash);
  await downloadVerified(base + 'LICENSE', path.join(directory, 'assets/needle/LICENSE'), 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30', 65536);
  fs.chmodSync(enginePath, 0o755);
  return { ready: true, revision, enginePath, modelPath, engineHash: engine[1], modelHash };
}
