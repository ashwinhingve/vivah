'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;
const COUNTDOWN_SECONDS = 60;

export default function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const submitOtp = useCallback(
    async (code: string) => {
      if (!phone) {
        setError('Phone number missing. Go back and try again.');
        return;
      }
      setError(null);
      setLoading(true);

      const result = await authClient.phoneNumber.verify({ phoneNumber: phone, code });

      if (result.error) {
        setError(result.error.message ?? 'Invalid or expired OTP');
        setLoading(false);
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        return;
      }

      // Check if user has a role set; if not, send to role selection
      const sessionResult = await authClient.getSession();
      const role = (sessionResult.data?.user as { role?: string } | undefined)?.role;

      if (!role || role === 'INDIVIDUAL') {
        router.push('/register/role');
      } else {
        router.push('/dashboard');
      }
    },
    [phone, router],
  );

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && next.every((d) => d !== '')) {
      void submitOtp(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i] ?? '';
    }
    setDigits(next);

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();

    if (pasted.length === OTP_LENGTH) {
      void submitOtp(pasted);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || !phone) return;
    setResending(true);
    setError(null);

    const result = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
    setResending(false);

    if (result.error) {
      setError(result.error.message ?? 'Failed to resend OTP');
      return;
    }

    setDigits(Array(OTP_LENGTH).fill(''));
    setSecondsLeft(COUNTDOWN_SECONDS);
    inputRefs.current[0]?.focus();
  }

  const maskedPhone = phone
    ? phone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, '$1 $2xxxxxx$3')
    : '';

  return (
    <div className="relative w-full max-w-sm space-y-6 rounded-2xl border border-gold/25 bg-surface/92 p-8 shadow-xl shadow-primary/5 backdrop-blur-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-teal/15 blur-3xl"
      />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-teal">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Verify
        </span>
        <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight text-primary">
          Enter OTP
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-foreground">{maskedPhone}</span>
        </p>
      </div>

      {/* 6-box OTP input */}
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
              digit ? 'border-teal bg-teal/5 shadow-md shadow-teal/10' : 'border-border'
            )}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      ) : null}

      <Button
        type="button"
        onClick={() => { void submitOtp(digits.join('')); }}
        disabled={loading || digits.some((d) => !d)}
        size="lg"
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Verifying…
          </>
        ) : (
          'Verify OTP'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {secondsLeft > 0 ? (
          <>Resend OTP in <span className="font-medium text-foreground">{secondsLeft}s</span></>
        ) : (
          <button
            type="button"
            onClick={() => { void handleResend(); }}
            disabled={resending}
            className="font-medium text-teal hover:text-teal-hover disabled:opacity-60 transition-colors"
          >
            {resending ? 'Sending…' : 'Resend OTP'}
          </button>
        )}
      </p>
    </div>
  );
}
