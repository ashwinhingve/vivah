'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, User, Users, Store, ClipboardCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { UserRole } from '@smartshaadi/types';

const ROLES: { value: UserRole; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'INDIVIDUAL',        label: 'Individual',        description: 'Looking for a life partner',    icon: User },
  { value: 'FAMILY_MEMBER',     label: 'Family Member',     description: 'Searching on behalf of family', icon: Users },
  { value: 'VENDOR',            label: 'Vendor',            description: 'Photographer, caterer & more',  icon: Store },
  { value: 'EVENT_COORDINATOR', label: 'Event Coordinator', description: 'Managing wedding events',       icon: ClipboardCheck },
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

    router.push(
      `/verify-otp?phone=${encodeURIComponent(e164)}&name=${encodeURIComponent(trimmedName)}&role=${role}`,
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-sm space-y-6 rounded-2xl border border-gold/25 bg-surface/92 p-8 shadow-xl shadow-primary/5 backdrop-blur-md"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-gold/20 blur-3xl"
      />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Join us
        </span>
        <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight text-primary">
          Create account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Join Smart Shaadi — India&apos;s smart marriage ecosystem.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-sm">Full name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Rahul Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-sm">Mobile number</Label>
        <div className="flex">
          <span className="inline-flex select-none items-center rounded-l-lg border border-r-0 border-border bg-surface-muted px-3 text-sm font-semibold text-muted-foreground">
            +91
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            required
            className="rounded-l-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">I am a…</p>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => {
            const isSelected = role === r.value;
            const Icon = r.icon;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                aria-pressed={isSelected}
                className={cn(
                  'group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected
                    ? 'border-teal bg-teal/5 ring-2 ring-teal/20 shadow-sm'
                    : 'border-border bg-surface hover:-translate-y-0.5 hover:border-gold hover:shadow-sm'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                    isSelected ? 'bg-teal text-white' : 'bg-gold/15 text-gold-muted group-hover:bg-teal/10 group-hover:text-teal'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className={cn('text-sm font-semibold leading-tight', isSelected ? 'text-teal' : 'text-foreground')}>
                  {r.label}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {r.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      ) : null}

      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending OTP…
          </>
        ) : (
          'Send OTP'
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already registered?{' '}
        <a href="/login" className="font-semibold text-teal underline-offset-4 hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
