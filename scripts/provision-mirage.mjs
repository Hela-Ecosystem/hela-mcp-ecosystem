import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PACKAGE = 'cactus-compute[vision]';

function invoke(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout ?? 900000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return result;
}

function pythonCandidates() {
  if (process.platform === 'win32') return [
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
  ];
  return [
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
  ];
}

function selectPython() {
  for (const candidate of pythonCandidates()) {
    const result = invoke(candidate.command, [...candidate.prefix, '--version']);
    const version = `${result.stdout ?? ''} ${result.stderr ?? ''}`.match(/Python\s+(\d+)\.(\d+)/i);
    if (!result.error && result.status === 0 && version && (Number(version[1]) > 3 || Number(version[1]) === 3 && Number(version[2]) >= 9)) return candidate;
  }
  throw new Error('Mirage requires Python 3.9 or newer; install Python and rerun the selected profile installation');
}

function pythonPath(venv) {
  return process.platform === 'win32'
    ? path.join(venv, 'Scripts', 'python.exe')
    : path.join(venv, 'bin', 'python');
}

function runPython(python, args, options = {}) {
  const result = invoke(python.command, [...python.prefix, ...args], options);
  if (result.error || result.status !== 0) {
    const detail = result.stderr?.trim().slice(-2000) || result.error?.message || `exit ${result.status}`;
    throw new Error(`Python Mirage setup failed: ${detail}`);
  }
  return result.stdout?.trim() ?? '';
}

function hasCactus(python) {
  const result = invoke(python, ['-c', 'import cactus']);
  return !result.error && result.status === 0;
}

/**
 * Install the managed Mirage bridge only for profiles that include Cytosol.
 * The virtualenv lives beside browser-mcp so both direct and runtime launches
 * can resolve the same Python worker on Linux, macOS, and Windows.
 */
export function provisionMirage(directory) {
  const worker = path.join(directory, 'src', 'vision', 'mirage_worker.py');
  if (!fs.existsSync(worker)) return null;

  const python = selectPython();
  const venvPath = path.join(directory, 'user_data', 'mirage', '.venv');
  const executable = pythonPath(venvPath);
  fs.mkdirSync(path.dirname(venvPath), { recursive: true, mode: 0o700 });

  if (!fs.existsSync(executable)) {
    runPython(python, ['-m', 'venv', venvPath], { cwd: directory });
  }
  if (!fs.existsSync(executable)) throw new Error(`Mirage virtualenv was not created: ${executable}`);

  const managed = { command: executable, prefix: [] };
  if (!hasCactus(executable)) {
    runPython(managed, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', PACKAGE], { cwd: directory });
  }
  if (!hasCactus(executable)) throw new Error('Mirage setup completed but cactus-compute could not be imported');

  return { ready: true, package: PACKAGE, venvPath, pythonPath: executable, workerPath: worker };
}
