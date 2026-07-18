/**
 * Smart Shaadi — Match feed facets (Phase 7 Sprint G, Unit 7.2)
 * apps/api/src/matchmaking/facets.ts
 *
 * The NRI discovery surfaces narrow an ALREADY-COMPUTED feed rather than issuing
 * a different query. That is deliberate: the ranked feed is cached once per user
 * under `match_feed:{userId}`, and keying the cache per facet combination instead
 * would multiply entries per user and make invalidation guesswork.
 *
 * Facets therefore run in memory, after the cache read and BEFORE pagination —
 * paginating first would page over the unfiltered list and return short or empty
 * pages while `total` claimed otherwise.
 *
 * These are DISPLAY filters, not matching rules. They only ever narrow what a
 * user already had permission to see; they never widen it, and they never
 * substitute for the bilateral hard-filter chain in filters.ts.
 */

import type { MatchFeedItem } from '@smartshaadi/types';

export interface FeedFacets {
  /**
   * Only profiles whose country of residence differs from the viewer's.
   *
   * "NRI" is relative to the viewer, not an absolute property of a profile: to a
   * user in Toronto, the profiles abroad are the Indian ones. Comparing against
   * the viewer's own country is what makes the /nri page mean the same thing for
   * both sides of a cross-border pair.
   */
  nriOnly?: boolean | undefined;
  /** ISO 3166-1 alpha-2 allow-list. Empty/absent means no country restriction. */
  countries?: string[] | undefined;
}

const norm = (c: string | null | undefined): string => c?.trim().toUpperCase() ?? '';

/**
 * Narrow a ranked feed by the NRI facets. Returns the input untouched when no
 * facet is active, so the ordinary feed path costs nothing.
 *
 * @param items       the fully-ranked feed
 * @param facets      parsed query facets
 * @param viewerCountry the viewer's own country of residence (ISO alpha-2)
 */
export function applyFeedFacets(
  items: MatchFeedItem[],
  facets: FeedFacets,
  viewerCountry: string | null | undefined,
): MatchFeedItem[] {
  const wantNriOnly = facets.nriOnly === true;
  const allow = (facets.countries ?? []).map(norm).filter(Boolean);

  if (!wantNriOnly && allow.length === 0) return items;

  const viewer = norm(viewerCountry);

  return items.filter((item) => {
    const country = norm(item.countryOfResidence);

    if (wantNriOnly) {
      // Unknown country → excluded. A profile we cannot place must not be
      // presented as cross-border; showing a domestic profile under an "NRI"
      // heading is the exact defect this facet exists to fix.
      if (!country) return false;
      // Viewer's own country unknown → fall back to "not India", the platform's
      // default residence, rather than dropping everything and rendering an
      // empty page that looks broken.
      if (!viewer) {
        if (country === 'IN') return false;
      } else if (country === viewer) {
        return false;
      }
    }

    if (allow.length > 0 && !allow.includes(country)) return false;

    return true;
  });
}
