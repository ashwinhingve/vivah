import { redirect } from '@/i18n/redirect';
import { cookies } from 'next/headers';
import { fetchAuth } from '@/lib/server-fetch';
import { PlatformSettingsForm } from './PlatformSettingsForm.client';

export const dynamic = 'force-dynamic';

interface PlatformSettingRow {
  key:        string;
  value:      unknown;
  updatedAt:  string;
  updatedBy:  string | null;
}

export default async function AdminPlatformSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) {
    return await redirect('/login');
  }

  const wrapped = await fetchAuth<{ settings: PlatformSettingRow[] }>(
    '/api/v1/admin/platform-settings',
  );
  const settings = wrapped?.settings ?? [];
  const lgbtqRow = settings.find((s) => s.key === 'lgbtq_matching_enabled');
  const lgbtqEnabled = lgbtqRow?.value === true;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-primary">Platform Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global feature toggles that affect every user.
        </p>
      </div>

      <PlatformSettingsForm
        lgbtqEnabled={lgbtqEnabled}
        lgbtqUpdatedAt={lgbtqRow?.updatedAt ?? null}
      />
    </div>
  );
}
