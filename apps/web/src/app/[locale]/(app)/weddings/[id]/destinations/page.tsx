import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { Plus, MapPinOff } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { fetchAuth } from '@/lib/server-fetch';
import { formatDateIN } from '@/lib/format';
import type { WeddingSummary, DestinationSummary } from '@smartshaadi/types';

/**
 * Destination legs for one wedding (Phase 8 Unit 8.1).
 *
 * A leg is a CITY of a multi-city wedding — Mehndi in Delhi, Wedding in Udaipur.
 * Not a catalogue, not a package: there is no price or booking on this screen,
 * because destination supply is Tier 3 and blocked on venue partnerships.
 *
 * `fetchAuth` already unwraps the `{ success, data }` envelope and returns `data`
 * (or null). Re-checking `.success` on its result would always be falsy and pin
 * the page to its error state forever.
 */
async function fetchDestinations(weddingId: string): Promise<{
  destinations: DestinationSummary[];
  weddingName: string | null;
  error: boolean;
}> {
  const summary = await fetchAuth<WeddingSummary>(`/api/v1/weddings/${weddingId}`);
  if (!summary) return { destinations: [], weddingName: null, error: true };

  const weddingName = summary.weddingName ?? summary.venueName ?? null;
  const result = await fetchAuth<{ destinations: DestinationSummary[] }>(
    `/api/v1/weddings/${weddingId}/destinations`,
  );
  if (!result) return { destinations: [], weddingName, error: true };

  // The API already orders by sortOrder; sorting again keeps the UI stable if
  // that ever changes.
  return {
    destinations: [...result.destinations].sort((a, b) => a.sortOrder - b.sortOrder),
    weddingName,
    error: false,
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DestinationsPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('weddings.destinations');
  const { destinations, weddingName, error } = await fetchDestinations(id);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
        <PageHeader
          title={t('heading')}
          subtitle={weddingName ? `${weddingName} · ${t('description')}` : t('description')}
          breadcrumbs={[
            { label: t('breadcrumbWeddings'), href: '/weddings' },
            { label: weddingName ?? t('breadcrumbWedding'), href: `/weddings/${id}` },
            { label: t('heading') },
          ]}
        />

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="font-medium text-destructive">{t('loadError')}</p>
          </div>
        )}

        {!error && destinations.length > 0 && (
          <>
            <SectionHeader
              title={t('legsTitle')}
              subtitle={t('legCount', { count: destinations.length })}
            />
            <div className="mb-6 space-y-3">
              {destinations.map((dest) => (
                <Link
                  key={dest.id}
                  href={`/weddings/${id}/destinations/${dest.id}`}
                  className="block rounded-2xl border border-gold/20 bg-surface p-4 shadow-card transition-all hover:border-teal/40 hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg font-semibold text-primary">
                          {dest.city}
                        </h3>
                        {dest.isPrimary && (
                          <span className="inline-flex items-center rounded-full border border-teal/20 bg-teal/10 px-2 py-0.5 text-2xs font-semibold text-teal">
                            {t('primary')}
                          </span>
                        )}
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">
                        {dest.countryCode} · {dest.ianaTimezone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateIN(dest.arriveOn)} — {formatDateIN(dest.departOn)}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-4 text-right">
                      <div>
                        <p className="font-heading text-2xl font-bold text-primary">
                          {dest.ceremonyCount}
                        </p>
                        <p className="text-2xs text-muted-foreground">{t('ceremonies')}</p>
                      </div>
                      <div>
                        <p className="font-heading text-2xl font-bold text-primary">
                          {dest.travellerCount}
                        </p>
                        <p className="text-2xs text-muted-foreground">{t('travellers')}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {!error && destinations.length === 0 && (
          <div className="mb-6 rounded-2xl border border-dashed border-gold/30 bg-surface p-12 text-center shadow-card">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-gold/10 p-3">
                <MapPinOff className="h-6 w-6 text-gold-muted" aria-hidden="true" />
              </div>
            </div>
            <p className="mb-2 font-heading text-lg font-semibold text-primary">
              {t('emptyTitle')}
            </p>
            <p className="mb-6 text-sm text-muted-foreground">{t('emptyDescription')}</p>
            <Link
              href={`/weddings/${id}/destinations/new`}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-medium text-background transition-colors hover:bg-teal/90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('addDestination')}
            </Link>
          </div>
        )}

        {!error && destinations.length > 0 && (
          <div className="border-t border-gold/20 pt-4">
            <Link
              href={`/weddings/${id}/destinations/new`}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-teal/30 px-4 text-sm font-medium text-teal transition-colors hover:bg-teal/5"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('addDestination')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
