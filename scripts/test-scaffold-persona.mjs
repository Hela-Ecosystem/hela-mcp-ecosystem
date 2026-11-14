import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { generatePersonaFiles, scaffoldPersona, scaffoldPersonaIfMissing, ECOSYSTEM_ROOT, resolveSkillsForProfile } from './scaffold-persona.mjs';
import { loadInventory } from './inventory.mjs';

const data = loadInventory(ECOSYSTEM_ROOT);

test('scaffold-persona generates valid content for all 8 canonical profiles', () => {
  for (const profile of data.profiles) {
    const res = generatePersonaFiles(profile.id, ECOSYSTEM_ROOT);
    assert.equal(res.profile.id, profile.id);
    const files = res.files;
    assert.ok(files['IDENTITY.md'], 'has IDENTITY.md');
    assert.ok(files['SOUL.md'], 'has SOUL.md');
    assert.ok(files['TOOLS.md'], 'has TOOLS.md');
    assert.ok(files['AGENTS.md'], 'has AGENTS.md');

    // Persona blend
    assert.ok(files['IDENTITY.md'].includes("Frea's contribution") && files['IDENTITY.md'].includes("Mema's contribution"), 'HeLa blends Frea and Mema');
    assert.ok(files['SOUL.md'].includes('Frea') && files['SOUL.md'].includes('Mema'), 'SOUL mentions both influences');
    assert.ok(files['USER.md'].includes('without private user biography'), 'distributed persona has no private biography');

    // Profile awareness
    assert.ok(files['IDENTITY.md'].includes(`\`${profile.id}\``), 'mentions active profile id');
    assert.ok(files['IDENTITY.md'].includes(profile.name), 'mentions profile name');
    assert.ok(files['AGENTS.md'].includes(`HELA_PROFILE=${profile.id}`), 'session entrypoint pins profile');

    // Active organelles
    for (const serverId of profile.servers) {
      assert.ok(files['IDENTITY.md'].includes(`\`${serverId}\``), `active organelle ${serverId} in IDENTITY`);
      assert.ok(files['TOOLS.md'].includes(`\`${serverId}\``), `active organelle ${serverId} in TOOLS`);
    }

    // Inactive organelles forbidden
    const allServers = Object.keys(data.inventory).filter(k => k !== 'hela-runtime');
    const inactiveServers = allServers.filter(id => !profile.servers.includes(id));
    for (const serverId of inactiveServers) {
      assert.ok(files['IDENTITY.md'].includes(`❌ \`${serverId}\``), `forbidden organelle ${serverId} marked with ❌`);
    }
  }
});

test('scaffold-persona resolves skills matching active profile organelles', () => {
  const minimalSkills = resolveSkillsForProfile(['hela-mitosis', 'hela-genome', 'hela-enzyme']);
  assert.ok(minimalSkills.includes('guardian-memory'));
  assert.ok(minimalSkills.includes('skill-finder'));
  assert.ok(!minimalSkills.includes('ll3m-agent'));

  const blenderSkills = resolveSkillsForProfile(['hela-mitosis', 'hela-genome', 'hela-plastid']);
  assert.ok(blenderSkills.includes('ll3m-agent'));
});

test('scaffoldPersona writes files and symlinks cleanly in isolated tempdir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-persona-test-'));
  try {
    const res = scaffoldPersona({
      profile: 'research',
      targetDir: 'agent_persona',
      workspaceDir: tmp,
      symlink: true,
      root: ECOSYSTEM_ROOT,
    });

    assert.equal(res.profile, 'research');
    assert.equal(res.written.length, 5);

    const personaDir = path.join(tmp, 'agent_persona');
    assert.ok(fs.existsSync(path.join(personaDir, 'IDENTITY.md')));
    assert.ok(fs.existsSync(path.join(personaDir, 'SOUL.md')));
    assert.ok(fs.existsSync(path.join(personaDir, 'TOOLS.md')));
    assert.ok(fs.existsSync(path.join(personaDir, 'AGENTS.md')));
    assert.ok(fs.existsSync(path.join(personaDir, 'USER.md')));

    // Symlinks
    assert.ok(fs.existsSync(path.join(tmp, 'AGENTS.md')));
    assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(tmp, 'GEMINI.md')));

    // Check content inside
    const identity = fs.readFileSync(path.join(personaDir, 'IDENTITY.md'), 'utf8');
    assert.ok(identity.includes('HeLa Research Terminal'));
    assert.ok(identity.includes('❌ `hela-receptor`'));
    assert.ok(identity.includes('❌ `hela-plastid`'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('scaffoldPersonaIfMissing takes over a clean workspace and preserves an existing persona', () => {
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-persona-clean-'));
  const existing = fs.mkdtempSync(path.join(os.tmpdir(), 'hela-persona-existing-'));
  try {
    const created = scaffoldPersonaIfMissing({ profile: 'dev-workspace', workspaceDir: clean, root: ECOSYSTEM_ROOT });
    assert.equal(created.created, true);
    assert.equal(created.preserved, false);
    assert.ok(fs.existsSync(path.join(clean, 'agent_persona', 'SOUL.md')));
    assert.ok(fs.existsSync(path.join(clean, 'AGENTS.md')));

    fs.mkdirSync(path.join(existing, 'agent_persona'));
    fs.writeFileSync(path.join(existing, 'agent_persona', 'SOUL.md'), 'user persona');
    const preserved = scaffoldPersonaIfMissing({ profile: 'all', workspaceDir: existing, root: ECOSYSTEM_ROOT });
    assert.equal(preserved.created, false);
    assert.equal(preserved.preserved, true);
    assert.equal(fs.readFileSync(path.join(existing, 'agent_persona', 'SOUL.md'), 'utf8'), 'user persona');
  } finally {
    fs.rmSync(clean, { recursive: true, force: true });
    fs.rmSync(existing, { recursive: true, force: true });
  }
});
