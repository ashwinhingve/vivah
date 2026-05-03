import { cookies } from 'next/headers';
import Link from 'next/link';
import { CompletenessBar } from '@/components/profile/CompletenessBar';

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

const SECTION_LABELS: Record<string, string> = {
  personal: 'Personal details',
  photos: 'Profile photos',
  family: 'Family information',
  career: 'Career & education',
  lifestyle: 'Lifestyle preferences',
  horoscope: 'Horoscope details',
  preferences: 'Partner preferences',
};

export default async function ProfileCompletePage() {
  const data = await getProfileData();
  const score = data?.profileCompleteness ?? 0;
  const sections = data?.sectionCompletion;

  const isGreat = score >= 70;

  // Find incomplete sections
  const incomplete = sections
    ? Object.entries(SECTION_LABELS)
      .filter(([key]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const k = key as any;
        return k !== 'score' && !sections[k];
      })
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        {/* Score celebration */}
        <div className="text-center">
          <div className="text-5xl mb-3">{isGreat ? '🎉' : '✨'}</div>
          <h1 className="font-heading text-2xl font-semibold text-primary">
            {isGreat ? 'Your profile is looking great!' : 'Almost there!'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isGreat
              ? 'Complete profiles get 3× more responses'
              : 'Complete a few more sections to attract better matches'}
          </p>
          {/* Big score circle */}
          <div className="mt-6 mx-auto w-24 h-24 rounded-full border-4 border-teal flex flex-col items-center justify-center bg-surface shadow-sm">
            <span className="font-heading text-2xl font-bold text-teal">
              {score}%
            </span>
            <span className="text-xs text-muted-foreground">complete</span>
          </div>
        </div>

        {/* Completeness bar */}
        {sections && <CompletenessBar sections={sections} />}

        {/* Incomplete sections list */}
        {incomplete.length > 0 && (
          <div className="bg-surface rounded-xl border border-border p-4">
            <h2 className="font-heading text-base font-semibold text-primary mb-3">
              Complete these sections
            </h2>
            <ul className="space-y-2">
              {incomplete.map(([key, label]) => (
                <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/dashboard"
          className="block w-full bg-teal text-white font-semibold rounded-lg py-3 text-sm text-center min-h-[48px] flex items-center justify-center active:scale-[0.97] transition-transform hover:bg-teal-hover"
        >
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
}
