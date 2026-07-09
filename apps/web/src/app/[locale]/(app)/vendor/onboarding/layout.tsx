import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

export default async function VendorOnboardingLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('vendorRole.onboarding');
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-primary sm:text-[28px]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </header>
      {children}
    </main>
  );
}
