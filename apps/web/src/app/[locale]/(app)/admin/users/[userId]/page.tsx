/**
 * Admin User Detail — identity, verification badges, linked profile/vendor
 * records, reputation score, and account status controls.
 * Server Component. Fetches /api/v1/admin/users/:userId (+ reputation).
 */
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft, ArrowRight, BadgeCheck, Mail, Phone, Calendar } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import type { UserRole, UserStatus } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { RolePill, UserStatusPill } from '@/components/admin/badges';
import { UserActions } from '@/components/admin/UserActions.client';
import { ReputationCard, type ReputationData } from '@/components/admin/ReputationCard';

export const dynamic = 'force-dynamic';

interface UserDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  if (!me) return await redirect('/login');

  const { userId } = await params;
  const [data, reputation] = await Promise.all([
    fetchAuth<{ user: UserDetail; profileId: string | null; vendorId: string | null }>(
      `/api/v1/admin/users/${userId}`,
    ),
    fetchAuth<ReputationData>(`/api/v1/admin/users/${userId}/reputation`),
  ]);
  if (!data?.user) notFound();
  const u = data.user;

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          User directory
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title={u.name}
            subtitle={u.email ?? u.phone ?? u.id}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'Users', href: '/admin/users' },
              { label: u.name },
            ]}
          />
          <div className="flex gap-2">
            <RolePill role={u.role} />
            <UserStatusPill status={u.status} />
          </div>
        </div>

        {/* 2-column desktop, stacked mobile — mirrors admin/vendors/[id]/page.tsx */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">

          {/* ── Left column: user info ── */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
              <SectionHeader title="Identity" />
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
                </dt>
                <dd className="flex items-center gap-1.5 text-foreground">
                  {u.email ?? '—'}
                  {u.email && u.emailVerified ? (
                    <BadgeCheck className="h-3.5 w-3.5 text-success" aria-label="Verified" />
                  ) : null}
                </dd>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Phone
                </dt>
                <dd className="flex items-center gap-1.5 text-foreground">
                  {u.phone ?? '—'}
                  {u.phone && u.phoneVerified ? (
                    <BadgeCheck className="h-3.5 w-3.5 text-success" aria-label="Verified" />
                  ) : null}
                </dd>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Joined
                </dt>
                <dd className="text-foreground">{new Date(u.createdAt).toLocaleString('en-IN')}</dd>
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs text-foreground">{u.id}</dd>
              </dl>
            </section>

            <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
              <SectionHeader title="Linked records" />
              <div className="mt-2 flex flex-wrap gap-3">
                {data.profileId ? (
                  <Link
                    href={`/admin/kyc/${data.profileId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gold/30 px-3 py-2 text-sm text-teal transition-colors hover:bg-gold/10"
                  >
                    View matchmaking profile / KYC
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">No matchmaking profile</span>
                )}
                {data.vendorId ? (
                  <Link
                    href={`/admin/vendors/${data.vendorId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gold/30 px-3 py-2 text-sm text-teal transition-colors hover:bg-gold/10"
                  >
                    View vendor listing
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">No vendor listing</span>
                )}
              </div>
            </section>

            <ReputationCard data={reputation} />
          </div>

          {/* ── Right column: account actions (sticky on desktop) ── */}
          <div className="lg:sticky lg:top-20">
            <UserActions userId={u.id} status={u.status} />
          </div>
        </div>
      </PageTransition>
    </main>
  );
}
