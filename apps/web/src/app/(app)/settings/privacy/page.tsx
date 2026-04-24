import { cookies } from 'next/headers';
import { Shield } from 'lucide-react';
import { PrivacyToggles } from './PrivacyToggles.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface SafetyMode {
  photoHidden?:   boolean;
  contactHidden?: boolean;
  incognito?:     boolean;
}

async function fetchSafetyMode(token: string): Promise<SafetyMode> {
  try {
    const res = await fetch(`${API_URL}/api/v1/profiles/me/content`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { success: boolean; data?: { safetyMode?: SafetyMode } };
    return json.data?.safetyMode ?? {};
  } catch {
    return {};
  }
}

export default async function PrivacySettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const initial = await fetchSafetyMode(token);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">Privacy &amp; Safety</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You decide who sees your photo, contact, and activity.
            </p>
          </div>
        </div>

        <PrivacyToggles initial={initial} />

        <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-primary">How these work</p>
          <ul className="mt-2 space-y-1.5 list-disc pl-5">
            <li><strong>Photo hidden</strong> — your photo appears blurred on other people&apos;s feeds until you approve their request.</li>
            <li><strong>Contact hidden</strong> — your phone and email stay private until you accept a match.</li>
            <li><strong>Incognito</strong> — you still browse normally, but you do not appear in anyone else&apos;s match feed, and your profile visits are not logged.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
