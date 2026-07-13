import { redirect } from '@/i18n/redirect';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { DisputeTableClient } from './DisputeTableClient.client';

export const dynamic = 'force-dynamic';

interface AuthMe { userId: string; role: string; status: string }

interface DisputedBookingRow {
  bookingId:    string;
  customerId:   string;
  customerName: string;
  vendorId:     string;
  totalAmount:  string;
  escrowHeld:   string;
  raisedAt:     string;
  escrowStatus: string;
  paymentId:    string | null;
}

export default async function AdminEscrowPage() {
  const t = await getTranslations('adminRole');
  // Auth gate — rely on middleware for role check, just verify session exists
  const cookieStore = await cookies();
  const token       = cookieStore.get('better-auth.session_token')?.value;
  if (!token) {
    return await redirect('/login');
  }
  // Defense-in-depth: middleware fail-opens if /api/auth/me errors, so re-check
  // the role here and redirect any non-admin off the page.
  const me = await fetchAuth<AuthMe>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }

  const wrapped = await fetchAuth<{ disputes: DisputedBookingRow[] }>('/api/v1/admin/disputes');
  const disputes = wrapped?.disputes ?? [];

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.adminConsole')}
        </Link>

        <FadeUp>
          <PageHeader
            title={t('escrow.title')}
            subtitle={t('escrow.subtitle')}
            breadcrumbs={[{ label: t('common.breadcrumbAdmin'), href: '/admin' }, { label: t('escrow.breadcrumb') }]}
          />
        </FadeUp>

        <FadeUp>
          {disputes.length === 0 ? (
            <EmptyState
              icon={undefined}
              title={t('escrow.emptyTitle')}
              description={t('escrow.emptyDescription')}
            />
          ) : (
            <DisputeTableClient disputes={disputes} />
          )}
        </FadeUp>
      </main>
    </PageTransition>
  );
}
