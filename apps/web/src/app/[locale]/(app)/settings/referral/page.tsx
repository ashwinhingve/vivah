import { headers } from 'next/headers';
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
  const h = await headers();
  const cookie = h.get('cookie') ?? '';

  const [code, activity] = await Promise.all([
    fetchMyCode(cookie),
    fetchMyActivity(cookie),
  ]);

  if (!code) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-heading text-3xl font-semibold text-primary">Refer & earn</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          We couldn&apos;t load your referral code. Try again in a moment.
        </p>
      </main>
    );
  }

  const totalCredits = activity?.total_credits ?? 0;
  const referrals: ReferralActivityItem[] = activity?.referrals ?? [];

  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host') ?? h.get('host') ?? 'smartshaadi.in';
  const shareUrl = `${proto}://${host}/register?ref=${encodeURIComponent(code.code)}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-3xl font-semibold text-primary">Refer &amp; earn</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Share your code with friends and family. Earn credits when they complete their profile or subscribe.
      </p>

      <section className="mt-8 rounded-xl border border-gold/40 bg-surface p-6 shadow-card">
        <p className="text-xs uppercase tracking-wider text-gold-muted">Your code</p>
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

      <section className="mt-6 rounded-xl border border-gold/40 bg-surface p-6 shadow-card">
        <p className="text-xs uppercase tracking-wider text-gold-muted">Total credits earned</p>
        <div className="mt-1 text-4xl font-bold text-gold">
          {totalCredits.toLocaleString('en-IN')}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          +50 credits per completed profile · +200 credits per subscription
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-gold/40 bg-surface shadow-card">
        <header className="border-b border-gold/30 px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">Referral activity</h2>
        </header>
        {referrals.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No referrals yet. Share your code to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-gold-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Friend</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Credits</th>
                  <th className="px-4 py-3 text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-t border-gold/20">
                    <td className="px-4 py-3 text-primary">
                      {r.referred_name ?? 'New member'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gold">
                      {r.reward_amount_credits > 0 ? `+${r.reward_amount_credits}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
