import { getTranslations } from 'next-intl/server';
import { Bell } from 'lucide-react';

export async function ActivityFeed() {
  const t = await getTranslations('dashboard.activityFeed');
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
      <h2 className="mb-3 font-heading text-base font-semibold text-primary">
        {t('title')}
      </h2>
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="font-heading text-base font-semibold text-primary">{t('emptyTitle')}</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {t('emptyBody')}
        </p>
      </div>
    </div>
  );
}
