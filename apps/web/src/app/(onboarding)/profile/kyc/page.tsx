import { cookies } from 'next/headers';
import Link from 'next/link';
import { KycInitiateButton } from './KycInitiateButton.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type KycStatusValue = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';

interface KycStatusData {
  status: KycStatusValue;
  note?: string;
  verifiedAt?: string;
  photoAnalysis?: {
    isRealPerson: boolean;
    confidenceScore: number;
    hasSunglasses: boolean;
    multipleFaces: boolean;
    analyzedAt: string;
  };
}

async function getKycStatus(): Promise<KycStatusData> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return { status: 'PENDING' };

  try {
    const res = await fetch(`${API_URL}/api/v1/kyc/status`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'PENDING' };
    const json = (await res.json()) as { success: boolean; data: KycStatusData };
    return json.success ? json.data : { status: 'PENDING' };
  } catch {
    return { status: 'PENDING' };
  }
}

/* ─── Pending State ─────────────────────────────────────── */
function PendingState() {
  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 to-teal/5 px-6 pt-8 pb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-border flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B6B76" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground font-heading">
            Verify Your Identity
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your Aadhaar via DigiLocker in under 2 minutes.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {/* Benefits */}
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-muted" aria-hidden="true">
            What you unlock
          </p>
          {[
            { icon: '★', text: '3× more profile responses from families' },
            { icon: '🛡', text: 'ID Verified badge on your profile' },
            { icon: '🔒', text: 'Trusted by families — no catfishing' },
            { icon: '✓', text: 'Priority placement in match recommendations' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-base w-6 text-center shrink-0" aria-hidden="true">{icon}</span>
              <span className="text-sm text-foreground">{text}</span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <KycInitiateButton />
        </div>
      </div>

      {/* Privacy note */}
      <div className="rounded-xl border border-gold/30 bg-gold/5 px-5 py-4 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9E7F5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your Aadhaar number is <strong className="text-foreground">never stored</strong> on our servers.
          We only receive a verification status from DigiLocker. Your data stays with the Government of India.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">How it works</h3>
        <ol className="space-y-4">
          {[
            { step: '1', title: 'Tap "Verify with Aadhaar"', desc: 'You will be redirected to the official DigiLocker portal.' },
            { step: '2', title: 'Log in to DigiLocker', desc: 'Use your Aadhaar number and OTP to authenticate.' },
            { step: '3', title: 'Authorise Smart Shaadi', desc: 'Allow us to receive your name and verification status only.' },
            { step: '4', title: 'Done — badge appears instantly', desc: 'Your ID Verified badge goes live immediately.' },
          ].map(({ step, title, desc }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-teal/10 text-teal text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="text-center">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          Skip for now
        </Link>
      </div>
    </div>
  );
}

/* ─── In Review State ───────────────────────────────────── */
function InReviewState() {
  return (
    <div className="space-y-5">
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-warning/5 to-transparent px-6 pt-8 pb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4 relative">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-warning/20 animate-ping" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground font-heading">
            Verification In Progress
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team is reviewing your details. Usually done within 24–48 hours.
          </p>
        </div>

        <div className="px-6 py-5">
          {/* Timeline */}
          <div className="space-y-0">
            {[
              { label: 'DigiLocker verified', done: true },
              { label: 'Document check', done: true },
              { label: 'Manual review by our team', active: true },
              { label: 'Badge activated', done: false },
            ].map(({ label, done, active }, i) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border-2 ${
                    done
                      ? 'bg-success border-success text-white'
                      : active
                      ? 'bg-surface border-warning text-warning'
                      : 'bg-surface border-border text-muted-foreground'
                  }`}>
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : active ? (
                      <span className="w-2 h-2 rounded-full bg-warning animate-pulse" aria-label="In progress" />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  {i < 3 && (
                    <div className={`w-0.5 h-6 ${done ? 'bg-success' : 'bg-border'}`} aria-hidden="true" />
                  )}
                </div>
                <p className={`text-sm pt-1 pb-5 ${done ? 'text-success font-medium' : active ? 'text-warning font-semibold' : 'text-muted-foreground'}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.09h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        <p className="text-xs text-muted-foreground">
          We&apos;ll send you a notification once verification is complete. No action needed from your side.
        </p>
      </div>

      <div className="text-center">
        <Link href="/dashboard" className="text-sm text-teal font-medium hover:text-teal-hover">
          Return to Dashboard →
        </Link>
      </div>
    </div>
  );
}

/* ─── Verified State ────────────────────────────────────── */
function VerifiedState({ verifiedAt }: { verifiedAt?: string }) {
  const date = verifiedAt
    ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(verifiedAt))
    : null;

  return (
    <div className="space-y-5">
      <div className="bg-surface rounded-xl border border-success/20 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-success/5 to-transparent px-6 pt-8 pb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-success font-heading">
            Identity Verified
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {date ? `Verified on ${date}` : 'Your identity has been confirmed.'}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Badge earned */}
          <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-success">ID Verified Badge</p>
              <p className="text-xs text-muted-foreground mt-0.5">Now visible on your profile to all families</p>
            </div>
          </div>

          {/* What's unlocked */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground">Unlocked for you</p>
            {[
              'Priority ranking in match recommendations',
              '3× higher response rate from families',
              'Contact info visible after mutual interest',
              'Access to verified-only match filters',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          <Link
            href="/dashboard"
            className="w-full inline-flex items-center justify-center bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-6 py-3 min-h-[48px] transition-colors"
          >
            View Your Matches →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Rejected State ────────────────────────────────────── */
function RejectedState({ note }: { note?: string }) {
  return (
    <div className="space-y-5">
      <div className="bg-surface rounded-xl border border-destructive/20 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-destructive/5 to-transparent px-6 pt-8 pb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground font-heading">
            Verification Unsuccessful
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We were unable to verify your identity at this time.
          </p>
        </div>

        {note && (
          <div className="mx-6 mb-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-semibold text-destructive mb-1">Reason from our team</p>
            <p className="text-sm text-foreground">{note}</p>
          </div>
        )}

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm font-medium text-foreground">Common reasons for rejection</p>
          {[
            'Name on Aadhaar does not match profile name',
            'DigiLocker session expired before authorisation',
            'Document could not be verified by DigiLocker',
          ].map((reason) => (
            <div key={reason} className="flex items-start gap-2.5">
              <span className="text-destructive mt-0.5 text-xs shrink-0">•</span>
              <span className="text-sm text-muted-foreground">{reason}</span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 space-y-3">
          <KycInitiateButton />
          <p className="text-center text-xs text-muted-foreground">
            Need help?{' '}
            <Link href="/support" className="text-teal underline-offset-2 hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────── */
export default async function KycPage() {
  const kyc = await getKycStatus();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Page heading */}
        <div className="mb-6">
          <h1
            className="text-2xl font-semibold text-primary font-heading"
                     >
            Identity Verification
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify your identity to build trust with families.
          </p>
        </div>

        {/* Status-based content */}
        {kyc.status === 'VERIFIED'   && <VerifiedState verifiedAt={kyc.verifiedAt} />}
        {kyc.status === 'IN_REVIEW'  && <InReviewState />}
        {kyc.status === 'REJECTED'   && <RejectedState note={kyc.note} />}
        {kyc.status === 'PENDING'    && <PendingState />}

      </div>
    </div>
  );
}
