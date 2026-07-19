'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registrar
 *
 * Registers the hand-rolled SW (public/sw.js) for PWA functionality.
 * Runs only in the browser, after hydration.
 *
 * Logs errors to console for debugging; does not throw or crash the app
 * if SW registration fails (PWA is a nice-to-have enhancement).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Only run in browser with SW support
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Production only. A service worker in dev caches the app shell and then
    // serves it back after you have edited the source, which reads as "my
    // change did nothing" and costs an hour before anyone suspects the SW.
    // Nothing about the PWA needs proving on localhost.
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    async function registerServiceWorker() {
      try {
        // scope '/' matches the manifest: `localePrefix: 'as-needed'` leaves the
        // default locale unprefixed, so a '/en/' scope would miss half the routes.
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A newer worker is waiting. The app layer can listen for this to
              // offer a reload; we deliberately do not force one mid-session.
              window.dispatchEvent(new CustomEvent('sw-updated'));
            }
          });
        });
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error instanceof Error ? error.message : String(error));
      }
    }

    // Register after a slight delay to avoid race with hydration
    const timer = setTimeout(() => {
      registerServiceWorker();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // This component renders nothing; it's purely a side-effect handler
  return null;
}
