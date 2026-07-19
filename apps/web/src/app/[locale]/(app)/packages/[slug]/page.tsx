/**
 * Premium package detail — Phase 8, Unit 8.1.
 *
 * The CTA shown here is decided by ASKING THE SERVER (/booking-check), not by
 * reading `isPlaceholder` off the payload and drawing a conclusion in React. If
 * the client decided, the rule would live in two places and could drift; worse,
 * a UI-only rule is not a rule at all, since the API is reachable directly.
 * The server remains the enforcement point either way — this call only chooses
 * which button to draw.
 *
 * When `isPlaceholder` is true, displays an inline notice above the enquiry form
 * explaining that this is preview inventory and that the enquiry path lets the
 * team confirm availability and send a quote. The row is not hidden or otherwise
 * restricted — only clearly labelled so users understand the status.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Check, X, MapPin, Users, Moon, BadgeCheck, CalendarOff } from 'lucide-react';
import type { PremiumPackageDetail } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { Link } from '@/i18n/navigation';
import { formatINR, formatDateIN } from '@/lib/format';
import { EnquiryForm } from './EnquiryForm.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

async function fetchPackage(slug: string): Promise<PremiumPackageDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/packages/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PremiumPackageDetail };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the server whether this package can take money.
 *
 * Returns false for an anonymous visitor too (the endpoint is authenticated),
 * which is the right default: an unauthenticated user cannot book anyway, and
 * the enquiry CTA works for everyone.
 */
async function fetchBookable(id: string): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    if (!token) return false;
    const res = await fetch(`${API_BASE}/api/v1/packages/${id}/booking-check`, {
      method: 'POST',
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await fetchPackage(slug);
  if (!pkg) return { title: 'Not found' };
  return {
    title: `${pkg.title} — ${pkg.destinationCity} | Smart Shaadi`,
    description: pkg.summary ?? undefined,
  };
}

export const dynamic = 'force-dynamic';

export default async function PackageDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations('packages.detail');

  const pkg = await fetchPackage(slug);
  if (!pkg) notFound();

  const bookable = await fetchBookable(pkg.id);

  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <PageTransition>
          <PageHeader
            title={pkg.title}
            subtitle={t('subtitle', { city: pkg.destinationCity, vendor: pkg.vendorName })}
            breadcrumbs={[
              { label: t('breadcrumb.packages'), href: '/packages' },
              { label: pkg.title },
            ]}
          />

          <div className="mt-6 overflow-hidden rounded-2xl border border-gold/25 shadow-card">
            <img
              src={pkg.heroImageUrl ?? '/seed/package-signature.svg'}
              alt=""
              className="aspect-[21/9] w-full object-cover"
            />
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            {/* ── Left: the package itself ── */}
            <div className="lg:col-span-2">
              <dl className="flex flex-wrap gap-x-6 gap-y-3 rounded-2xl border border-gold/25 bg-surface p-4 shadow-card sm:p-6">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-teal" aria-hidden="true" />
                  <dt className="sr-only">{t('city')}</dt>
                  <dd className="text-primary">{pkg.destinationCity}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal" aria-hidden="true" />
                  <dt className="sr-only">{t('capacity')}</dt>
                  <dd className="text-primary">
                    {t('guestRange', { min: pkg.guestCapacityMin, max: pkg.guestCapacityMax })}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="h-5 w-5 text-teal" aria-hidden="true" />
                  <dt className="sr-only">{t('duration')}</dt>
                  <dd className="text-primary">{t('nights', { count: pkg.durationNights })}</dd>
                </div>
                {/* Suppressed for seeded inventory — see PackageCard. The seed
                    marks its venue rows verified so they render realistically,
                    so without this a fictional venue would display a verified
                    claim next to the preview notice contradicting it. */}
                {pkg.vendorVerified && !pkg.isPlaceholder && (
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-5 w-5 text-success" aria-hidden="true" />
                    <dt className="sr-only">{t('verifiedLabel')}</dt>
                    <dd className="text-success">{t('verified')}</dd>
                  </div>
                )}
              </dl>

              {pkg.description && (
                <section className="mt-6">
                  <h2 className="font-heading text-xl text-primary">{t('about')}</h2>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">
                    {pkg.description}
                  </p>
                </section>
              )}

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <section>
                  <h2 className="font-heading text-lg text-primary">{t('included')}</h2>
                  <ul className="mt-3 space-y-2">
                    {pkg.inclusions.map((i) => (
                      <li key={i.id} className="flex gap-2 text-sm text-muted">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        <span>{i.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Exclusions get equal billing, not a footnote — "what you
                    don't get" is where a wedding budget actually goes wrong. */}
                <section>
                  <h2 className="font-heading text-lg text-primary">{t('notIncluded')}</h2>
                  <ul className="mt-3 space-y-2">
                    {pkg.exclusions.map((i) => (
                      <li key={i.id} className="flex gap-2 text-sm text-muted">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                        <span>{i.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {pkg.availability.length > 0 && (
                <section className="mt-8">
                  <h2 className="font-heading text-lg text-primary">{t('unavailable')}</h2>
                  <ul className="mt-3 space-y-2">
                    {pkg.availability.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm"
                      >
                        <CalendarOff className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                        <span className="text-primary">
                          {formatDateIN(a.blockedFrom)} — {formatDateIN(a.blockedTo)}
                        </span>
                        {a.reason && <span className="text-muted">· {a.reason}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* ── Right: price + CTA ── */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-gold/25 bg-surface p-4 shadow-card sm:p-6">
                <p className="text-xs uppercase tracking-wide text-gold-muted">
                  {t('startingFrom')}
                </p>
                <p className="font-heading text-3xl text-primary">{formatINR(pkg.priceFrom)}</p>
                <p className="mt-1 text-sm text-muted">{t('priceNote')}</p>

                {pkg.isPlaceholder && (
                  <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
                    <p className="font-semibold text-warning">{t('placeholderTitle')}</p>
                    <p className="mt-1">{t('placeholderNotice')}</p>
                  </div>
                )}

                <div className={pkg.isPlaceholder ? 'mt-4' : 'mt-6'}>
                  <EnquiryForm packageId={pkg.id} bookable={bookable} />
                </div>

                <Link
                  href={`/vendors/${pkg.vendorId}`}
                  className="mt-4 block text-center text-sm text-teal hover:underline"
                >
                  {t('viewVenue', { vendor: pkg.vendorName })}
                </Link>
              </div>
            </aside>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
