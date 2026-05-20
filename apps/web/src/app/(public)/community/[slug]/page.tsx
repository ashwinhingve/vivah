/**
 * /community/marriages-in-[city] — public city-targeted SEO landing pages.
 *
 * Statically generated for the 20 highest-priority Indian cities.
 * Any slug outside that list 404s (dynamicParams = false).
 *
 * This route is *outside* the `(app)` auth group → no session required.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://smartshaadi.in';

interface CityEntry {
  city: string; // canonical display name
  state: string;
  blurb: string;
}

/** 20 highest-priority Indian cities — keep ordered for stable static-gen. */
const CITIES: Record<string, CityEntry> = {
  bhopal: { city: 'Bhopal', state: 'Madhya Pradesh', blurb: 'the City of Lakes' },
  indore: { city: 'Indore', state: 'Madhya Pradesh', blurb: 'the commercial capital of MP' },
  pune: { city: 'Pune', state: 'Maharashtra', blurb: "Maharashtra's cultural heart" },
  mumbai: { city: 'Mumbai', state: 'Maharashtra', blurb: "India's financial capital" },
  delhi: { city: 'Delhi', state: 'Delhi NCR', blurb: 'the national capital' },
  bangalore: { city: 'Bangalore', state: 'Karnataka', blurb: "India's Silicon Valley" },
  hyderabad: { city: 'Hyderabad', state: 'Telangana', blurb: 'the City of Pearls' },
  chennai: { city: 'Chennai', state: 'Tamil Nadu', blurb: 'the gateway to South India' },
  kolkata: { city: 'Kolkata', state: 'West Bengal', blurb: 'the cultural capital of the East' },
  ahmedabad: { city: 'Ahmedabad', state: 'Gujarat', blurb: "Gujarat's largest city" },
  jaipur: { city: 'Jaipur', state: 'Rajasthan', blurb: 'the Pink City' },
  surat: { city: 'Surat', state: 'Gujarat', blurb: 'the diamond and textile hub' },
  lucknow: { city: 'Lucknow', state: 'Uttar Pradesh', blurb: 'the City of Nawabs' },
  nagpur: { city: 'Nagpur', state: 'Maharashtra', blurb: 'the Orange City' },
  visakhapatnam: { city: 'Visakhapatnam', state: 'Andhra Pradesh', blurb: 'the City of Destiny' },
  patna: { city: 'Patna', state: 'Bihar', blurb: 'the historic capital of Bihar' },
  vadodara: { city: 'Vadodara', state: 'Gujarat', blurb: 'the cultural capital of Gujarat' },
  ludhiana: { city: 'Ludhiana', state: 'Punjab', blurb: "Punjab's industrial hub" },
  agra: { city: 'Agra', state: 'Uttar Pradesh', blurb: 'home of the Taj Mahal' },
  nashik: { city: 'Nashik', state: 'Maharashtra', blurb: 'the wine capital of India' },
};

const CITY_SLUGS = Object.keys(CITIES);

function parseSlug(slug: string): { entry: CityEntry; key: string } | null {
  const prefix = 'marriages-in-';
  if (!slug.startsWith(prefix)) return null;
  const key = slug.slice(prefix.length);
  const entry = CITIES[key];
  return entry ? { entry, key } : null;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return CITY_SLUGS.map((key) => ({ slug: `marriages-in-${key}` }));
}

export const dynamicParams = false;
export const revalidate = 86_400;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const match = parseSlug(slug);
  if (!match) return { title: 'Not found' };
  const { entry } = match;

  const title = `Marriages in ${entry.city} — ${entry.city} Matrimony | Smart Shaadi`;
  const description = `Find your life partner in ${entry.city}, ${entry.state}. AI matchmaking, Guna Milan compatibility, and verified ${entry.city} families. Join Smart Shaadi today.`;
  const canonical = `${SITE_URL}/community/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Smart Shaadi',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CommunityCityPage({ params }: RouteParams) {
  const { slug } = await params;
  const match = parseSlug(slug);
  if (!match) notFound();
  const { entry } = match;
  const canonical = `${SITE_URL}/community/${slug}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Smart Shaadi',
      url: SITE_URL,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `Matrimonial in ${entry.city}`,
      provider: { '@type': 'Organization', name: 'Smart Shaadi' },
      areaServed: { '@type': 'City', name: entry.city, containedInPlace: entry.state },
      url: canonical,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Community', item: `${SITE_URL}/community` },
        { '@type': 'ListItem', position: 3, name: `Marriages in ${entry.city}`, item: canonical },
      ],
    },
  ];

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Script
        id={`ld-community-${match.key}`}
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify(jsonLd)}
      </Script>

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span aria-hidden> / </span>
        <span>Community</span>
        <span aria-hidden> / </span>
        <span className="text-text-primary">Marriages in {entry.city}</span>
      </nav>

      <h1 className="font-heading text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
        Marriages in {entry.city}
      </h1>
      <p className="mt-2 text-sm text-text-muted">{entry.state}</p>

      <p className="mt-6 text-base leading-relaxed text-text-primary">
        Smart Shaadi helps families across {entry.city} — {entry.blurb} — find compatible
        life partners with AI-powered matchmaking, Guna Milan compatibility scoring, and a
        verified profile network. Browse {entry.city} brides and grooms, filter by community,
        caste, and education, and start meaningful conversations with families that share your
        values.
      </p>

      <p className="mt-4 text-base leading-relaxed text-text-primary">
        Every profile is identity-verified. Our reciprocal matching engine surfaces only
        profiles where the interest is mutual, so your time goes to the matches that
        actually matter.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Register free
        </Link>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-gold/30 bg-surface px-5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-muted"
        >
          Sign in
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="font-heading text-xl font-semibold text-primary">
          Why families in {entry.city} choose Smart Shaadi
        </h2>
        <ul className="mt-4 space-y-2 text-sm text-text-primary">
          <li>• AI compatibility scoring across personality, lifestyle, and family values</li>
          <li>• Vedic Guna Milan with all 8 Ashtakoot factors</li>
          <li>• Verified identity for every profile — no fakes, no spam</li>
          <li>• Reciprocal matching — you only see profiles interested in you</li>
          <li>• Free to browse, free to start conversations</li>
        </ul>
      </section>

      <section className="mt-12 border-t border-gold/20 pt-8">
        <h2 className="font-heading text-base font-semibold text-primary">
          Explore other cities
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {CITY_SLUGS.filter((k) => k !== match.key).map((k) => (
            <li key={k}>
              <Link
                href={`/community/marriages-in-${k}`}
                className="text-teal transition-colors hover:text-teal-hover"
              >
                Marriages in {CITIES[k]!.city}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
