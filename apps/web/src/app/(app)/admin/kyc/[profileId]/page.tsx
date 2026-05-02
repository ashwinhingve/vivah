import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { KycActionsPanel } from '@/components/admin/KycActionsPanel.client';
import { KycAppealResolver } from '@/components/admin/KycAppealResolver.client';
import { AuditTimeline } from '@/app/(onboarding)/profile/kyc/AuditTimeline';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface AuthMe { id: string; role: string; status: string }

interface KycRecord {
  profileId: string;
  verificationLevel: string;
  aadhaarVerified: boolean;
  aadhaarRefId: string | null;
  aadhaarVerifiedAt: string | null;
  panVerified: boolean;
  panLast4: string | null;
  bankVerified: boolean;
  bankAccountLast4: string | null;
  bankIfsc: string | null;
  livenessScore: number | null;
  faceMatchScore: number | null;
  riskScore: number | null;
  riskFactors: { code: string; impact: number; detail: string }[] | null;
  duplicateFlag: boolean;
  duplicateReason: string | null;
  sanctionsHit: boolean;
  sanctionsLists: string[] | null;
  attemptCount: number;
  lockedUntil: string | null;
  expiresAt: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  selfieR2Key: string | null;
  livenessVideoR2Key: string | null;
  photoAnalysis: { isRealPerson: boolean; confidenceScore: number; hasSunglasses: boolean; multipleFaces: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

interface ProfileSummary { id: string; userId: string; verificationStatus: string; createdAt: string }

interface DocRow {
  id: string; documentType: string; status: string; documentLast4: string | null;
  expiresAt: string | null; uploadedAt: string; rejectionReason: string | null;
}

interface AppealRow {
  id: string; status: string; userMessage: string; rejectionContext: string | null;
  resolverNote: string | null; createdAt: string; resolvedAt: string | null;
}

interface AuditEntry {
  id: string; eventType: string; actorRole: string | null;
  fromStatus: string | null; toStatus: string | null;
  fromLevel: string | null; toLevel: string | null;
  metadata: Record<string, unknown> | null; createdAt: string;
}

interface Details {
  profile: ProfileSummary;
  kyc: KycRecord | null;
  documents: DocRow[];
  auditTrail: AuditEntry[];
  appeals: AppealRow[];
}

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

function fmt(d: string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
}

interface PageProps { params: Promise<{ profileId: string }> }

export default async function AdminKycDetailPage({ params }: PageProps) {
  const { profileId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const me = await fetchAuth<AuthMe>('/api/auth/me', token);
  if (me && me.role !== 'ADMIN' && me.role !== 'SUPPORT') redirect('/dashboard');

  const details = await fetchAuth<Details>(`/api/v1/admin/kyc/${profileId}/details`, token);
  if (!details) notFound();

  const { profile, kyc, documents, auditTrail, appeals } = details;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Link href="/admin/kyc" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          KYC Console
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-primary font-heading">Profile review</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">{profile.id}</p>
            <p className="text-xs text-muted-foreground">User <span className="font-mono">{profile.userId.slice(0, 8)}…</span> · joined {fmt(profile.createdAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground">{profile.verificationStatus}</span>
            {kyc && <span className="text-[11px] text-muted-foreground">Risk {kyc.riskScore ?? '—'}/100 · {kyc.verificationLevel}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* Left column — record */}
          <div className="space-y-4 min-w-0">
            {/* Identity signals */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Identity verifications</h3>
              <ul className="text-sm space-y-1.5">
                <li className="flex items-center justify-between"><span>Aadhaar</span>
                  <span>{kyc?.aadhaarVerified ? <strong className="text-success">Verified</strong> : <em className="text-muted-foreground">—</em>}{kyc?.aadhaarRefId && <span className="ml-2 font-mono text-[11px] text-muted-foreground">{kyc.aadhaarRefId}</span>}</span>
                </li>
                <li className="flex items-center justify-between"><span>PAN</span>
                  <span>{kyc?.panVerified ? <strong className="text-success">Verified</strong> : <em className="text-muted-foreground">—</em>}{kyc?.panLast4 && <span className="ml-2 font-mono text-[11px] text-muted-foreground">****{kyc.panLast4}</span>}</span>
                </li>
                <li className="flex items-center justify-between"><span>Bank</span>
                  <span>{kyc?.bankVerified ? <strong className="text-success">Verified</strong> : <em className="text-muted-foreground">—</em>}{kyc?.bankAccountLast4 && <span className="ml-2 font-mono text-[11px] text-muted-foreground">{kyc.bankIfsc} ****{kyc.bankAccountLast4}</span>}</span>
                </li>
                <li className="flex items-center justify-between"><span>Liveness</span>
                  <span>{kyc?.livenessScore !== null && kyc?.livenessScore !== undefined ? <strong className={kyc.livenessScore >= 70 ? 'text-success' : 'text-warning'}>{kyc.livenessScore}/100</strong> : <em className="text-muted-foreground">—</em>}</span>
                </li>
                <li className="flex items-center justify-between"><span>Face match</span>
                  <span>{kyc?.faceMatchScore !== null && kyc?.faceMatchScore !== undefined ? <strong className={kyc.faceMatchScore >= 75 ? 'text-success' : 'text-warning'}>{kyc.faceMatchScore}/100</strong> : <em className="text-muted-foreground">—</em>}</span>
                </li>
                <li className="flex items-center justify-between"><span>Photo analysis</span>
                  <span>{kyc?.photoAnalysis ? (
                    <strong className={kyc.photoAnalysis.isRealPerson ? 'text-success' : 'text-destructive'}>
                      {kyc.photoAnalysis.isRealPerson ? 'Real' : 'Suspicious'} ({kyc.photoAnalysis.confidenceScore.toFixed(1)})
                    </strong>
                  ) : <em className="text-muted-foreground">—</em>}</span>
                </li>
              </ul>
              {kyc?.expiresAt && <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">Expires {fmt(kyc.expiresAt)}</p>}
            </div>

            {/* Risk factors */}
            {kyc?.riskFactors && kyc.riskFactors.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Risk factors</h3>
                <ul className="space-y-1">
                  {kyc.riskFactors.map((f) => (
                    <li key={f.code} className="flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{f.code.replace(/_/g, ' ')}</p>
                        <p className="text-muted-foreground">{f.detail}</p>
                      </div>
                      <span className={`shrink-0 font-mono font-semibold ${f.impact > 0 ? 'text-success' : 'text-destructive'}`}>
                        {f.impact > 0 ? '+' : ''}{f.impact}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Flags */}
            {(kyc?.duplicateFlag || kyc?.sanctionsHit || (kyc?.attemptCount ?? 0) >= 3) && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-warning">Flags raised</h3>
                {kyc?.duplicateFlag && <p className="text-xs text-foreground"><strong>Duplicate device:</strong> {kyc.duplicateReason}</p>}
                {kyc?.sanctionsHit && <p className="text-xs text-destructive"><strong>Sanctions hit</strong> on lists: {kyc.sanctionsLists?.join(', ') ?? '—'}</p>}
                {(kyc?.attemptCount ?? 0) >= 3 && <p className="text-xs text-foreground"><strong>{kyc?.attemptCount} attempts</strong> within rate-limit window</p>}
                {kyc?.lockedUntil && <p className="text-xs text-destructive"><strong>Locked until:</strong> {fmt(kyc.lockedUntil)}</p>}
              </div>
            )}

            {/* Documents */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Documents ({documents.length})</h3>
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No supplementary documents uploaded.</p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.documentType.replace(/_/g, ' ').toLowerCase()}</p>
                        {d.documentLast4 && <p className="text-[11px] font-mono text-muted-foreground">****{d.documentLast4}</p>}
                        <p className="text-[11px] text-muted-foreground">{fmt(d.uploadedAt)}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        d.status === 'VERIFIED' ? 'bg-success/10 text-success' :
                        d.status === 'REJECTED' ? 'bg-destructive/10 text-destructive' :
                                                  'bg-muted/40 text-muted-foreground'
                      }`}>{d.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Appeals */}
            {appeals.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Appeals ({appeals.length})</h3>
                {appeals.map((a) => (
                  <KycAppealResolver key={a.id} appeal={a} />
                ))}
              </div>
            )}

            {/* Audit timeline */}
            <AuditTimeline entries={auditTrail} />
          </div>

          {/* Right column — actions */}
          <aside className="space-y-4">
            <KycActionsPanel profileId={profile.id} status={profile.verificationStatus} />
          </aside>
        </div>
      </div>
    </main>
  );
}
