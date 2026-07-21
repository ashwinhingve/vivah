import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Users, ShieldCheck, Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { WelcomeCta } from './WelcomeCta.client';

export const dynamic = 'force-dynamic';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileResp {
  name?: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'welcome.metadata' });
  return { title: t('title') };
}

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

const CARD_KEYS = ['community', 'privacy', 'notifications'] as const;

const CARD_ICONS: Record<(typeof CARD_KEYS)[number], typeof Users> = {
  community: Users,
  privacy: ShieldCheck,
  notifications: Bell,
};

const CARD_TEXT_KEYS: Record<(typeof CARD_KEYS)[number], { title: string; body: string }> = {
  community:     { title: 'cards.community.title',     body: 'cards.community.body' },
  privacy:       { title: 'cards.privacy.title',       body: 'cards.privacy.body' },
  notifications: { title: 'cards.notifications.title', body: 'cards.notifications.body' },
};

export default async function WelcomePage() {
  const c = await cookies();
  const token = c.get('better-auth.session_token')?.value ?? '';
  const firstName = await fetchProfileName(token);
  const t = await getTranslations('welcome');

  const greeting = firstName
    ? t('greeting', { firstName })
    : t('greetingDefault');

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <PageHeader
          title={greeting}
          subtitle={t('subtitle')}
          className="text-center"
        />

        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {CARD_KEYS.map((key) => {
            const Icon = CARD_ICONS[key];
            return (
              <li key={key}>
                <Card className="flex h-full flex-col items-start gap-3 border-gold/25 p-5 shadow-card">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold-muted">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-heading text-base font-semibold text-primary">{t(CARD_TEXT_KEYS[key].title)}</h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t(CARD_TEXT_KEYS[key].body)}</p>
                </Card>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 flex flex-col items-center gap-3">
          <WelcomeCta />
          <p className="text-xs text-muted-foreground">
            {t('supportFooter')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('launchTagline')}
          </p>
        </div>
      </div>
    </main>
  );
}
