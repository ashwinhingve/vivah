import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Playfair_Display, Noto_Serif_Devanagari } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { PostHogProvider } from '@/components/providers/PostHogProvider.client';
import { DemoPill } from '@/components/shared/DemoPill';
// Validates NEXT_PUBLIC_* on first server render — bad deploy fails fast.
import '@/lib/env';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const notoDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '600'],
  variable: '--font-hindi',
  display: 'swap',
  preload: false,
});

// Single source of truth for the public origin — reused by sitemap.ts + robots.ts.
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://smartshaadi.co.in';

export const metadata: Metadata = {
  // Makes every relative OG/Twitter image + canonical resolve to an absolute URL.
  metadataBase: new URL(SITE_URL),
  title: {
    default:  "Smart Shaadi — India's Smart Marriage Ecosystem",
    template: '%s | Smart Shaadi',
  },
  description:
    'Find your life partner with Smart Shaadi — AI-powered matchmaking, Guna Milan compatibility, and complete wedding planning in one platform.',
  keywords: ['matrimonial', 'shaadi', 'marriage', 'Indian wedding', 'matchmaking'],
  authors:  [{ name: 'Smart Shaadi' }],
  // Indexable by default; private routes (profile/feed/auth/dashboard) re-apply
  // `robots: { index: false }` in their own generateMetadata.
  robots:   { index: true, follow: true },
  openGraph: {
    siteName: 'Smart Shaadi',
    type: 'website',
    images: [{ url: '/og-default.svg', width: 1200, height: 630, alt: 'Smart Shaadi' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-default.svg'],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${notoDevanagari.variable}`}>
      <body className="bg-background text-foreground antialiased overflow-x-clip font-body">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1000] focus:rounded focus:bg-foreground focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <PostHogProvider>
          <ToastProvider>
            {children}
            <DemoPill />
          </ToastProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
