/**
 * Package result card — Phase 8, Unit 8.1. Server component; no interactivity.
 *
 * Renders the same for placeholder and real inventory. `isPlaceholder` is not
 * read here on purpose: a "preview listing" badge would be exactly the
 * user-facing restriction the flag is specified NOT to impose.
 */
import { getTranslations } from 'next-intl/server';
import { MapPin, Users, Moon, BadgeCheck } from 'lucide-react';
import type { PremiumPackageWithVendor } from '@smartshaadi/types';
import { Link } from '@/i18n/navigation';
// formatINRCompact renders lakh/crore grouping ("₹8.5 L"), which is how these
// amounts are actually spoken in India and keeps a 7-figure price from
// overflowing the card. It accepts the decimal string verbatim.
import { formatINRCompact } from '@/lib/format';

export async function PackageCard({ pkg }: { pkg: PremiumPackageWithVendor }) {
  const t = await getTranslations('packages.card');

  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gold/25 bg-surface shadow-card transition hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-background">
        {/* Plain img, not next/image: these are local SVGs with no need for
            the optimiser, and a remote partner URL later would require a
            next.config domain allowlist entry per partner. */}
        <img
          src={pkg.heroImageUrl ?? '/seed/package-signature.svg'}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-surface">
          {t(`tier.${pkg.tier}`)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <h3 className="font-heading text-lg text-primary">{pkg.title}</h3>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-gold-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {pkg.destinationCity}
          <span className="mx-1 text-gold/50">·</span>
          <span className="truncate">{pkg.vendorName}</span>
          {pkg.vendorVerified && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-label={t('verified')} />
          )}
        </p>

        {pkg.summary && (
          <p className="mt-3 line-clamp-2 text-sm text-muted">{pkg.summary}</p>
        )}

        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <dt className="sr-only">{t('capacity')}</dt>
            <dd>{t('guestRange', { min: pkg.guestCapacityMin, max: pkg.guestCapacityMax })}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Moon className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <dt className="sr-only">{t('duration')}</dt>
            <dd>{t('nights', { count: pkg.durationNights })}</dd>
          </div>
        </dl>

        <div className="mt-auto pt-4">
          <p className="text-xs uppercase tracking-wide text-gold-muted">{t('startingFrom')}</p>
          <p className="font-heading text-xl text-primary">{formatINRCompact(pkg.priceFrom)}</p>
        </div>
      </div>
    </Link>
  );
}
