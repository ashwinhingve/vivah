'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound, Smartphone, History, Trash2, ShieldCheck, ShieldOff,
  AlertTriangle, Monitor, X, Loader2, Phone, RefreshCw,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface OverviewResponse {
  account: {
    phoneNumber: string | null;
    phoneNumberVerified: boolean;
    email: string | null;
    emailVerified: boolean;
    memberSince: string;
    deletionRequestedAt: string | null;
  };
  twoFactor: { enabled: boolean };
  sessions: { active: number };
  lastActivity: { type: string; createdAt: string } | null;
}

interface SessionRow {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface EventRow {
  id: string;
  type: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const u = ua.toLowerCase();
  let os = 'Unknown';
  if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os')) os = 'macOS';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad')) os = 'iOS';
  else if (u.includes('linux')) os = 'Linux';
  let browser = 'Browser';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('chrome/')) browser = 'Chrome';
  else if (u.includes('firefox/')) browser = 'Firefox';
  else if (u.includes('safari/') && !u.includes('chrome/')) browser = 'Safari';
  return `${browser} on ${os}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const EVENT_LABELS: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' | 'info' }> = {
  LOGIN_SUCCESS:               { label: 'Sign-in',                  tone: 'good' },
  LOGIN_FAILED:                { label: 'Failed sign-in',           tone: 'bad'  },
  OTP_SENT:                    { label: 'OTP sent',                 tone: 'info' },
  OTP_VERIFIED:                { label: 'OTP verified',             tone: 'good' },
  OTP_FAILED:                  { label: 'Wrong OTP entered',        tone: 'warn' },
  OTP_LOCKED:                  { label: 'OTP locked',               tone: 'bad'  },
  LOGOUT:                      { label: 'Signed out',               tone: 'info' },
  SESSION_REVOKED:             { label: 'Device removed',           tone: 'info' },
  ROLE_CHANGED:                { label: 'Role changed',             tone: 'info' },
  PHONE_CHANGED:               { label: 'Phone number changed',     tone: 'warn' },
  EMAIL_CHANGED:               { label: 'Email changed',            tone: 'warn' },
  MFA_ENABLED:                 { label: 'Two-factor enabled',       tone: 'good' },
  MFA_DISABLED:                { label: 'Two-factor disabled',      tone: 'warn' },
  MFA_VERIFIED:                { label: 'Two-factor verified',      tone: 'good' },
  MFA_FAILED:                  { label: 'Two-factor failed',        tone: 'bad'  },
  MFA_BACKUP_USED:             { label: 'Backup code used',         tone: 'warn' },
  ACCOUNT_DELETION_REQUESTED:  { label: 'Account deletion started', tone: 'bad'  },
  ACCOUNT_DELETED:             { label: 'Account deleted',          tone: 'bad'  },
  ACCOUNT_RESTORED:            { label: 'Account restored',         tone: 'good' },
  ACCOUNT_REGISTERED:          { label: 'Account created',          tone: 'good' },
  NEW_DEVICE_LOGIN:            { label: 'Sign-in from new device',  tone: 'warn' },
  PASSWORD_CHANGED:            { label: 'Password changed',         tone: 'info' },
};

interface Props {
  overview: OverviewResponse | null;
  sessions: SessionRow[];
  events: EventRow[];
}

export function SecurityDashboard({ overview, sessions, events }: Props) {
  return (
    <div className="space-y-6">
      {overview?.account.deletionRequestedAt ? (
        <PendingDeletionBanner deletionRequestedAt={overview.account.deletionRequestedAt} />
      ) : null}

      <OverviewCard overview={overview} />

      <TwoFactorCard enabled={overview?.twoFactor.enabled ?? false} />

      <SessionsCard initialSessions={sessions} />

      <ChangePhoneCard currentPhone={overview?.account.phoneNumber ?? null} />

      <ActivityCard events={events} />

      <DangerZoneCard
        deletionRequestedAt={overview?.account.deletionRequestedAt ?? null}
      />
    </div>
  );
}

// ── Pending deletion banner ─────────────────────────────────────────────────

function PendingDeletionBanner({ deletionRequestedAt }: { deletionRequestedAt: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const grace = new Date(deletionRequestedAt);
  grace.setDate(grace.getDate() + 30);
  const daysLeft = Math.max(0, Math.ceil((grace.getTime() - Date.now()) / 86_400_000));

  const restore = () => {
    start(async () => {
      const res = await fetch(`${API_URL}/api/v1/me/account/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-destructive">Account scheduled for deletion</h3>
          <p className="text-sm text-foreground/80 mt-0.5">
            Your data will be permanently removed in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}. Restore your account
            to keep matches, conversations, and bookings.
          </p>
          <Button
            type="button" size="sm" className="mt-3" onClick={restore} disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Restore account
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Overview card ───────────────────────────────────────────────────────────

function OverviewCard({ overview }: { overview: OverviewResponse | null }) {
  if (!overview) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Could not load account details.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground">Account</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Row label="Phone number" value={overview.account.phoneNumber ?? '—'} verified={overview.account.phoneNumberVerified} />
        <Row label="Email"        value={overview.account.email ?? 'Not set'}     verified={overview.account.emailVerified} />
        <Row label="Member since" value={formatDate(overview.account.memberSince)} />
        <Row label="Active devices" value={`${overview.sessions.active}`} />
      </dl>
    </Card>
  );
}

function Row({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground flex items-center gap-1.5">
        {value}
        {verified !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              verified ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
            )}
          >
            {verified ? 'Verified' : 'Unverified'}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

// ── Two-factor card ─────────────────────────────────────────────────────────

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full',
          enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
        )}>
          {enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-foreground">Two-factor authentication</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {enabled
                  ? 'Active. A 6-digit code from your authenticator app is required at sign-in.'
                  : 'Add a second step beyond your phone OTP for account take-over protection.'}
              </p>
            </div>
            <Button asChild size="sm" variant={enabled ? 'outline' : 'default'}>
              <a href="/settings/security/two-factor">{enabled ? 'Manage' : 'Enable'}</a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Sessions card ───────────────────────────────────────────────────────────

function SessionsCard({ initialSessions }: { initialSessions: SessionRow[] }) {
  const [items, setItems] = useState(initialSessions);
  const [busy, setBusy] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const revoke = async (token: string) => {
    setBusy(token);
    try {
      const res = await fetch(`${API_URL}/api/v1/me/sessions/${encodeURIComponent(token)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) setItems((prev) => prev.filter((s) => s.token !== token));
    } finally {
      setBusy(null);
    }
  };

  const revokeAllOthers = async () => {
    setRevokingAll(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/me/sessions`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) setItems((prev) => prev.filter((s) => s.isCurrent));
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            Active sessions
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Devices that are currently signed in. Revoke any you don&apos;t recognise.
          </p>
        </div>
        {items.length > 1 ? (
          <Button
            type="button" size="sm" variant="outline" onClick={revokeAllOthers}
            disabled={revokingAll}
          >
            {revokingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign out other devices
          </Button>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No active sessions.</li>
        ) : null}
        {items.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">
                {deviceLabel(s.userAgent)}
                {s.isCurrent ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {s.ipAddress ?? 'Unknown IP'} · last seen {relativeTime(s.createdAt)}
              </p>
            </div>
            {!s.isCurrent ? (
              <Button
                type="button" size="sm" variant="ghost"
                onClick={() => { void revoke(s.token); }}
                disabled={busy === s.token}
                aria-label="Revoke session"
              >
                {busy === s.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Phone change card ───────────────────────────────────────────────────────

function ChangePhoneCard({ currentPhone }: { currentPhone: string | null }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'enter-phone' | 'enter-code'>('enter-phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const startChange = async () => {
    setError(null);
    const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    if (!/^\+91[6-9]\d{9}$/.test(e164)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/me/phone/change/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPhone: e164 }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) { setError(body.error?.message ?? 'Could not send code'); return; }
      setStage('enter-code');
    } finally { setBusy(false); }
  };

  const confirmChange = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/me/phone/change/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) { setError(body.error?.message ?? 'Wrong code'); return; }
      setSuccess(true);
      setTimeout(() => { router.refresh(); }, 800);
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Phone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-foreground">Phone number</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Currently {currentPhone ?? 'not set'}.
              </p>
            </div>
            {!open ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                Change number
              </Button>
            ) : null}
          </div>

          {open ? (
            <div className="mt-4 space-y-3">
              {stage === 'enter-phone' ? (
                <>
                  <Label htmlFor="newPhone" className="text-sm">New mobile number</Label>
                  <div className="flex">
                    <span className="inline-flex select-none items-center rounded-l-lg border border-r-0 border-border bg-surface-muted px-3 text-sm font-semibold text-muted-foreground">
                      +91
                    </span>
                    <Input
                      id="newPhone" type="tel" inputMode="numeric" maxLength={10}
                      value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="98765 43210"
                      className="rounded-l-none"
                    />
                  </div>
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => { void startChange(); }} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Send OTP
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Label htmlFor="otp" className="text-sm">6-digit code sent to your new number</Label>
                  <Input
                    id="otp" inputMode="numeric" maxLength={6}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                  {success ? <p className="text-xs text-success">Phone updated.</p> : null}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => { void confirmChange(); }} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Confirm
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setStage('enter-phone')}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Resend
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// ── Activity feed ───────────────────────────────────────────────────────────

function ActivityCard({ events }: { events: EventRow[] }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        Recent activity
      </h2>
      <p className="text-sm text-muted-foreground mt-0.5">
        Last {events.length} security events on this account.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {events.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">No activity yet.</li>
        ) : null}
        {events.map((e) => {
          const meta = EVENT_LABELS[e.type] ?? { label: e.type, tone: 'info' as const };
          return (
            <li key={e.id} className="flex items-start gap-3 py-3">
              <span
                className={cn(
                  'mt-1 h-2 w-2 flex-none rounded-full',
                  meta.tone === 'good' && 'bg-success',
                  meta.tone === 'warn' && 'bg-warning',
                  meta.tone === 'bad' && 'bg-destructive',
                  meta.tone === 'info' && 'bg-muted-foreground',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{meta.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(e.createdAt)} · {e.ipAddress ?? 'unknown IP'} · {deviceLabel(e.userAgent)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Danger zone ─────────────────────────────────────────────────────────────

function DangerZoneCard({ deletionRequestedAt }: { deletionRequestedAt: string | null }) {
  if (deletionRequestedAt) return null;
  const [confirmText, setConfirmText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete my account') {
      setError('Type "delete my account" to confirm');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/me/account/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Failed');
        return;
      }
      // Sign out everywhere — redirect to a recovery landing.
      await authClient.signOut().catch(() => {});
      router.replace('/account/deleted');
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-destructive/30">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-destructive">Delete account</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Permanently removes your matches, chats, bookings, and profile after a 30-day grace
            window. You can sign in within 30 days to undo.
          </p>
          {!open ? (
            <Button
              type="button" size="sm" variant="outline" className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={() => setOpen(true)}
            >
              Begin deletion
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <Label htmlFor="confirm" className="text-sm font-medium">
                Type <span className="font-mono">delete my account</span> to confirm
              </Label>
              <Input
                id="confirm" type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete my account"
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button" size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => { void submit(); }}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Permanently delete
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Card primitive ──────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn(
      'rounded-xl border border-border bg-surface p-5 shadow-sm',
      className,
    )}>
      {children}
    </section>
  );
}

// keep KeyRound + Smartphone imported for future MFA-related cards
void KeyRound;
void Smartphone;
