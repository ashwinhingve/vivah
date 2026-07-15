import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import { FadeUp } from '@/components/shared/FadeUp.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getProfileData() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/profiles/me`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

const SECTION_KEYS = [
  'personal', 'photos', 'family', 'career',
  'lifestyle', 'personality', 'horoscope', 'preferences',
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_HREFS: Record<string, string> = {
  personal:    '/profile/personal',
  photos:      '/profile/photos',
  family:      '/profile/family',
  career:      '/profile/career',
  lifestyle:   '/profile/lifestyle',
  personality: '/profile/personality',
  horoscope:   '/profile/horoscope',
  preferences: '/profile/preferences',
};

export default async function ProfileCompletePage() {
  const t = await getTranslations('profileGuide');
  const data = await getProfileData();
  const score = data?.profileCompleteness ?? 0;
  const sections = data?.sectionCompletion;

  const isGreat = score >= 70;

  // Find incomplete sections
  const incomplete: SectionKey[] = sections
    ? SECTION_KEYS.filter((key) => !sections[key])
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        {/* Score celebration */}
        <FadeUp>
          <div className="text-center">
            <div className="inline-flex items-center justify-center mb-3 p-3 rounded-full bg-gold/10">
              <Sparkles className="h-8 w-8 text-gold-muted" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl font-semibold text-primary">
              {isGreat ? t('greatHeadline') : t('almostHeadline')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isGreat ? t('greatSub') : t('almostSub')}
            </p>
            {/* Big score circle */}
            <div className="mt-6 mx-auto w-24 h-24 rounded-full border-4 border-teal flex flex-col items-center justify-center bg-surface shadow-sm">
              <span className="font-heading text-2xl font-bold text-teal">
                {score}%
              </span>
              <span className="text-xs text-muted-foreground">{t('completeWord')}</span>
            </div>
          </div>
        </FadeUp>

        {/* Completeness bar */}
        {sections && <CompletenessBar sections={sections} />}

        {/* Incomplete sections list */}
        {incomplete.length > 0 && (
          <div className="bg-surface rounded-2xl border border-gold/20 p-4 shadow-card">
            <h2 className="font-heading text-base font-semibold text-primary mb-3">
              {t('completeThese')}
            </h2>
            <ul className="space-y-1">
              {incomplete.map((key) => {
                const href = SECTION_HREFS[key] ?? '/dashboard';
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      className="group flex items-center justify-between gap-2 rounded-lg px-2 py-2 min-h-[44px] text-sm text-muted-foreground transition-colors hover:bg-gold/5 hover:text-primary focus:outline-none focus:ring-2 focus:ring-teal"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0 group-hover:border-teal transition-colors" />
                        {t(`sections.${key}` as 'sections.personal')}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center gap-2 bg-teal text-white font-semibold rounded-lg py-3 text-sm min-h-[48px] active:scale-[0.97] transition-transform hover:bg-teal-hover"
        >
          {t('goToDashboard')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
