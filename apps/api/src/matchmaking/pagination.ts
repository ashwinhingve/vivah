/**
 * Smart Shaadi — Matchmaking feed pagination
 *
 * The match feed is computed/cached as one fully-ranked array. The /feed route
 * slices it to the caller's requested window with this helper.
 */

/**
 * Slice a fully-ranked feed array to a single page. `total` is the full ranked
 * length (for page-count math); `slice` is the requested window. Pure + framework
 * free so the pagination contract can be unit-tested without the express route.
 */
export function sliceFeedPage<T>(full: T[], page: number, limit: number): { slice: T[]; total: number } {
  const start = (page - 1) * limit;
  return { slice: full.slice(start, start + limit), total: full.length };
}
