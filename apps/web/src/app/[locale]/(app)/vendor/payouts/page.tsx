/**
 * Smart Shaadi — Vendor Payout History
 * Server Component
 */
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations, getLocale } from 'next-intl/server';
import { Wallet, Clock, XCircle, Receipt, LogIn } from 'lucide-react';
import type { PayoutRecord, PayoutStatus } from '@smartshaadi/types';
import { Container } from '@/components/shared';
import { RoleHero } from '@/components/shared/RoleHero';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('vendorRole.payouts');
  return {
    title: t('metaTitle'),
  };
}

interface VendorPayoutSummary {
  lifetimePaid: string;
  pending: string;
  failed: string;
  payoutCount: number;
}

async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
}

async function fetchPayouts(cookie: string): Promise<PayoutRecord[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/payouts/vendor/mine?limit=50`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { items: PayoutRecord[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

async function fetchSummary(cookie: string): Promise<VendorPayoutSummary | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/payments/payouts/vendor/summary`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: VendorPayoutSummary | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function formatINR(amount: string | number, locale: string): Promise<string> {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const numLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return new Intl.NumberFormat(numLocale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

async function formatDate(iso: string | null, locale: string): Promise<string> {
  if (!iso) return '—';
  const dateLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default async function VendorPayoutsPage() {
  const t = await getTranslations('vendorRole.payouts');
  const locale = await getLocale();
  const cookie = await getAuthCookie();
  if (!cookie) {
    return (
      <main className="min-h-screen bg-background py-16">
        <Container variant="narrow">
          <EmptyState
            icon={LogIn}
            title={t('needSignIn')}
            description={t('needSignInDesc')}
          />
        </Container>
      </main>
    );
  }

  const [payouts, summary] = await Promise.all([fetchPayouts(cookie), fetchSummary(cookie)]);

  return (
    <PageTransition>
      <main className="min-h-screen bg-background py-8">
        <Container variant="narrow">
          <RoleHero
            title={t('title')}
            subtitle={t('subtitle')}
            icon={Wallet}
          />

          {summary ? (
            <FadeUp>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatsCard label={t('statLifetime')} value={await formatINR(summary.lifetimePaid, locale)} icon={Wallet} variant="success" animDelayMs={0} />
                <StatsCard label={t('statPending')} value={await formatINR(summary.pending, locale)} icon={Clock} variant="warning" animDelayMs={80} />
                <StatsCard label={t('statFailed')} value={await formatINR(summary.failed, locale)} icon={XCircle} variant="default" animDelayMs={160} />
                <StatsCard label={t('statTotal')} value={summary.payoutCount} icon={Receipt} variant="teal" animDelayMs={240} />
              </div>
            </FadeUp>
          ) : null}

          <div className="mt-6">
            {payouts.length === 0 ? (
              <FadeUp>
                <EmptyState
                  icon={Wallet}
                  title={t('emptyTitle')}
                  description={t('emptyDesc')}
                />
              </FadeUp>
            ) : (
              <StaggerList className="space-y-4">
                {payouts.map((payout) => (
                  <PayoutRow key={payout.id} payout={payout} locale={locale} />
                ))}
              </StaggerList>
            )}
          </div>

          <PayoutSchedule />
        </Container>
      </main>
    </PageTransition>
  );
}

async function PayoutRow({ payout, locale }: { payout: PayoutRecord; locale: string }) {
  const t = await getTranslations('vendorRole.payouts');

  const statusTones: Record<PayoutStatus, StatusTone> = {
    SCHEDULED:   'warning',
    PROCESSING:  'teal',
    COMPLETED:   'success',
    FAILED:      'error',
    ON_HOLD:     'warning',
  };

  const statusLabels: Record<PayoutStatus, string> = {
    SCHEDULED:   t('statusScheduled'),
    PROCESSING:  t('statusProcessing'),
    COMPLETED:   t('statusCompleted'),
    FAILED:      t('statusFailed'),
    ON_HOLD:     t('statusOnHold'),
  };

  const scheduledDate = await formatDate(payout.scheduledFor, locale);
  const processedDate = payout.processedAt ? await formatDate(payout.processedAt, locale) : null;
  const netAmount = await formatINR(payout.netAmount, locale);
  const grossAmount = await formatINR(payout.grossAmount, locale);
  const platformFee = await formatINR(payout.platformFee, locale);

  return (
    <div className="rounded-xl border border-gold bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          {payout.bookingId ? (
            <p className="font-mono text-xs text-muted-foreground">
              {t('booking', { id: payout.bookingId.slice(0, 8) })}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('scheduled')} {scheduledDate}
            {processedDate ? ` · ${t('processed')} ${processedDate}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-success">{netAmount}</p>
          <p className="text-xs text-muted-foreground">
            {t('gross', { amount: grossAmount, fee: platformFee })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusChip tone={statusTones[payout.status]}>
          {statusLabels[payout.status]}
        </StatusChip>
        {payout.razorpayPayoutId ? (
          <span className="font-mono text-xs text-muted-foreground">
            {payout.razorpayPayoutId}
          </span>
        ) : null}
      </div>

      {payout.failureReason ? (
        <p className="mt-2 text-xs text-destructive">
          {t('failureReason', { reason: payout.failureReason })}
        </p>
      ) : null}
    </div>
  );
}

async function PayoutSchedule() {
  const t = await getTranslations('vendorRole.payouts');
  return (
    <aside className="mt-8 rounded-xl border border-gold bg-secondary px-5 py-4 text-sm">
      <p className="font-semibold text-primary">{t('scheduleTitle')}</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
        <li>{t('scheduleBullet1')}</li>
        <li>{t('scheduleBullet2')}</li>
        <li>{t('scheduleBullet3')}</li>
      </ul>
    </aside>
  );
}
