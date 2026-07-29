/**
 * Snapshot generator — extracts public website content from apps/web sources
 * into src/snapshots.generated.ts (committed).
 *
 * Sources:
 *   - apps/web/messages/{en,hi}.json  → curated content namespaces (marketing,
 *     pricing, planCatalog, help, legal, trust) flattened to readable text
 *   - apps/web/src/lib/seo-data.ts    → the 22 programmatic SEO landing pages
 *
 * Run:   pnpm --filter @smartshaadi/content generate
 * Check: pnpm --filter @smartshaadi/content lint   (fails when stale)
 *
 * Runs in dev/CI only (full monorepo checkout) — never inside the api Docker
 * image, which is exactly why the output is committed.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Community, City, Caste } from '../../../apps/web/src/lib/seo-data';
import type { ContentDoc, ContentSourceType } from '../src/types';

// apps/web is not "type: module", so tsx treats seo-data.ts as CJS — a static
// ESM named import fails interop. createRequire loads it reliably under tsx.
const cjsRequire = createRequire(import.meta.url);
const { COMMUNITIES, CITIES, CASTES } = cjsRequire('../../../apps/web/src/lib/seo-data') as {
  COMMUNITIES: Community[]; CITIES: City[]; CASTES: Caste[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const OUT_PATH = resolve(__dirname, '..', 'src', 'snapshots.generated.ts');

type Messages = Record<string, unknown>;

// ── i18n flattening ──────────────────────────────────────────────────────────

/** Keys whose leaf strings are always content, even when short. */
const CONTENT_KEY_RE = /(^q$|^a$|question|answer|title|heading|description|body|subtitle|label$)/i;
/** Minimum length for a leaf string to count as content under other keys. */
const MIN_CONTENT_CHARS = 25;

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function cleanValue(value: string): string {
  return value
    .replace(/\{[^}]*\}/g, '') // strip ICU placeholders
    .replace(/<[^>]*>/g, ' ')  // strip inline rich-text tags
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Walk a message subtree and emit "Heading: text" lines for content-bearing
 * leaf strings, skipping short UI chrome (button labels, tooltips).
 */
function flattenMessages(node: unknown, path: string[] = [], lines: string[] = []): string[] {
  if (typeof node === 'string') {
    const key = path[path.length - 1] ?? '';
    const cleaned = cleanValue(node);
    if (!cleaned) return lines;
    if (cleaned.length >= MIN_CONTENT_CHARS || CONTENT_KEY_RE.test(key)) {
      const heading = path.slice(-2).map(humanizeKey).join(' — ');
      lines.push(heading ? `${heading}: ${cleaned}` : cleaned);
    }
    return lines;
  }
  if (Array.isArray(node)) {
    for (const item of node) flattenMessages(item, path, lines);
    return lines;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flattenMessages(value, [...path, key], lines);
    }
  }
  return lines;
}

// ── Curated i18n page map ────────────────────────────────────────────────────

interface I18nPageDef {
  sourceType: ContentSourceType;
  sourceId: string;
  title: string;
  url: string;
  pick: (m: Messages) => unknown;
}

function omit(obj: unknown, keys: string[]): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out;
}

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

const I18N_PAGES: I18nPageDef[] = [
  {
    sourceType: 'i18n_page', sourceId: 'home',
    title: 'Smart Shaadi — Matrimony & Wedding Platform', url: '/',
    pick: (m) => omit(m.marketing, ['about', 'navbar', 'footer']),
  },
  {
    sourceType: 'i18n_page', sourceId: 'about',
    title: 'About Smart Shaadi', url: '/about',
    pick: (m) => get(m, ['marketing', 'about']),
  },
  {
    sourceType: 'plan_pricing', sourceId: 'pricing',
    title: 'Smart Shaadi Pricing & Plans', url: '/#pricing',
    pick: (m) => m.pricing,
  },
  {
    sourceType: 'plan_pricing', sourceId: 'plan-catalog',
    title: 'Smart Shaadi Subscription Plans & Benefits', url: '/settings/billing',
    pick: (m) => m.planCatalog,
  },
  {
    sourceType: 'faq', sourceId: 'help',
    title: 'Help Center & FAQ', url: '/help',
    pick: (m) => m.help,
  },
  {
    sourceType: 'legal', sourceId: 'privacy',
    title: 'Privacy Policy', url: '/privacy',
    pick: (m) => get(m, ['legal', 'privacy']),
  },
  {
    sourceType: 'legal', sourceId: 'terms',
    title: 'Terms of Service', url: '/terms',
    pick: (m) => get(m, ['legal', 'terms']),
  },
  {
    sourceType: 'legal', sourceId: 'refund-policy',
    title: 'Refund Policy', url: '/refund-policy',
    pick: (m) => get(m, ['legal', 'refundPolicy']),
  },
  {
    sourceType: 'legal', sourceId: 'cookie-policy',
    title: 'Cookie Policy', url: '/cookie-policy',
    pick: (m) => get(m, ['legal', 'cookiePolicy']),
  },
  {
    sourceType: 'i18n_page', sourceId: 'trust-safety',
    title: 'Trust, Safety & Verification', url: '/',
    pick: (m) => m.trust,
  },
];

function buildI18nDocs(locale: 'en' | 'hi'): ContentDoc[] {
  const raw = readFileSync(resolve(REPO_ROOT, 'apps', 'web', 'messages', `${locale}.json`), 'utf8');
  const messages = JSON.parse(raw) as Messages;
  const prefix = locale === 'hi' ? '/hi' : '';
  const docs: ContentDoc[] = [];

  for (const def of I18N_PAGES) {
    const subtree = def.pick(messages);
    if (!subtree) continue;
    const body = flattenMessages(subtree).join('\n');
    if (body.length < 100) continue; // nothing meaningful in this locale
    docs.push({
      sourceType: def.sourceType,
      sourceId: def.sourceId,
      locale,
      title: def.title,
      url: `${prefix}${def.url}` || '/',
      body,
    });
  }
  return docs;
}

// ── SEO landing pages (en only — seo-data.ts is English copy) ────────────────

function buildSeoDocs(): ContentDoc[] {
  const docs: ContentDoc[] = [];
  const push = (sourceId: string, title: string, url: string, description: string, highlights: string[], extra = '') => {
    docs.push({
      sourceType: 'seo_page',
      sourceId,
      locale: 'en',
      title,
      url,
      body: [description, extra, ...highlights.map((h) => `• ${h}`)].filter(Boolean).join('\n'),
    });
  };

  for (const c of COMMUNITIES) {
    push(`community-${c.slug}`, `${c.label} Matrimony — Smart Shaadi`, `/${c.slug}-matrimony`, c.description, c.highlights);
  }
  for (const c of CITIES) {
    push(`city-${c.slug}`, `Marriages in ${c.label} — Smart Shaadi`, `/marriages-in-${c.slug}`, c.description, c.highlights, `City: ${c.label}, ${c.state}.`);
  }
  for (const c of CASTES) {
    push(`caste-${c.slug}`, `${c.label} Marriage Bureau — Smart Shaadi`, `/${c.slug}-marriage-bureau`, c.description, c.highlights);
  }
  return docs;
}

// ── Emit ─────────────────────────────────────────────────────────────────────

export function buildSnapshotSource(): string {
  const docs: ContentDoc[] = [
    ...buildI18nDocs('en'),
    ...buildI18nDocs('hi'),
    ...buildSeoDocs(),
  ];

  const header = [
    '// AUTO-GENERATED by scripts/generate.ts — DO NOT EDIT BY HAND.',
    '// Regenerate: pnpm --filter @smartshaadi/content generate',
    "import type { ContentDoc } from './types.js';",
    '',
    'export const CONTENT_DOCS: ContentDoc[] =',
  ].join('\n');

  return `${header} ${JSON.stringify(docs, null, 2)};\n`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const source = buildSnapshotSource();
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, source, 'utf8');
  const count = (source.match(/"sourceId"/g) ?? []).length;
  console.log(`✅ wrote ${OUT_PATH} (${count} docs, ${(source.length / 1024).toFixed(0)} KB)`);
}
