/**
 * /onboarding/divorcee-widow — confidence-building onboarding page.
 *
 * Server Component: redirects if:
 *   - User is NEVER_MARRIED or SEPARATED (not the target audience)
 *   - User has already completed this onboarding journey
 *
 * Wraps the DivorceeWidowOnboarding client component for the actual UI.
 */

import { redirect } from '@/i18n/redirect';
import { cookies } from 'next/headers';
import { DivorceeWidowOnboarding } from '@/components/onboarding/DivorceeWidowOnboarding.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProfileMe {
  personal?: {
    maritalStatus?: string;
  };
  sections?: {
    divorceeOnboardingDone?: boolean;
  };
}

async function fetchMe(token: string): Promise<ProfileMe | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/profiles/me`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: ProfileMe };
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}

export default async function DivorceeWidowOnboardingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  if (!token) {
    return await redirect('/sign-in');
  }

  const me = await fetchMe(token);

  // If we can't load the profile, let the user through — don't block on API failure
  if (me !== null) {
    const maritalStatus = me.personal?.maritalStatus;
    const isDivorceeOrWidow =
      maritalStatus === 'DIVORCED' || maritalStatus === 'WIDOWED';

    // Redirect away if this page is not relevant
    if (!isDivorceeOrWidow) {
      return await redirect('/feed');
    }

    // Redirect if onboarding already completed
    if (me.sections?.divorceeOnboardingDone === true) {
      return await redirect('/feed');
    }
  }

  const maritalStatus = me?.personal?.maritalStatus ?? '';
  const isWidowed = maritalStatus === 'WIDOWED';

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-10">
        <DivorceeWidowOnboarding isWidowed={isWidowed} />
      </div>
    </main>
  );
}
