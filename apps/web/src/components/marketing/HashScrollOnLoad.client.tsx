'use client';

import { useEffect } from 'react';

/**
 * Scrolls to location.hash after mount. Covers client-side navigations from
 * other routes to `/#section` (nav dropdown anchor rows): Next's built-in hash
 * scroll can fire before the marketing sections have mounted, landing the user
 * at the top of the page. Same-page hash clicks are unaffected (native).
 */
export function HashScrollOnLoad() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    // Double rAF: let in-view animations/layout settle before measuring.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return null;
}
