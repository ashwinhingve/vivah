import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertCircle, Edit2, Trash2, Users } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { fetchAuth } from '@/lib/server-fetch';
import { formatDateIN } from '@/lib/format';
import type { WeddingSummary, DestinationDetail } from '@smartshaadi/types';

/**
 * `fetchAuth` already unwraps the `{ success, data }` envelope and returns `data`
 * (or null on any failure). Re-checking `.success` on its result would always be
 * falsy and send every visit to notFound().
 */
async function fetchDestinationDetail(weddingId: string, destinationId: string): Promise<{
  detail: DestinationDetail | null;
  weddingName: string | null;
  error: boolean;
}> {
  const summary = await fetchAuth<WeddingSummary>(`/api/v1/weddings/${weddingId}`);
  if (!summary) return { detail: null, weddingName: null, error: true };

  const weddingName = summary.weddingName ?? summary.venueName ?? null;
  const detail = await fetchAuth<DestinationDetail>(
    `/api/v1/weddings/${weddingId}/destinations/${destinationId}`,
  );
  if (!detail) return { detail: null, weddingName, error: true };

  return { detail, weddingName, error: false };
}

interface PageProps {
  params: Promise<{ id: string; destinationId: string }>;
}

export default async function DestinationDetailPage({ params }: PageProps) {
  const { id, destinationId } = await params;
  const t = await getTranslations('weddings.destinations');
  const { detail, weddingName, error } = await fetchDestinationDetail(id, destinationId);

  if (error || !detail) {
    notFound();
  }

  const { destination, ceremonies, travel } = detail;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Header with destination name and actions */}
        <div className="mb-8">
          <Link
            href={`/weddings/${id}/destinations`}
            className="mb-4 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            ← {weddingName ? `${weddingName} · ${t('heading')}` : t('heading')}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="font-heading font-bold text-3xl text-primary">
                  {destination.city}
                </h1>
                {destination.isPrimary && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal/10 text-teal border border-teal/20 rounded-full text-2xs font-semibold">
                    {t('primaryBadge')}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {destination.countryCode} · {destination.ianaTimezone}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Link
                href={`/weddings/${id}/destinations/${destinationId}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gold/20 text-primary rounded-lg hover:bg-gold/5 transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('editDestination')}
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('deleteDestination')}
              </button>
            </div>
          </div>

          {/* Date range */}
          <div className="mt-4 p-4 rounded-lg bg-surface border border-gold/20">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-2xs font-semibold uppercase tracking-wide mb-1">
                  {t('arriveOn')}
                </p>
                <p className="font-medium text-primary">{formatDateIN(destination.arriveOn)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-2xs font-semibold uppercase tracking-wide mb-1">
                  {t('departOn')}
                </p>
                <p className="font-medium text-primary">{formatDateIN(destination.departOn)}</p>
              </div>
            </div>
            {destination.notes && (
              <p className="mt-3 text-sm text-muted-foreground italic border-t border-gold/10 pt-3">
                {destination.notes}
              </p>
            )}
          </div>
        </div>

        {/* Ceremonies section */}
        {ceremonies.length > 0 && (
          <div className="mb-8">
            <SectionHeader title={t('ceremonyDetails')} />
            <div className="space-y-3">
              {ceremonies.map((ceremony) => (
                <div
                  key={ceremony.id}
                  className="p-4 rounded-xl border border-gold/20 bg-surface"
                >
                  {ceremony.outsideWindow && (
                    <div className="mb-3 flex items-start gap-2 p-2.5 bg-warning/10 border border-warning/30 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-xs text-warning font-medium">
                        {t('outsideWindowWarning')}
                      </p>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-primary">{ceremony.type}</p>
                      {ceremony.date && (
                        <p className="text-sm text-muted-foreground">
                          {formatDateIN(ceremony.date)}
                        </p>
                      )}
                      {ceremony.venue && (
                        <p className="text-sm text-muted-foreground">{ceremony.venue}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guest travel section */}
        <div>
          <SectionHeader
            title={t('guestTravel')}
            subtitle={t('guestTravelDescription')}
          />

          {travel.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/20">
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      {t('guestName')}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      {t('arrivalDate')}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      {t('arrivalTime')}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      {t('departureDate')}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      {t('departureTime')}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      {t('travelNotes')}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-primary">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {travel.map((leg) => (
                    <tr key={leg.id} className="border-b border-gold/10 hover:bg-gold/5">
                      <td className="px-4 py-3 text-primary font-medium">{leg.guestName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateIN(leg.arrivalDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{leg.arrivalTime}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateIN(leg.departureDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{leg.departureTime}</td>
                      <td className="px-4 py-3 text-muted-foreground text-2xs">
                        {leg.travelNotes ? (
                          <span title={leg.travelNotes} className="truncate block">
                            {leg.travelNotes}
                          </span>
                        ) : (
                          <span className="text-gold-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-destructive hover:text-destructive/80 transition-colors p-1"
                          title={t('deleteTravelLeg')}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-gold/30 bg-surface text-center">
              <Users className="h-6 w-6 text-gold-muted mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t('noTravelLegs')}</p>
            </div>
          )}

          {/* Add travel leg button */}
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 border border-teal/30 text-teal rounded-lg font-medium text-sm hover:bg-teal/5 transition-colors"
          >
            <span className="text-lg">+</span>
            {t('addTravelLeg')}
          </button>
        </div>
      </div>
    </div>
  );
}
