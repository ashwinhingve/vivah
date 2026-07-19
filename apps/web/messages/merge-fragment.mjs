#!/usr/bin/env node
/**
 * Deep-merges an i18n fragment into en.json / hi.json.
 *
 * The repo's fragment convention existed (messages/fragments/pkg-*.json) but the
 * merge was being done by hand, which is why two sprints editing the message
 * files at once kept colliding. This makes it mechanical and idempotent.
 *
 *   node messages/merge-fragment.mjs pkg-phase8-supply
 *
 * Rules:
 *   * ADDITIVE ONLY. An existing key is never overwritten — if the target
 *     already has a different value, that is reported and left alone. A merge
 *     that silently replaced another sprint's copy would be worse than a
 *     conflict, because nobody would notice.
 *   * Idempotent: re-running reports 0 added and changes nothing.
 *   * EXISTING KEY ORDER IS PRESERVED and new keys are appended. An earlier
 *     version sorted the whole file on write, which produced a 4,800-line
 *     reordering diff and would have conflicted with every concurrent edit to
 *     en.json. A merge tool must not rewrite lines it was not asked to touch.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];

if (!name) {
  console.error('usage: node merge-fragment.mjs <fragment-name-without-locale>');
  process.exit(1);
}

let totalAdded = 0;
let totalConflicts = 0;

for (const locale of ['en', 'hi']) {
  const fragmentPath = join(HERE, 'fragments', `${name}.${locale}.json`);
  const targetPath = join(HERE, `${locale}.json`);

  if (!existsSync(fragmentPath)) {
    console.error(`  ✗ missing fragment: ${fragmentPath}`);
    process.exit(1);
  }

  const fragment = JSON.parse(readFileSync(fragmentPath, 'utf8'));
  const target = JSON.parse(readFileSync(targetPath, 'utf8'));

  let added = 0;
  const conflicts = [];

  /** Recursive additive merge. Returns nothing; mutates `dst`. */
  function merge(dst, src, path = []) {
    for (const [key, value] of Object.entries(src)) {
      const here = [...path, key];
      const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

      if (!(key in dst)) {
        dst[key] = value;
        // Count leaves, not branches — "added 1 object" is not useful output.
        added += isObject(value) ? countLeaves(value) : 1;
        continue;
      }

      if (isObject(dst[key]) && isObject(value)) {
        merge(dst[key], value, here);
        continue;
      }

      if (dst[key] !== value) conflicts.push(here.join('.'));
    }
  }

  function countLeaves(obj) {
    let n = 0;
    for (const v of Object.values(obj)) {
      n += (v !== null && typeof v === 'object' && !Array.isArray(v)) ? countLeaves(v) : 1;
    }
    return n;
  }

  merge(target, fragment);
  // No sorting: JSON.stringify preserves insertion order, so existing keys keep
  // their positions and only the appended ones show up in the diff.
  writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`, 'utf8');

  totalAdded += added;
  totalConflicts += conflicts.length;
  console.log(`  ${locale}: +${added} keys${conflicts.length ? `, ${conflicts.length} left unchanged (already present with a different value)` : ''}`);
  for (const c of conflicts) console.log(`      kept existing: ${c}`);
}

console.log(`\n${totalAdded} keys added, ${totalConflicts} existing values preserved.`);
