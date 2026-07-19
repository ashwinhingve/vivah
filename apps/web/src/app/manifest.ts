import type { MetadataRoute } from 'next';

// Every URL here is deliberately root-relative — see the note on `shortcuts`
// below. That leaves no need for an absolute site origin in this file.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smart Shaadi — India\'s Smart Marriage Ecosystem',
    short_name: 'Smart Shaadi',
    description:
      'Find your life partner with Smart Shaadi — AI-powered matchmaking, Guna Milan compatibility, and complete wedding planning in one platform.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FEFAF6',
    theme_color: '#7B2D42',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // No `screenshots` entry: the richer install UI it unlocks needs real
    // captured PNGs, and pointing at a file we have not produced yields a 404
    // in the install prompt. Add it back alongside actual screenshots.
    categories: ['lifestyle'],
    // Shortcut URLs are locale-agnostic on purpose. `localePrefix: 'as-needed'`
    // leaves the default locale unprefixed, so `/matches` resolves for English
    // and next-intl's middleware redirects a Hindi user onward. Hard-coding
    // `/en/...` here would break exactly half the install base.
    shortcuts: [
      {
        name: 'Browse Matches',
        short_name: 'Matches',
        description: 'View AI-powered match recommendations',
        url: '/matches?utm_source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Messages',
        short_name: 'Chats',
        description: 'Continue your conversations',
        url: '/chats?utm_source=pwa_shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
