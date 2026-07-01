import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';

export const metadata: Metadata = {
  title: "Smart Shaadi — India's AI Matrimonial Platform",
  description:
    'Find your life partner with AI-powered compatibility matching, ' +
    'Guna Milan scoring, and family-first privacy. ' +
    'Join verified Indian families on Smart Shaadi.',
  keywords:
    'matrimonial, indian marriage, guna milan, kundli matching, ' +
    'shaadi, vivah, arranged marriage, AI matchmaking, family matrimony',
  openGraph: {
    title: 'Smart Shaadi — Find Your Life Partner',
    description:
      'AI-powered Indian matrimonial platform. Family-trusted, ' +
      'privacy-first, Guna Milan compatible.',
    type: 'website',
  },
};

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://smartshaadi.co.in';

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Smart Shaadi',
  description: "India's AI-powered matrimonial platform",
  url: SITE_URL,
  foundingDate: '2026',
  sameAs: [],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Smart Shaadi',
  url: SITE_URL,
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script
        id="jsonld-organization"
        type="application/ld+json"
        strategy="beforeInteractive"
      >
        {JSON.stringify(organizationSchema)}
      </Script>
      <Script
        id="jsonld-website"
        type="application/ld+json"
        strategy="beforeInteractive"
      >
        {JSON.stringify(websiteSchema)}
      </Script>
      {/* Skip link is rendered once by the root layout (app/layout.tsx) —
          a second one here would duplicate the landmark for marketing routes. */}
      {children}
    </>
  );
}
