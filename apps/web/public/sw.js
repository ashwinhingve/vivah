/**
 * Smart Shaadi Service Worker
 *
 * Strategy — ALLOWLIST. Only provably-public, immutable assets are ever written
 * to the cache. Nothing else is cached, ever: not HTML navigations, not API
 * responses, not "safe-looking" JSON.
 *
 * WHY AN ALLOWLIST, NOT A DENYLIST
 * --------------------------------
 * The obvious design is "cache everything except authenticated responses",
 * detecting auth via `response.headers.has('set-cookie')`. That does not work.
 * `Set-Cookie` is a FORBIDDEN RESPONSE-HEADER NAME in the Fetch spec — the
 * browser never exposes it to JavaScript, not even same-origin. So the check
 * silently returns false for every response, the denylist never fires, and every
 * authenticated page and API payload lands in the cache looking perfectly fine.
 *
 * On a matrimonial platform that is a data breach, not a performance bug: on a
 * shared device (family tablet, internet cafe) user B is served user A's cached
 * matches, profile and chat. A guard that cannot fail closed must not be the
 * thing standing between users and each other's private data.
 *
 * So: we do not try to detect what is unsafe. We enumerate what is safe.
 * Everything outside that list goes straight to the network and is never stored.
 *
 * WHAT THIS STILL DELIVERS (the PWA contract obligation)
 * -----------------------------------------------------
 * - Installable, home-screen launchable (manifest + this SW registering)
 * - Offline capability: the app shell's static assets are cached, and any
 *   navigation that fails offline lands on a branded offline.html rather than
 *   the browser's dinosaur.
 * What it deliberately does NOT deliver is offline access to *personal* data.
 * That is the correct trade for this product.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

/**
 * THE ALLOWLIST. A request may be cached only if it matches one of these.
 *
 * Every entry must be content-addressed or genuinely public — identical for an
 * anonymous visitor and a signed-in user. Next.js emits /_next/static/* with a
 * content hash in the filename, so those are immutable by construction.
 *
 * Do not add a pattern here without asking: "could this response ever differ
 * per user?" If the answer is anything but a confident no, leave it out.
 */
const CACHEABLE_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /\.(?:woff2|ttf|eot|otf)$/,
  /^\/favicon\.ico$/,
  /^\/manifest\.webmanifest$/,
];

function isCacheable(pathname) {
  return CACHEABLE_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Install — precache the offline shell so it is available on the very first
 * network failure, including one that happens before any successful navigation.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

/**
 * Activate — drop caches from previous versions.
 *
 * This also purges any `dynamic-*` cache left behind by an earlier build of this
 * service worker, which used a denylist and could therefore hold authenticated
 * pages. Users who loaded that version keep the poisoned cache until it is
 * explicitly deleted, so this cleanup is a security fix, not just hygiene.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== STATIC_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GETs are ever cacheable, and only same-origin requests are ours to
  // reason about. Anything else falls through to the network untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. Allowlisted static assets → cache-first, and populate on miss.
  if (isCacheable(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Only store complete, successful responses. A 206/opaque/error
          // response cached here would be served back indefinitely.
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // 2. HTML navigation → network-only, offline shell as the failure state.
  //    Never cached: a signed-in page is user-specific by definition.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(OFFLINE_URL)
          .then((cached) => cached || new Response('Offline', { status: 503 })),
      ),
    );
    return;
  }

  // 3. Everything else — including every /api/* call — is network-only with no
  //    cache read and no cache write. There is deliberately no cached fallback
  //    here: serving a stale authenticated payload offline is the exact failure
  //    this worker exists to prevent. Offline means offline.
  //
  //    Returning nothing (no respondWith) lets the browser handle it natively,
  //    which is both simpler and safer than us mediating it.
});
