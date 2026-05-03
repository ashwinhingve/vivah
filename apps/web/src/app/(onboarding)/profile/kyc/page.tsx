import { cookies } from 'next/headers';
import Link from 'next/link';
import { KycInitiateButton } from './KycInitiateButton.client';
import { PanVerifyCard } from './PanVerifyCard.client';
import { BankVerifyCard } from './BankVerifyCard.client';
import { LivenessCapture } from './LivenessCapture.client';
import { DocumentUpload } from './DocumentUpload.client';
import { AppealForm } from './AppealForm.client';
import { ReverifyBanner } from './ReverifyBanner.client';
import { LevelTierCards } from './LevelTierCards';
import { AuditTimeline } from './AuditTimeline';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type KycLevel = 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ELITE';

type KycVerificationStatus =
  | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW'
  | 'EXPIRED' | 'LOCKED' | 'INFO_REQUESTED';

interface KycStatus {
  verificationStatus: KycVerificationStatus;
  verificationLevel:  KycLevel;
  aadhaarVerified:    boolean;
  panVerified:        boolean;
  bankVerified:       boolean;
  livenessScore:      number | null;
  faceMatchScore:     number | null;
  riskScore:          number | null;
  expiresAt:          string | null;
  attemptCount:       number;
  lockedUntil:        string | null;
  duplicateFlag:      boolean;
  photoAnalysis:      { isRealPerson: boolean; confidenceScore: number } | null;
  adminNote:          string | null;
}

interface LevelGap { level: KycLevel; unlocked: boolean; missing: string[]; features: string[] }
interface LevelData { current: KycLevel; levels: LevelGap[] }
interface AuditEntry {
  id: string; eventType: string; actorRole: string | null;
  fromStatus: string | null; toStatus: string | null;
  fromLevel: string | null; toLevel: string | null;
  metadata: Record<string, unknown> | null; createdAt: string;
}
interface DocSummary {
  documentType: string; status: string; documentLast4: string | null;
  uploadedAt: string; rejectionReason: string | null;
}

const FALLBACK_STATUS: KycStatus = {
  verificationStatus: 'PENDING',
  verificationLevel:  'NONE',
  aadhaarVerified:    false,
  panVerified:        false,
  bankVerified:       false,
  livenessScore:      null,
  faceMatchScore:     null,
  riskScore:          null,
  expiresAt:          null,
  attemptCount:       0,
  lockedUntil:        null,
  duplicateFlag:      false,
  photoAnalysis:      null,
  adminNote:          null,
};

async function fetchJson<T>(path: string, token: string | undefined, fallback: T): Promise<T> {
  if (!token) return fallback;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : fallback;
  } catch {
    return fallback;
  }
}

async function loadAll() {
  const token = (await cookies()).get('better-auth.session_token')?.value;
  const [status, level, audit, docs] = await Promise.all([
    fetchJson<KycStatus>('/api/v1/kyc/status',    token, FALLBACK_STATUS),
    fetchJson<LevelData>('/api/v1/kyc/level',     token, { current: 'NONE', levels: [] }),
    fetchJson<{ trail: AuditEntry[] }>('/api/v1/kyc/audit',   token, { trail: [] }),
    fetchJson<{ documents: DocSummary[] }>('/api/v1/kyc/documents', token, { documents: [] }),
  ]);
  return { status, level, audit: audit.trail, documents: docs.documents };
}

/* ─── Header ───────────────────────────────────────────── */
function StatusBadge({ status, level }: { status: KycVerificationStatus; level: KycLevel }) {
  const tone =
    status === 'VERIFIED'        ? 'success' :
    status === 'REJECTED'        ? 'destructive' :
    status === 'LOCKED'          ? 'destructive' :
    status === 'EXPIRED'         ? 'warning' :
    status === 'MANUAL_REVIEW'   ? 'warning' :
    status === 'INFO_REQUESTED'  ? 'warning' :
                                   'muted';
  const cls =
    tone === 'success'     ? 'bg-success/10 text-success border-success/20' :
    tone === 'destructive' ? 'bg-destructive/10 text-destructive border-destructive/20' :
    tone === 'warning'     ? 'bg-warning/10 text-warning border-warning/20' :
                             'bg-muted/30 text-muted-foreground border-border';
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {status.replace(/_/g, ' ')} · {level}
    </div>
  );
}

/* ─── Risk + signal grid ────────────────────────────────── */
function SignalGrid({ s }: { s: KycStatus }) {
  const items: { label: string; ok: boolean; detail?: string }[] = [
    { label: 'Aadhaar',    ok: s.aadhaarVerified },
    { label: 'PAN',        ok: s.panVerified },
    { label: 'Bank',       ok: s.bankVerified },
    { label: 'Liveness',   ok: (s.livenessScore ?? 0)  >= 70, detail: s.livenessScore  ? `${s.livenessScore}/100` : '—' },
    { label: 'Face match', ok: (s.faceMatchScore ?? 0) >= 75, detail: s.faceMatchScore ? `${s.faceMatchScore}/100` : '—' },
    { label: 'Photo real', ok: !!s.photoAnalysis?.isRealPerson },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Verification signals</h3>
        {s.riskScore !== null && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Trust score <strong className="text-foreground">{s.riskScore}/100</strong>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((it) => (
          <div key={it.label} className={`rounded-lg border px-3 py-2 ${
            it.ok ? 'border-success/30 bg-success/5' : 'border-border bg-background'
          }`}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.label}</p>
            <p className={`mt-0.5 text-sm font-semibold ${it.ok ? 'text-success' : 'text-muted-foreground'}`}>
              {it.ok ? 'Verified' : 'Pending'}
              {it.detail && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({it.detail})</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────── */
export default async function KycPage() {
  const { status, level, audit, documents } = await loadAll();
  const isVerified = status.verificationStatus === 'VERIFIED';
  const isRejected = status.verificationStatus === 'REJECTED';
  const isLocked   = status.verificationStatus === 'LOCKED';
  const isExpired  = status.verificationStatus === 'EXPIRED';
  const isInfoRequested = status.verificationStatus === 'INFO_REQUESTED';
  const isReview   = status.verificationStatus === 'MANUAL_REVIEW';

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-primary font-heading">Identity & Trust</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Build trust with families. Each tier you unlock boosts visibility and response rates.
            </p>
          </div>
          <StatusBadge status={status.verificationStatus} level={status.verificationLevel} />
        </div>

        {/* ── Top-of-page action banners ──────────────────────── */}
        {isVerified && <ReverifyBanner expiresAt={status.expiresAt} />}
        {isExpired && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm font-semibold text-warning">Your verification has expired</p>
            <p className="text-xs text-muted-foreground mt-1">Re-verify with Aadhaar to restore your trust badge.</p>
          </div>
        )}
        {isLocked && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Verification temporarily locked</p>
            <p className="text-xs text-muted-foreground mt-1">
              Too many attempts. {status.lockedUntil ? `Try again after ${new Date(status.lockedUntil).toLocaleString('en-IN')}.` : 'Try again in 24 hours.'}
            </p>
          </div>
        )}
        {isInfoRequested && status.adminNote && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm font-semibold text-warning">Reviewer requested more info</p>
            <p className="text-sm text-foreground mt-1">{status.adminNote}</p>
            <p className="text-xs text-muted-foreground mt-2">Add the requested documents below and we&apos;ll resume the review.</p>
          </div>
        )}
        {status.duplicateFlag && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-warning">Duplicate device detected</p>
              <p className="text-xs text-muted-foreground mt-0.5">A reviewer will manually verify before activating your badge.</p>
            </div>
          </div>
        )}

        {/* ── Tier ladder ─────────────────────────────────── */}
        {level.levels.length > 0 && <LevelTierCards current={level.current} levels={level.levels} />}

        {/* ── Signal grid ─────────────────────────────────── */}
        <SignalGrid s={status} />

        {/* ── Aadhaar action (if not verified) ───────────── */}
        {!status.aadhaarVerified && !isLocked && !isRejected && (
          <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Step 1 — Verify Aadhaar via DigiLocker</h3>
              <p className="text-xs text-muted-foreground mt-1">Required for the Basic tier. Aadhaar number is never stored.</p>
            </div>
            <KycInitiateButton />
          </div>
        )}

        {/* ── Liveness + face match (after Aadhaar) ──────── */}
        {status.aadhaarVerified && !isLocked && !isRejected && <LivenessCapture score={status.livenessScore} />}

        {/* ── PAN + Bank for Premium tier ────────────────── */}
        {status.aadhaarVerified && !isLocked && !isRejected && (
          <>
            <PanVerifyCard verified={status.panVerified} panLast4={null} />
            <BankVerifyCard verified={status.bankVerified} accountLast4={null} ifsc={null} />
          </>
        )}

        {/* ── Document upload ────────────────────────────── */}
        {!isLocked && !isRejected && <DocumentUpload documents={documents} />}

        {/* ── Appeal flow ─────────────────────────────────── */}
        {isRejected && (
          <>
            {status.adminNote && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Reason</p>
                <p className="text-sm text-foreground mt-1">{status.adminNote}</p>
              </div>
            )}
            <AppealForm />
          </>
        )}

        {/* ── Audit timeline ─────────────────────────────── */}
        <AuditTimeline entries={audit} />

        {/* ── Privacy footer ─────────────────────────────── */}
        <div className="rounded-xl border border-gold/30 bg-gold/5 px-5 py-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We never store your Aadhaar number, PAN, or bank account number. We persist only verification reference IDs and the last 4 digits where required for support.
            All checks pass through DigiLocker, NSDL, and Razorpay — your data stays with the source authorities.
          </p>
        </div>

        {isReview && (
          <div className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.09h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <p className="text-xs text-muted-foreground">
              Manual review usually completes within 24–48 hours. We&apos;ll notify you once a decision is made.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
