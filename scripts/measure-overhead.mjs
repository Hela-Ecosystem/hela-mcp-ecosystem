#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePersonaFiles } from './scaffold-persona.mjs';
import { loadInventory, selectProfile } from './inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let profileId = 'minimal';
for (let index = 2; index < process.argv.length; index++) {
  if (process.argv[index] !== '--profile') throw new Error(`Unknown option: ${process.argv[index]}`);
  profileId = process.argv[++index];
  if (!profileId || profileId.startsWith('--')) throw new Error('Missing profile ID');
}

const data = loadInventory(root);
const profile = selectProfile(data, profileId);
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config/tool-catalog.json'), 'utf8'));
const persona = generatePersonaFiles(profileId, root);
const personaBytes = Object.values(persona.files).reduce((size, content) => size + Buffer.byteLength(content, 'utf8'), 0);
const tools = profile.servers.flatMap(serverId => {
  const variants = catalog.cells[serverId]?.variants;
  if (!Array.isArray(variants) || !variants[0]?.tools) throw new Error(`Missing default tool catalog variant: ${serverId}`);
  return variants[0].tools.map(tool => ({
    name: `${serverId}.${tool.name}`,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema,
  }));
}).sort((left, right) => left.name.localeCompare(right.name));
const discoveryBytes = Buffer.byteLength(JSON.stringify(tools), 'utf8');
const estimateTokens = bytes => Math.ceil(bytes / 4);

console.log(`profile: ${profile.id}`);
console.log(`base_persona_bytes: ${personaBytes}`);
console.log(`base_persona_token_estimate: ${estimateTokens(personaBytes)}`);
console.log(`discovery_payload_bytes: ${discoveryBytes}`);
console.log(`discovery_payload_token_estimate: ${estimateTokens(discoveryBytes)}`);
console.log('tokeniser_assumption: rough ceil(UTF-8 bytes / 4); not a model tokenizer');
