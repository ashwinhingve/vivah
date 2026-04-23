// Post-tsc: Node ESM strict resolver requires explicit .js extensions on
// relative imports. Source keeps bare paths (./auth, ./schema/index) so that
// drizzle-kit's CJS-based loader can resolve them to .ts files at runtime.
// This script rewrites compiled dist/ to add .js extensions so Node ESM
// production containers can load the module.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');

const IMPORT_REGEX = /((?:from|import)\s+['"])(\.\.?\/[^'"]+?)(['"])/g;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (full.endsWith('.js') || full.endsWith('.d.ts')) {
      patch(full);
    }
  }
}

function patch(file) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(IMPORT_REGEX, (_m, pre, spec, post) => {
    if (spec.endsWith('.js') || spec.endsWith('.json') || spec.endsWith('.mjs') || spec.endsWith('.cjs')) {
      return `${pre}${spec}${post}`;
    }
    return `${pre}${spec}.js${post}`;
  });
  if (out !== src) writeFileSync(file, out);
}

walk(DIST);
