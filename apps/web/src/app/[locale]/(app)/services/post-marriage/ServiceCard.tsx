/**
 * Service result card — Phase 8, Unit 8.2. Server component.
 *
 * Price rendering handles the three real shapes in the data: a fixed price, a
 * range, and no price at all (a QUOTE service). The last is not an error state —
 * "price on request" is a legitimate commercial answer for a service like a
 * gifting registry whose cost depends on its size.
 *
 * `isPlaceholder` controls whether a "Preview listing" badge renders: both the
 * service and its partner can be placeholders. The badge is always visible in
 * the card layout and does not hide, filter, or re-rank any row — it is labelling
 * only, so the user can make an informed enquiry decision.
 */
import { getTranslations } from 'next-intl/server';
import { MapPin, Globe, Star } from 'lucide-react';
import type { PostMarriageServiceWithPartner } from '@smartshaadi/types';
import { Link } from '@/i18n/navigation';
import { formatINRCompact } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

export async function ServiceCard({ service }: { service: PostMarriageServiceWithPartner }) {
  const t = await getTranslations('postMarriage.card');

  const unitSuffix = t(`priceUnit.${service.priceUnit}`);

  const priceLabel = (() => {
    if (service.priceUnit === 'QUOTE' || service.priceFrom === null) {
      return t('onRequest');
    }
    const from = formatINRCompact(service.priceFrom);
    // Only render a range when the upper bound is real AND different — a
    // "₹5 L – ₹5 L" range reads as a bug.
    if (service.priceTo && service.priceTo !== service.priceFrom) {
      return `${from} – ${formatINRCompact(service.priceTo)}`;
    }
    return `${t('from')} ${from}`;
  })();

  return (
    <Link
      href={`/services/post-marriage/${service.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-gold/25 bg-surface p-4 shadow-card transition hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal sm:p-6"
    >
      <div className="flex items-start gap-3">
        {/* Plain img, not next/image: these are local SVGs (which next/image
            only serves with dangerouslyAllowSVG), and a real partner's remote
            logo URL would otherwise need a next.config domain allowlist entry
            per partner onboarded. */}
        <img
          src={service.partnerLogoUrl ?? '/seed/partner-logo.svg'}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-gold/20 object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-teal">{service.categoryName}</p>
          <h3 className="font-heading text-lg leading-tight text-primary">{service.title}</h3>
          {service.isPlaceholder && (
            <div className="mt-2">
              <Badge variant="warning">{t('placeholder')}</Badge>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-gold-muted">
        {service.partnerCity ? (
          <>
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            {service.partnerCity}
          </>
        ) : (
          <>
            {/* No city is meaningful, not missing — say so rather than
                rendering an empty slot. */}
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('remote')}
          </>
        )}
        <span className="mx-1 text-gold/50">·</span>
        <span className="truncate">{service.partnerName}</span>
      </p>

      {service.description && (
        <p className="mt-3 line-clamp-3 text-sm text-muted">{service.description}</p>
      )}

      <div className="mt-auto flex items-end justify-between pt-4">
        <div>
          <p className="font-heading text-lg text-primary">{priceLabel}</p>
          {unitSuffix && <p className="text-xs text-muted">{unitSuffix}</p>}
        </div>
        <span className="flex items-center gap-1 text-sm text-gold-muted">
          <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
          {service.partnerRating}
        </span>
      </div>
    </Link>
  );
}
