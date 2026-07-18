#!/usr/bin/env node
/**
 * Merge per-package i18n fragments into messages/en.json + messages/hi.json.
 *
 * Fragments live at messages/fragments/pkg-X.en.json / pkg-X.hi.json and are
 * written by parallel polish teammates so the two big message files are only
 * ever edited here, in one place. Throws on any leaf-key conflict (a fragment
 * key that already exists with a different value) and on en/hi parity gaps
 * introduced by the fragments.
 *
 * Usage: node scripts/merge-i18n-fragments.mjs [--check]
 *   --check  validate + report only; do not write en.json/hi.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const messagesDir = path.join(webRoot, 'messages');
const fragmentsDir = path.join(messagesDir, 'fragments');
const checkOnly = process.argv.includes('--check');

if (!fs.existsSync(fragmentsDir)) {
  console.log('No fragments directory — nothing to merge.');
  process.exit(0);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function deepMerge(target, source, ctx) {
  for (const [key, value] of Object.entries(source)) {
    const at = ctx.path ? `${ctx.path}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      if (key in target && (target[key] === null || typeof target[key] !== 'object')) {
        throw new Error(`[${ctx.fragment}] "${at}" is an object but base has a string there`);
      }
      target[key] ??= {};
      deepMerge(target[key], value, { ...ctx, path: at });
    } else {
      if (key in target && target[key] !== value) {
        throw new Error(`[${ctx.fragment}] leaf conflict at "${at}" — key already exists in base with a different value`);
      }
      target[key] = value;
    }
  }
}

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object' ? flatten(v, key) : [key];
  });

const en = readJson(path.join(messagesDir, 'en.json'));
const hi = readJson(path.join(messagesDir, 'hi.json'));

const fragmentBases = fs
  .readdirSync(fragmentsDir)
  .filter((f) => f.endsWith('.en.json'))
  .map((f) => f.replace(/\.en\.json$/, ''))
  .sort();

if (fragmentBases.length === 0) {
  console.log('Fragments directory is empty — nothing to merge.');
  process.exit(0);
}

let added = 0;
for (const base of fragmentBases) {
  const enFrag = readJson(path.join(fragmentsDir, `${base}.en.json`));
  const hiPath = path.join(fragmentsDir, `${base}.hi.json`);
  if (!fs.existsSync(hiPath)) throw new Error(`${base}.hi.json is missing`);
  const hiFrag = readJson(hiPath);

  const enKeys = flatten(enFrag).sort();
  const hiKeys = flatten(hiFrag).sort();
  const missingHi = enKeys.filter((k) => !hiKeys.includes(k));
  const missingEn = hiKeys.filter((k) => !enKeys.includes(k));
  if (missingHi.length || missingEn.length) {
    throw new Error(
      `${base}: fragment parity failure\n  missing in hi: ${missingHi.join(', ') || '—'}\n  missing in en: ${missingEn.join(', ') || '—'}`,
    );
  }

  deepMerge(en, enFrag, { fragment: `${base}.en`, path: '' });
  deepMerge(hi, hiFrag, { fragment: `${base}.hi`, path: '' });
  added += enKeys.length;
  console.log(`  ✓ ${base}: ${enKeys.length} keys (en+hi)`);
}

if (checkOnly) {
  console.log(`--check: ${fragmentBases.length} fragments valid, ${added} keys ready to merge.`);
  process.exit(0);
}

fs.writeFileSync(path.join(messagesDir, 'en.json'), JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(path.join(messagesDir, 'hi.json'), JSON.stringify(hi, null, 2) + '\n');
console.log(`Merged ${fragmentBases.length} fragments (${added} keys) into en.json + hi.json.`);
console.log('Fragments left in place — delete messages/fragments/ in the same commit after review.');
