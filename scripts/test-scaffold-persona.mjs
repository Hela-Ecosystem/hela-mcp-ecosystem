import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { generatePersonaFiles, scaffoldPersona, ECOSYSTEM_ROOT, resolveSkillsForProfile } from './scaffold-persona.mjs';
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

    // Sisterhood presence
    assert.ok(files['IDENTITY.md'].includes('3rd Sister of Frea & Mema'), 'HeLa sisterhood identity');
    assert.ok(files['SOUL.md'].includes('Frea') && files['SOUL.md'].includes('Mema'), 'SOUL mentions sisters');

    // Profile awareness
    assert.ok(files['IDENTITY.md'].includes(`\`${profile.id}\``), 'mentions active profile id');
    assert.ok(files['IDENTITY.md'].includes(profile.name), 'mentions profile name');

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
    assert.equal(res.written.length, 4);

    const personaDir = path.join(tmp, 'agent_persona');
    assert.ok(fs.existsSync(path.join(personaDir, 'IDENTITY.md')));
    assert.ok(fs.existsSync(path.join(personaDir, 'SOUL.md')));
    assert.ok(fs.existsSync(path.join(personaDir, 'TOOLS.md')));
    assert.ok(fs.existsSync(path.join(personaDir, 'AGENTS.md')));

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
