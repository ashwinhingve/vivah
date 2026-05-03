'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldOff, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Stage = 'idle' | 'show-secret' | 'verify' | 'show-backup-codes' | 'enabled' | 'disabling';

interface Props { initialEnabled: boolean }

export function TwoFactorManager({ initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [stage, setStage] = useState<Stage>(initialEnabled ? 'enabled' : 'idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const startEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({ password: '' });
      if (result.error) {
        setError(result.error.message ?? 'Could not enable 2FA');
        return;
      }
      const data = result.data as { totpURI?: string; backupCodes?: string[] } | null;
      if (!data?.totpURI) {
        setError('Server did not return a TOTP URI');
        return;
      }
      setTotpUri(data.totpURI);
      setBackupCodes(data.backupCodes ?? []);
      setStage('show-secret');
    } finally { setBusy(false); }
  };

  const verifyFirstCode = async () => {
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code'); return; }
    setBusy(true); setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) { setError(result.error.message ?? 'Wrong code'); return; }
      setStage('show-backup-codes');
      setEnabled(true);
    } finally { setBusy(false); }
  };

  const disable = async (password: string) => {
    setBusy(true); setError(null);
    try {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) {
        setError(result.error.message ?? 'Could not disable 2FA');
        return;
      }
      setEnabled(false);
      setStage('idle');
      router.refresh();
    } finally { setBusy(false); }
  };

  const copyCodes = () => {
    void navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (stage === 'enabled' && enabled) {
    return <DisableCard onDisable={disable} busy={busy} error={error} />;
  }

  if (stage === 'idle') {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldOff className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">Set up an authenticator app</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Use Google Authenticator, 1Password, Authy, or any other TOTP app to generate
              the 6-digit codes. You&apos;ll need this code at sign-in alongside your phone OTP.
            </p>
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
            <Button type="button" className="mt-4" onClick={() => { void startEnable(); }} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Begin setup
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (stage === 'show-secret' && totpUri) {
    return (
      <Card>
        <h2 className="text-base font-semibold text-foreground">Step 1 — Scan this code</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Open your authenticator app and scan the QR code. Or enter the secret manually.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-muted p-6">
          <QrCode value={totpUri} />
          <ManualSecret uri={totpUri} />
        </div>
        <Button type="button" className="mt-4 w-full" onClick={() => setStage('verify')}>
          Next — enter code
        </Button>
      </Card>
    );
  }

  if (stage === 'verify') {
    return (
      <Card>
        <h2 className="text-base font-semibold text-foreground">Step 2 — Verify</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the 6-digit code your authenticator app shows now.
        </p>
        <div className="mt-4 space-y-3">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code" inputMode="numeric" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="text-center font-heading text-xl tracking-[0.4em]"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="button" className="w-full" onClick={() => { void verifyFirstCode(); }} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verify and enable
          </Button>
        </div>
      </Card>
    );
  }

  if (stage === 'show-backup-codes') {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">Two-factor enabled</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Save these <strong>backup codes</strong> in a safe place. Each can be used once if you lose
              access to your authenticator app.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-muted p-4 font-mono text-sm">
          {backupCodes.length === 0 ? (
            <p className="col-span-2 text-muted-foreground text-xs">No backup codes returned.</p>
          ) : null}
          {backupCodes.map((c, i) => (
            <span key={i} className="select-all text-foreground">{c}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copyCodes}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy all'}
          </Button>
          <Button type="button" size="sm" onClick={() => router.replace('/settings/security')}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}

// ── Disable card ────────────────────────────────────────────────────────────

function DisableCard({
  onDisable, busy, error,
}: {
  onDisable: (password: string) => Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">Two-factor is on</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your authenticator app generates a 6-digit code at sign-in. To remove this layer of
            protection you&apos;ll need to confirm.
          </p>
          {!confirm ? (
            <Button
              type="button" size="sm" variant="outline"
              className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={() => setConfirm(true)}
            >
              Disable two-factor
            </Button>
          ) : (
            <div className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <p className="text-xs text-foreground/80">
                  Removing 2FA makes account take-over easier. We recommend keeping it enabled.
                </p>
              </div>
              <Label htmlFor="password" className="text-xs">Password (leave empty if you don&apos;t have one)</Label>
              <Input
                id="password" type="password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button" size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => { void onDisable(password); }}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirm disable
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
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

// ── QR code (no extra dep — render via google chart fallback) ───────────────
// Better Auth returns an otpauth:// URI; we encode that as a QR via a lightweight
// image route. Using a public chart server keeps the bundle small. The URI
// contains the secret, so this image must NEVER be cached or stored — render
// from the client at request time.

function QrCode({ value }: { value: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}`;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      width={200}
      height={200}
      alt="Authenticator QR code"
      className="rounded-lg border border-border bg-surface p-1"
    />
  );
}

function ManualSecret({ uri }: { uri: string }) {
  // Extract `secret=` from otpauth:// for manual entry.
  const match = uri.match(/secret=([^&]+)/i);
  const secret = match?.[1] ?? '';
  const [copied, setCopied] = useState(false);
  if (!secret) return null;
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-mono',
        'hover:bg-surface-muted transition-colors',
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {secret}
    </button>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-border bg-surface p-5 shadow-sm', className)}>
      {children}
    </section>
  );
}
