import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { fetchMyCode, fetchMyActivity, type ReferralActivityItem } from '@/lib/referral-api';
import { ReferralActions } from './ReferralActions.client';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  SIGNED_UP:         { label: 'Signed up',         tone: 'bg-gold/20 text-gold-muted' },
  COMPLETED_PROFILE: { label: 'Profile complete',  tone: 'bg-teal/15 text-teal' },
  SUBSCRIBED:        { label: 'Subscribed',        tone: 'bg-success/15 text-success' },
  EXPIRED:           { label: 'Expired',           tone: 'bg-muted text-muted-foreground' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, tone: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function ReferralSettingsPage() {
  const t = await getTranslations('settings');
  const h = await headers();
  const cookie = h.get('cookie') ?? '';

  const [code, activity] = await Promise.all([
    fetchMyCode(cookie),
    fetchMyActivity(cookie),
  ]);

  if (!code) {
    return (
      <PageTransition>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <FadeUp>
            <PageHeader
              title={t('referral')}
            />
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="mt-4 text-sm text-muted-foreground">
              We couldn&apos;t load your referral code. Try again in a moment.
            </p>
          </FadeUp>
        </main>
      </PageTransition>
    );
  }

  const totalCredits = activity?.total_credits ?? 0;
  const referrals: ReferralActivityItem[] = activity?.referrals ?? [];

  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host') ?? h.get('host') ?? 'smartshaadi.co.in';
  const shareUrl = `${proto}://${host}/register?ref=${encodeURIComponent(code.code)}`;

  const tableColumns: DataTableColumn<ReferralActivityItem>[] = [
    {
      key: 'referred_name',
      header: t('referralTableFriend'),
      render: (r) => r.referred_name ?? 'New member',
      mobileLabel: t('referralTableFriend'),
    },
    {
      key: 'status',
      header: t('referralTableStatus'),
      render: (r) => <StatusBadge status={r.status} />,
      mobileLabel: t('referralTableStatus'),
    },
    {
      key: 'reward_amount_credits',
      header: t('referralTableCredits'),
      cellClassName: 'text-right',
      headClassName: 'text-right',
      render: (r) => (
        <span className="font-mono text-gold">
          {r.reward_amount_credits > 0 ? `+${r.reward_amount_credits}` : '—'}
        </span>
      ),
      mobileLabel: t('referralTableCredits'),
    },
    {
      key: 'created_at',
      header: t('referralTableJoined'),
      cellClassName: 'text-right',
      headClassName: 'text-right',
      render: (r) => formatDate(r.created_at),
      mobileLabel: t('referralTableJoined'),
    },
  ];

  return (
    <PageTransition>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <FadeUp>
          <PageHeader
            title={t('referral')}
            subtitle={t('referralDesc')}
          />
        </FadeUp>

        <FadeUp delay={0.1}>
          <section className="rounded-xl border border-gold/40 bg-surface p-6 shadow-card">
            <p className="text-xs uppercase tracking-wider text-gold-muted">{t('referralYourCode')}</p>
            <div className="mt-2 font-mono text-3xl font-semibold text-primary sm:text-4xl">
              {code.code}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {code.uses_count} {code.uses_count === 1 ? 'use' : 'uses'} so far
            </p>
            <div className="mt-4">
              <ReferralActions code={code.code} shareUrl={shareUrl} />
            </div>
          </section>
        </FadeUp>

        <FadeUp delay={0.2}>
          <section className="mt-6 rounded-xl border border-gold/40 bg-surface p-6 shadow-card">
            <p className="text-xs uppercase tracking-wider text-gold-muted">{t('referralTotalCredits')}</p>
            <div className="mt-1 text-4xl font-bold text-gold">
              {totalCredits.toLocaleString('en-IN')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('referralRewardInfo')}
            </p>
          </section>
        </FadeUp>

        <FadeUp delay={0.3}>
          <section className="mt-6">
            <h2 className="mb-4 text-lg font-semibold text-primary">{t('referralActivity')}</h2>
            <DataTable
              columns={tableColumns}
              data={referrals}
              rowKey={(r) => r.id}
              empty={{
                title: t('referralEmpty'),
                description: t('referralEmptyDesc'),
              }}
            />
          </section>
        </FadeUp>
      </main>
    </PageTransition>
  );
}
