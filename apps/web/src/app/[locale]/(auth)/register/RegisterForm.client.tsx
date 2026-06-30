'use client';

import { useState, type FormEvent } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { track } from '@/lib/analytics';

export default function RegisterForm() {
  const t = useTranslations('auth.register');
  const router = useRouter();

  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError(t('errors.nameRequired'));
      return;
    }

    const normalised = phone.replace(/\s/g, '');
    const e164 = normalised.startsWith('+') ? normalised : `+91${normalised}`;

    if (!/^\+91[6-9]\d{9}$/.test(e164)) {
      setError(t('errors.invalidPhone'));
      return;
    }

    setLoading(true);
    track('register_started', {});

    const result = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });

    if (result.error) {
      setError(result.error.message ?? t('errors.sendFailed'));
      setLoading(false);
      return;
    }

    router.push(`/verify-otp?phone=${encodeURIComponent(e164)}`);
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
          {t('badge')}
        </span>
        <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight text-primary">
          {t('heading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('subtext')}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-sm">{t('nameLabel')}</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder={t('namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'register-error' : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-sm">{t('phoneLabel')}</Label>
        <div className="flex">
          <span className="inline-flex select-none items-center rounded-l-lg border border-r-0 border-border bg-surface-muted px-3 text-sm font-semibold text-muted-foreground">
            +91
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            required
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'register-error' : undefined}
            className="rounded-l-none"
          />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-gold-muted">
          <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t('reassurance')}
        </p>
      </div>

      {error ? (
        <p id="register-error" role="alert" className="text-xs text-destructive">{error}</p>
      ) : null}

      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('sending')}
          </>
        ) : (
          t('cta')
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {t('alreadyRegistered')}{' '}
        <Link href="/login" className="font-semibold text-teal underline-offset-4 hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </form>
  );
}
