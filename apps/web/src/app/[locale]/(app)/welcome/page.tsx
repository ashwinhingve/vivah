import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Users, ShieldCheck, Bell, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { markWelcomeSeen } from './actions';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileResp {
  name?: string | null;
}

export const metadata: Metadata = {
  title: 'Welcome — Smart Shaadi',
};

function getDisplayName(raw: string | null | undefined): string | null {
  const first = raw?.trim()?.split(/\s+/)[0];
  if (!first) return null;
  if (/^\+?\d[\d\s-]{6,}$/.test(first)) return null;
  return first;
}

async function fetchProfileName(token: string): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/profiles/me`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: ProfileResp };
    return json.success ? getDisplayName(json.data?.name) : null;
  } catch {
    return null;
  }
}

const CARDS = [
  {
    Icon: Users,
    title: 'Matches grow with our community',
    body: "We're growing carefully — quality over quantity. Your match feed will refresh daily as more verified profiles join.",
  },
  {
    Icon: ShieldCheck,
    title: 'Privacy by default',
    body: 'Your photos and contact details stay private until both sides show genuine interest. Family members can co-review without exposure.',
  },
  {
    Icon: Bell,
    title: 'Get notified instantly',
    body: 'When new compatible profiles join, we will notify you. Add your horoscope to unlock Guna Milan compatibility scoring.',
  },
] as const;

export default async function WelcomePage() {
  const c = await cookies();
  const token = c.get('better-auth.session_token')?.value ?? '';
  const firstName = await fetchProfileName(token);
  const t = await getTranslations('welcome');

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <header className="text-center">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-primary">
            {firstName ? `Welcome, ${firstName}` : 'Welcome to Smart Shaadi'} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            You&rsquo;re among our founding members. Here&rsquo;s what to expect.
          </p>
        </header>

        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {CARDS.map(({ Icon, title, body }) => (
            <li key={title}>
              <Card className="flex h-full flex-col items-start gap-3 border-gold/25 p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold-muted">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="font-heading text-base font-semibold text-primary">{title}</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
              </Card>
            </li>
          ))}
        </ul>

        <form action={markWelcomeSeen} className="mt-10 flex flex-col items-center gap-3">
          <Button type="submit" size="lg">
            Take me to my matches
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('supportFooter')}
          </p>
          <p className="text-xs text-muted-foreground">
            Smart Shaadi launched May 2026 · Building India&rsquo;s most thoughtful matrimony
          </p>
        </form>
      </div>
    </main>
  );
}
