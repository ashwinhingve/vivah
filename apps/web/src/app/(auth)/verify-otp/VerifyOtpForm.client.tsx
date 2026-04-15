'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

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
    <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6 space-y-6">
      <div>
        <h2
          className="text-2xl font-semibold text-[#7B2D42]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Enter OTP
        </h2>
        <p className="text-sm text-[#6B6B76] mt-1">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-[#2E2E38]">{maskedPhone}</span>
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
            className={[
              'w-11 h-12 text-center text-lg font-semibold rounded-lg border',
              'focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40',
              'disabled:opacity-60 bg-white transition-colors',
              digit
                ? 'border-[#0E7C7B] text-[#2E2E38]'
                : 'border-[#C5A47E]/40 text-[#2E2E38]',
            ].join(' ')}
          />
        ))}
      </div>

      {error && <p className="text-xs text-[#DC2626]">{error}</p>}

      <button
        type="button"
        onClick={() => { void submitOtp(digits.join('')); }}
        disabled={loading || digits.some((d) => !d)}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Verifying…
          </>
        ) : (
          'Verify OTP'
        )}
      </button>

      <p className="text-center text-sm text-[#6B6B76]">
        {secondsLeft > 0 ? (
          <>Resend OTP in <span className="font-medium text-[#2E2E38]">{secondsLeft}s</span></>
        ) : (
          <button
            type="button"
            onClick={() => { void handleResend(); }}
            disabled={resending}
            className="font-medium text-[#0E7C7B] hover:text-[#149998] disabled:opacity-60 transition-colors"
          >
            {resending ? 'Sending…' : 'Resend OTP'}
          </button>
        )}
      </p>
    </div>
  );
}
