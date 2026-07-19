/**
 * Post-marriage service detail — Phase 8, Unit 8.2.
 *
 * No booking-check here, unlike the 8.1 detail page: every service in this unit
 * converts through an enquiry, so there is no money path for `is_placeholder`
 * to gate and no CTA decision to ask the server about.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MapPin, Globe, Star } from 'lucide-react';
import type { PostMarriageServiceDetail } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { Link } from '@/i18n/navigation';
import { formatINR } from '@/lib/format';
import { ServiceEnquiryForm } from './ServiceEnquiryForm.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

async function fetchService(slug: string): Promise<PostMarriageServiceDetail | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/post-marriage/services/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PostMarriageServiceDetail };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const svc = await fetchService(slug);
  if (!svc) return { title: 'Not found' };
  return {
    title: `${svc.title} — ${svc.partnerName} | Smart Shaadi`,
    description: svc.description ?? undefined,
  };
}

export const dynamic = 'force-dynamic';

export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations('postMarriage.detail');
  const tCard = await getTranslations('postMarriage.card');

  const svc = await fetchService(slug);
  if (!svc) notFound();

  const unitSuffix = tCard(`priceUnit.${svc.priceUnit}`);
  const priceLabel =
    svc.priceUnit === 'QUOTE' || svc.priceFrom === null
      ? tCard('onRequest')
      : svc.priceTo && svc.priceTo !== svc.priceFrom
        ? `${formatINR(svc.priceFrom)} – ${formatINR(svc.priceTo)}`
        : formatINR(svc.priceFrom);

  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <PageTransition>
          <PageHeader
            title={svc.title}
            subtitle={t('subtitle', { partner: svc.partnerName, category: svc.categoryName })}
            breadcrumbs={[
              { label: t('breadcrumb.services'), href: '/services/post-marriage' },
              { label: svc.title },
            ]}
          />

          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {svc.description && (
                <section>
                  <h2 className="font-heading text-xl text-primary">{t('about')}</h2>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">
                    {svc.description}
                  </p>
                </section>
              )}

              <section className="mt-8 rounded-2xl border border-gold/25 bg-surface p-4 shadow-card sm:p-6">
                <div className="flex items-start gap-4">
                  <img
                    src={svc.partner.logoUrl ?? '/seed/partner-logo.svg'}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border border-gold/20 object-cover"
                  />
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg text-primary">
                      {t('aboutPartner', { partner: svc.partnerName })}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gold-muted">
                      {svc.partner.city ? (
                        <>
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {svc.partner.city}
                          {svc.partner.state ? `, ${svc.partner.state}` : ''}
                        </>
                      ) : (
                        <>
                          <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {t('remote')}
                        </>
                      )}
                      <span className="mx-1 text-gold/50">·</span>
                      <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
                      {svc.partner.rating}
                    </p>
                    {svc.partner.description && (
                      <p className="mt-3 text-sm text-muted">{svc.partner.description}</p>
                    )}
                  </div>
                </div>
              </section>

              {svc.relatedServices.length > 0 && (
                <section className="mt-8">
                  <h2 className="font-heading text-lg text-primary">
                    {t('moreFrom', { partner: svc.partnerName })}
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {svc.relatedServices.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/services/post-marriage/${r.slug}`}
                          className="flex items-center justify-between rounded-lg border border-gold/25 bg-surface px-4 py-3 transition hover:bg-gold/5"
                        >
                          <span className="text-primary">{r.title}</span>
                          <span className="text-sm text-gold-muted">
                            {r.priceUnit === 'QUOTE' || r.priceFrom === null
                              ? tCard('onRequest')
                              : formatINR(r.priceFrom)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-gold/25 bg-surface p-4 shadow-card sm:p-6">
                <p className="text-xs uppercase tracking-wide text-gold-muted">{t('price')}</p>
                <p className="font-heading text-3xl text-primary">{priceLabel}</p>
                {unitSuffix && <p className="text-sm text-muted">{unitSuffix}</p>}
                <p className="mt-2 text-sm text-muted">{t('priceNote')}</p>

                <div className="mt-6">
                  <ServiceEnquiryForm serviceId={svc.id} />
                </div>
              </div>
            </aside>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
