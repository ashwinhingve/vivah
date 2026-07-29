/**
 * @smartshaadi/content — types for the committed website-content snapshot.
 *
 * A ContentDoc is one public page's worth of readable text, extracted from
 * apps/web sources (i18n messages, seo-data.ts) by scripts/generate.ts and
 * committed to src/snapshots.generated.ts. The apps/api knowledge indexer
 * chunks + embeds these docs into the knowledge_chunks table (RAG).
 *
 * This indirection exists because the api's Docker image never contains
 * apps/web files — the snapshot must travel as a committed package.
 */

export type ContentSourceType =
  | 'i18n_page'
  | 'seo_page'
  | 'faq'
  | 'legal'
  | 'plan_pricing';

export interface ContentDoc {
  sourceType: ContentSourceType;
  /** Stable id within sourceType (e.g. 'home', 'privacy', seo slug). */
  sourceId: string;
  locale: 'en' | 'hi';
  title: string;
  /** Canonical site URL (locale-prefixed for hi) — used for citations. */
  url: string;
  /** Readable plain-text body (headings + copy, no JSON syntax). */
  body: string;
}
