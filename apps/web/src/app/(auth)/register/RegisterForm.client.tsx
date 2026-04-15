'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import type { UserRole } from '@smartshaadi/types';

const ROLES: { value: UserRole; label: string; description: string; icon: string }[] = [
  { value: 'INDIVIDUAL',        label: 'Individual',        description: 'Looking for a life partner',        icon: '👤' },
  { value: 'FAMILY_MEMBER',     label: 'Family Member',     description: 'Searching on behalf of family',     icon: '👨‍👩‍👧' },
  { value: 'VENDOR',            label: 'Vendor',            description: 'Photographer, caterer & more',      icon: '🎪' },
  { value: 'EVENT_COORDINATOR', label: 'Event Coordinator', description: 'Managing multiple wedding events',  icon: '📋' },
];

export default function RegisterForm() {
  const router = useRouter();

  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [role, setRole]       = useState<UserRole>('INDIVIDUAL');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Please enter your full name (at least 2 characters)');
      return;
    }

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

    // Pass name and role as query params so verify-otp page can finish registration
    router.push(
      `/verify-otp?phone=${encodeURIComponent(e164)}&name=${encodeURIComponent(trimmedName)}&role=${role}`,
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-[#C5A47E]/20 p-8 space-y-5"
    >
      <div>
        <h2
          className="text-2xl font-semibold text-[#7B2D42]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Create account
        </h2>
        <p className="text-sm text-[#6B6B76] mt-1">Join Smart Shaadi — India's smart marriage ecosystem</p>
      </div>

      {/* Full name */}
      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium text-[#2E2E38]">
          Full name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Rahul Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40 bg-white"
          required
        />
      </div>

      {/* Mobile number */}
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
      </div>

      {/* Role picker */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-[#2E2E38]">I am a…</p>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => {
            const isSelected = role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={[
                  'flex flex-col gap-1 rounded-xl border p-3 text-left transition-all',
                  isSelected
                    ? 'border-[#0E7C7B] bg-[#0E7C7B]/5 ring-2 ring-[#0E7C7B]/20'
                    : 'border-[#C5A47E]/40 hover:border-[#C5A47E]/70 bg-white',
                ].join(' ')}
              >
                <span className="text-lg leading-none">{r.icon}</span>
                <span className={`text-sm font-semibold ${isSelected ? 'text-[#0E7C7B]' : 'text-[#2E2E38]'}`}>
                  {r.label}
                </span>
                <span className="text-xs text-[#6B6B76] leading-tight">{r.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs text-[#DC2626]">{error}</p>}

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

      <p className="text-center text-xs text-[#6B6B76]">
        Already registered?{' '}
        <a href="/login" className="text-[#0E7C7B] hover:text-[#149998] font-medium">
          Sign in
        </a>
      </p>
    </form>
  );
}
