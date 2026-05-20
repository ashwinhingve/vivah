/**
 * Admin Vendor Detail / Review Page (P1-8).
 * Server Component. Fetches /api/v1/admin/vendors/:id and renders a
 * 2-column layout (info | sticky review actions).
 */
import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader }    from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { VendorReviewActions } from './VendorReviewActions.client';

export const dynamic = 'force-dynamic';

type VendorStatus = 'DRAFT' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface VendorRow {
  id:                string;
  userId:            string;
  businessName:      string;
  category:          string;
  city:              string;
  state:             string;
  status:            VendorStatus;
  submittedAt:       string | null;
  reviewedAt:        string | null;
  reviewedByUserId:  string | null;
  rejectionReason:   string | null;
  rejectionCategory: string | null;
  phone:             string | null;
  email:             string | null;
  website:           string | null;
  instagram:         string | null;
  description:       string | null;
  tagline:           string | null;
  yearsActive:       number | null;
  responseTimeHours: number | null;
  priceMin:          string | null;
  priceMax:          string | null;
  rating:            string | null;
  totalReviews:      number;
  verified:          boolean;
  isActive:          boolean;
  bankVerificationStatus: string;
  commissionPct:     string | null;
}

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch { return null; }
}

function StatusBadge({ status }: { status: VendorStatus }) {
  const colour: Record<VendorStatus, string> = {
    DRAFT:        'bg-muted text-muted-foreground border-muted-foreground/20',
    PENDING:      'bg-warning/15 text-warning border-warning/30',
    UNDER_REVIEW: 'bg-teal/10 text-teal border-teal/30',
    APPROVED:     'bg-success/15 text-success border-success/30',
    REJECTED:     'bg-destructive/10 text-destructive border-destructive/30',
    SUSPENDED:    'bg-destructive/10 text-destructive border-destructive/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colour[status]}`}>
      {status}
    </span>
  );
}

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const me = await fetchAuth<{ id: string; role: string }>('/api/auth/me', token);
  if (me && me.role !== 'ADMIN') {
    redirect(me.role === 'SUPPORT' ? '/support' : '/dashboard');
  }
  if (!me) redirect('/login');

  const { id } = await params;
  const data = await fetchAuth<{ vendor: VendorRow }>(`/api/v1/admin/vendors/${id}`, token);
  if (!data?.vendor) notFound();
  const v = data.vendor;

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Link
          href="/admin/vendors"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Vendor queue
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title={v.businessName}
            subtitle={`${v.category} · ${v.city}${v.state ? `, ${v.state}` : ''}`}
            breadcrumbs={[
              { label: 'Admin',   href: '/admin' },
              { label: 'Vendors', href: '/admin/vendors' },
              { label: v.businessName },
            ]}
          />
          <StatusBadge status={v.status} />
        </div>

        {/* 2-column desktop, stacked mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">

          {/* ── Left column: vendor info ── */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
              <SectionHeader title="Business" />
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Tagline</dt>
                <dd className="text-foreground">{v.tagline ?? '—'}</dd>
                <dt className="text-muted-foreground">Years active</dt>
                <dd className="text-foreground">{v.yearsActive ?? '—'}</dd>
                <dt className="text-muted-foreground">Response time</dt>
                <dd className="text-foreground">{v.responseTimeHours ?? '—'} hrs</dd>
                <dt className="text-muted-foreground">Price range</dt>
                <dd className="text-foreground">
                  {v.priceMin ? `₹${v.priceMin}` : '—'} – {v.priceMax ? `₹${v.priceMax}` : '—'}
                </dd>
                <dt className="text-muted-foreground">Rating</dt>
                <dd className="text-foreground">{v.rating ?? '0'} ({v.totalReviews} reviews)</dd>
                <dt className="text-muted-foreground">Commission %</dt>
                <dd className="text-foreground">{v.commissionPct ?? '—'}</dd>
              </dl>
              {v.description && (
                <p className="mt-3 text-sm text-foreground whitespace-pre-line">{v.description}</p>
              )}
            </section>

            <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
              <SectionHeader title="Contact" />
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="text-foreground">{v.phone ?? '—'}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-foreground">{v.email ?? '—'}</dd>
                <dt className="text-muted-foreground">Website</dt>
                <dd className="text-foreground truncate">{v.website ?? '—'}</dd>
                <dt className="text-muted-foreground">Instagram</dt>
                <dd className="text-foreground">{v.instagram ?? '—'}</dd>
              </dl>
            </section>

            <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
              <SectionHeader title="Verification" />
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Bank account</dt>
                <dd className="text-foreground">{v.bankVerificationStatus}</dd>
                <dt className="text-muted-foreground">Profile verified</dt>
                <dd className="text-foreground">{v.verified ? 'Yes' : 'No'}</dd>
                <dt className="text-muted-foreground">Active</dt>
                <dd className="text-foreground">{v.isActive ? 'Yes' : 'No'}</dd>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                For KYC document checks (Aadhaar / PAN / GST) see the{' '}
                <Link href="/admin/kyc" className="text-teal underline">KYC console</Link>.
              </p>
            </section>

            <section className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
              <SectionHeader title="Timeline" />
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="text-foreground">
                  {v.submittedAt ? new Date(v.submittedAt).toLocaleString('en-IN') : '—'}
                </dd>
                <dt className="text-muted-foreground">Last reviewed</dt>
                <dd className="text-foreground">
                  {v.reviewedAt ? new Date(v.reviewedAt).toLocaleString('en-IN') : '—'}
                </dd>
                <dt className="text-muted-foreground">Claimed by</dt>
                <dd className="text-foreground">{v.reviewedByUserId ?? '—'}</dd>
              </dl>
            </section>
          </div>

          {/* ── Right column: review actions (sticky on desktop) ── */}
          <div className="lg:sticky lg:top-20">
            <VendorReviewActions
              vendorId={v.id}
              status={v.status}
              reviewedByUserId={v.reviewedByUserId}
              currentAdminId={me.id}
              rejectionReason={v.rejectionReason}
              rejectionCategory={v.rejectionCategory}
            />
          </div>
        </div>
      </PageTransition>
    </main>
  );
}
