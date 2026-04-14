'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export default function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Normalise: strip spaces, ensure +91 prefix
    const normalised = phone.replace(/\s/g, '');
    const e164 = normalised.startsWith('+') ? normalised : `+91${normalised}`;

    if (!/^\+91[6-9]\d{9}$/.test(e164)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    const result = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });

    if (result.error) {
      setError(result.error.message ?? 'Failed to send OTP');
      setLoading(false);
      return;
    }

    router.push(`/verify-otp?phone=${encodeURIComponent(e164)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-6 space-y-5"
    >
      <div>
        <h2
          className="text-2xl font-semibold text-[#7B2D42]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Sign in
        </h2>
        <p className="text-sm text-[#6B6B76] mt-1">Enter your mobile number to receive an OTP</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="block text-sm font-medium text-[#2E2E38]">
          Mobile number
        </label>
        <div className="flex">
          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-[#C5A47E]/40 bg-[#FEFAF6] text-[#6B6B76] text-sm">
            +91
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            className="flex-1 min-h-[44px] rounded-r-lg border border-[#C5A47E]/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40 bg-white"
            required
          />
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-[44px] rounded-lg bg-[#0E7C7B] hover:bg-[#149998] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Sending OTP…
          </>
        ) : (
          'Send OTP'
        )}
      </button>
    </form>
  );
}
