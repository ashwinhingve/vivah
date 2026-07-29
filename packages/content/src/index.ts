/**
 * @smartshaadi/content — committed snapshot of public website content.
 *
 * Consumed by apps/api's knowledge indexer (RAG). Regenerate after editing
 * apps/web/messages/en.json, hi.json, or src/lib/seo-data.ts:
 *
 *   pnpm --filter @smartshaadi/content generate
 *
 * CI runs `lint` (scripts/check.ts) which fails when the snapshot is stale.
 */

export type { ContentDoc, ContentSourceType } from './types.js';
export { CONTENT_DOCS } from './snapshots.generated.js';

import { CONTENT_DOCS } from './snapshots.generated.js';
import type { ContentDoc } from './types.js';

/** All snapshot docs, optionally filtered by locale. */
export function loadContentDocs(locale?: 'en' | 'hi'): ContentDoc[] {
  if (!locale) return CONTENT_DOCS;
  return CONTENT_DOCS.filter((d) => d.locale === locale);
}
