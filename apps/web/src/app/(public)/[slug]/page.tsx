import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  resolveSlug,
  allSlugs,
  type PageKind,
} from '@/lib/seo-data';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://smartshaadi.in';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return allSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false; // 404 anything outside generateStaticParams
export const revalidate = 86_400;   // refresh static cache daily

function buildMeta(page: PageKind): { title: string; description: string; h1: string; canonicalPath: string } {
  switch (page.kind) {
    case 'community': {
      const c = page.data;
      return {
        title:         `${c.label} Matrimony — Find ${c.label} Brides & Grooms | Smart Shaadi`,
        description:   `${c.label} matrimonial matchmaking with AI compatibility, Guna Milan scoring, and verified ${c.label} families across India. Join Smart Shaadi.`,
        h1:            `${c.label} Matrimony — AI-Powered Matchmaking for ${c.label} Families`,
        canonicalPath: `/${c.slug}-matrimony`,
      };
    }
    case 'city': {
      const c = page.data;
      return {
        title:         `Marriages in ${c.label} — ${c.label} Matrimonial | Smart Shaadi`,
        description:   `Find your life partner in ${c.label}, ${c.state}. AI matchmaking, Guna Milan, and verified ${c.label} families. Join Smart Shaadi today.`,
        h1:            `Marriages in ${c.label} — ${c.state} Matrimonial Matchmaking`,
        canonicalPath: `/marriages-in-${c.slug}`,
      };
    }
    case 'caste': {
      const c = page.data;
      return {
        title:         `${c.label} Marriage Bureau — ${c.label} Matrimony | Smart Shaadi`,
        description:   `${c.label} marriage bureau with AI matchmaking, gotra-exogamy filters, and verified ${c.label} families across India. Join Smart Shaadi.`,
        h1:            `${c.label} Marriage Bureau — AI-Powered ${c.label} Matrimonial`,
        canonicalPath: `/${c.slug}-marriage-bureau`,
      };
    }
  }
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const page = resolveSlug(slug);
  if (!page) return { title: 'Not found' };

  const m = buildMeta(page);
  const canonical = `${SITE_URL}${m.canonicalPath}`;

  return {
    title:       m.title,
    description: m.description,
    alternates:  { canonical },
    openGraph: {
      title:       m.title,
      description: m.description,
      url:         canonical,
      type:        'website',
      siteName:    'Smart Shaadi',
    },
    twitter: {
      card:        'summary_large_image',
      title:       m.title,
      description: m.description,
    },
  };
}

function buildJsonLd(page: PageKind, meta: ReturnType<typeof buildMeta>): unknown[] {
  const canonical = `${SITE_URL}${meta.canonicalPath}`;
  const serviceType =
    page.kind === 'community' ? `${page.data.label} Matrimony`
  : page.kind === 'city'      ? `Matrimonial in ${page.data.label}`
  :                              `${page.data.label} Marriage Bureau`;

  const breadcrumbName =
    page.kind === 'community' ? `${page.data.label} Matrimony`
  : page.kind === 'city'      ? `Marriages in ${page.data.label}`
  :                              `${page.data.label} Marriage Bureau`;

  return [
    {
      '@context': 'https://schema.org',
      '@type':    'Organization',
      name:       'Smart Shaadi',
      url:        SITE_URL,
      logo:       `${SITE_URL}/logo.png`,
    },
    {
      '@context':     'https://schema.org',
      '@type':        'Service',
      serviceType,
      provider:       { '@type': 'Organization', name: 'Smart Shaadi', url: SITE_URL },
      areaServed:     page.kind === 'city' ? { '@type': 'City', name: page.data.label } : { '@type': 'Country', name: 'India' },
      description:    meta.description,
      url:            canonical,
    },
    {
      '@context':        'https://schema.org',
      '@type':           'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home',         item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: breadcrumbName, item: canonical },
      ],
    },
  ];
}

export default async function ProgrammaticSeoPage({ params }: RouteParams) {
  const { slug } = await params;
  const page = resolveSlug(slug);
  if (!page) notFound();

  const meta = buildMeta(page);
  const jsonLd = buildJsonLd(page, meta);
  const highlights = page.data.highlights;
  const description = page.data.description;
  const label = page.data.label;

  const subhead =
    page.kind === 'community' ? `Trusted by ${label} families across India for AI-powered, Guna Milan-compatible matchmaking.`
  : page.kind === 'city'      ? `Connecting families in ${label}, ${page.data.state} — verified profiles, AI compatibility, family-first.`
  :                              `India's modern ${label} marriage bureau — AI matchmaking with strict gotra and community filters.`;

  return (
    <>
      {jsonLd.map((schema, idx) => (
        <script key={`jsonld-${idx}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}

      <main className="mx-auto max-w-4xl px-4 py-12">
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">›</span>
          <span>{meta.h1.split(' — ')[0]}</span>
        </nav>

        <h1 className="mb-4 text-3xl font-bold text-primary md:text-4xl">{meta.h1}</h1>
        <p className="mb-8 text-lg text-muted-foreground">{subhead}</p>

        <section className="mb-10 rounded-xl border border-gold/40 bg-surface p-6 shadow-card">
          <h2 className="mb-3 text-xl font-semibold text-primary">About this matchmaking</h2>
          <p className="text-foreground">{description}</p>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-primary">Why Smart Shaadi</h2>
          <ul className="space-y-2">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-foreground">
                <span className="mt-1 text-success">✓</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-primary">How it works</h2>
          <ol className="list-decimal space-y-2 pl-6 text-foreground">
            <li>Create a verified profile in under 5 minutes — phone + photo + KYC.</li>
            <li>Get AI-curated matches based on Guna Milan, lifestyle, and family fit.</li>
            <li>Connect with introductions reviewed and approved by your family.</li>
            <li>Move from chat to meeting with vetted profiles and full privacy controls.</li>
          </ol>
        </section>

        <section className="mb-10 rounded-xl bg-gold/10 p-8 text-center">
          <h2 className="mb-3 text-2xl font-bold text-primary">Start your search today</h2>
          <p className="mb-6 text-foreground">
            Join thousands of verified families on Smart Shaadi — privacy-first, AI-powered, tradition-respecting.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="rounded-lg bg-teal px-6 py-3 font-semibold text-white shadow-card hover:bg-teal/90"
            >
              Find your match — sign up
            </Link>
            <Link
              href="/feed"
              className="rounded-lg border border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-white"
            >
              Browse profiles
            </Link>
          </div>
        </section>

        <section className="text-sm text-muted-foreground">
          <p>
            Smart Shaadi is India&apos;s AI-powered matrimonial platform — family-trusted, privacy-first, and built for
            modern Indian families. Every profile is verified and every introduction respects your traditions.
          </p>
        </section>
      </main>
    </>
  );
}
