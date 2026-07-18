'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { CityNetworkOverview, CityStatus } from '@smartshaadi/types';

const STATUS_COLORS: Record<CityStatus, string> = {
  ACTIVE: 'bg-success/10',
  EXPANSION: 'bg-gold/10',
  PLANNED: 'bg-muted/10',
};

const STATUS_LABELS: Record<CityStatus, string> = {
  ACTIVE: 'Active',
  EXPANSION: 'Expansion',
  PLANNED: 'Planned',
};

export function CityNetwork({ overview }: { overview: CityNetworkOverview | null }) {
  const t = useTranslations('adminCities');

  if (!overview || !overview.cities || overview.cities.length === 0) {
    return (
      <Card padding="md" className="text-center">
        <h3 className="text-lg font-semibold text-primary">{t('empty.heading')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('empty.description')}</p>
      </Card>
    );
  }

  const activeCount = overview.cities.filter((c) => c.city.status === 'ACTIVE').length;
  const totalApproved = overview.cities.reduce((sum, c) => sum + c.vendorsApproved, 0);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('overview.totalCities')} value={String(overview.cities.length)} />
        <StatTile label={t('overview.activeCities')} value={String(activeCount)} />
        <StatTile label={t('overview.totalVendors')} value={String(totalApproved)} />
        <StatTile label={t('overview.unmappedCount')} value={String(overview.unmappedVendorCount)} />
      </div>

      {/* City Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {overview.cities.map((item) => (
          <CityCard key={item.city.id} item={item} />
        ))}
      </div>

      {/* Unmapped Vendors Callout */}
      {overview.unmappedVendorCount > 0 && overview.unmappedCityNames.length > 0 && (
        <UnmappedCallout
          count={overview.unmappedVendorCount}
          cityNames={overview.unmappedCityNames}
        />
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-primary">{value}</p>
    </Card>
  );
}

function CityCard({
  item,
}: {
  item: CityNetworkOverview['cities'][0];
}) {
  const t = useTranslations('adminCities');
  const colors = STATUS_COLORS[item.city.status];

  return (
    <Link
      href={`/admin/cities/${item.city.id}`}
      className="block"
    >
      <Card padding="md" hover className={colors}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary truncate">
              {item.city.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.city.state}</p>
          </div>
          <Badge variant="outline">
            {STATUS_LABELS[item.city.status]}
          </Badge>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('cityCard.vendors')}</span>
            <span className="font-medium text-primary">{item.vendorsApproved}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('cityCard.coverage')}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/30">
                <div
                  className="h-full bg-teal transition-all"
                  style={{ width: `${item.coveragePct}%` }}
                />
              </div>
              <span className="w-8 text-right font-medium text-primary">
                {item.coveragePct}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('cityCard.bookings')}</span>
            <span className="font-medium text-success">{item.bookingsLast90d}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function UnmappedCallout({
  count,
  cityNames,
}: {
  count: number;
  cityNames: string[];
}) {
  const t = useTranslations('adminCities');

  return (
    <Card padding="md" className="border-warning/30 bg-warning/5">
      <h4 className="font-semibold text-warning">{t('unmapped.heading')}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{t('unmapped.description')}</p>
      <div className="mt-3">
        <p className="text-xs font-medium text-warning">
          {count} vendor{count !== 1 ? 's' : ''} from:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {cityNames.map((city) => (
            <Badge key={city} variant="outline">
              {city}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}
