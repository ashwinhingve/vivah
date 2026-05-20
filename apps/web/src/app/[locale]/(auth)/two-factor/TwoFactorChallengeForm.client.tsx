'use client';

import { useState, useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;

export default function TwoFactorChallengeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [backup, setBackup] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { if (mode === 'totp') inputRefs.current[0]?.focus(); }, [mode]);

  const submitTotp = async (code: string) => {
    setLoading(true); setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
      });
      if (result.error) {
        setError(result.error.message ?? 'Wrong code');
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }
      router.replace('/dashboard');
    } finally { setLoading(false); }
  };

  const submitBackup = async () => {
    if (backup.trim().length < 6) { setError('Enter a backup code'); return; }
    setLoading(true); setError(null);
    try {
      const result = await authClient.twoFactor.verifyBackupCode({
        code: backup.trim(),
        trustDevice,
      });
      if (result.error) {
        setError(result.error.message ?? 'Wrong backup code');
        return;
      }
      router.replace('/dashboard');
    } finally { setLoading(false); }
  };

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (digit && next.every((d) => d !== '')) void submitTotp(next.join(''));
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i] ?? '';
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    if (pasted.length === OTP_LENGTH) void submitTotp(pasted);
  }

  return (
    <div className="relative w-full max-w-sm space-y-6 rounded-2xl border border-gold/25 bg-surface/92 p-8 shadow-xl shadow-primary/5 backdrop-blur-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-teal/15 blur-3xl"
      />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-teal">
          <ShieldCheck className="h-3 w-3" />
          Verify
        </span>
        <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight text-primary">
          Two-factor required
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'totp'
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter one of your saved backup codes. Each code works once.'}
        </p>
      </div>

      {mode === 'totp' ? (
        <div className="flex gap-2 justify-between">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={loading}
              className={cn(
                'h-14 w-11 rounded-lg border-2 bg-surface text-center font-heading text-xl font-bold text-foreground shadow-sm transition-all',
                'focus:outline-none focus:ring-2 focus:ring-teal/30 focus:-translate-y-0.5',
                'disabled:opacity-60',
                digit ? 'border-teal bg-teal/5 shadow-md shadow-teal/10' : 'border-border',
              )}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="backup">Backup code</Label>
          <Input
            id="backup"
            type="text"
            value={backup}
            onChange={(e) => setBackup(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            disabled={loading}
            autoComplete="one-time-code"
          />
        </div>
      )}

      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}

      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        Trust this device for 60 days
      </label>

      {mode === 'backup' ? (
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => { void submitBackup(); }}
          disabled={loading || backup.length < 6}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Verify backup code
        </Button>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-teal hover:text-teal-hover"
        onClick={() => { setMode((m) => (m === 'totp' ? 'backup' : 'totp')); setError(null); }}
      >
        <KeyRound className="h-3 w-3" />
        {mode === 'totp' ? 'Use a backup code instead' : 'Use authenticator app instead'}
      </button>
    </div>
  );
}
