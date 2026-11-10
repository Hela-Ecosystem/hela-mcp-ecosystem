import fs from 'node:fs';
import path from 'node:path';

export function loadInventory(root) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'config/inventory.json'), 'utf8'));
  const profiles = JSON.parse(fs.readFileSync(path.join(root, 'config/profiles.json'), 'utf8')).profiles;
  if (!data.inventory || !Array.isArray(profiles)) throw new Error('Invalid inventory or profiles');
  for (const [id, spec] of Object.entries(data.inventory)) {
    if (spec.id !== id || !/^hela-[a-z-]+$/.test(id) || typeof spec.dir !== 'string' || !spec.dir
        || typeof spec.entry !== 'string' || !spec.entry || typeof spec.version !== 'string') throw new Error(`Invalid inventory entry: ${id}`);
    if (spec.env && (!Array.isArray(spec.env) || !spec.env.every(key => typeof key === 'string'))) throw new Error(`Invalid environment declaration: ${id}`);
    const features = Object.entries(spec.toolFeatures ?? {});
    if (features.length > 8 || features.some(([key, rule]) => !/^[A-Z][A-Z0-9_]*_ENABLED$/.test(key)
      || !rule || typeof rule !== 'object' || (rule.default !== undefined && typeof rule.default !== 'boolean'))) throw new Error(`Invalid feature declaration: ${id}`);
  }
  const ids = new Set();
  for (const profile of profiles) {
    if (typeof profile.id !== 'string' || !profile.id || ids.has(profile.id) || !Array.isArray(profile.servers) || new Set(profile.servers).size !== profile.servers.length) throw new Error('Invalid or duplicate profile');
    ids.add(profile.id);
    for (const id of profile.servers) {
      if (!data.inventory[id] || data.inventory[id].kind === 'runtime') throw new Error(`Invalid profile member: ${id}`);
    }
  }
  return { ...data, profiles };
}

export function selectProfile(data, id = 'minimal') {
  const profile = data.profiles.find(candidate => candidate.id === id);
  if (!profile) throw new Error(`Unknown profile: ${id}`);
  return profile;
}

export function resolveServerDir(spec, root) {
  return [path.join(root, '..', spec.dir), path.join(root, spec.dir)].find(candidate => fs.existsSync(candidate))
    ?? path.join(root, '..', spec.dir);
}

export function featureVariants(spec) {
  return Object.keys(spec.toolFeatures ?? {}).sort().reduce((variants, name) =>
    variants.flatMap(features => [false, true].map(enabled => ({ ...features, [name]: enabled }))), [{}]);
}
