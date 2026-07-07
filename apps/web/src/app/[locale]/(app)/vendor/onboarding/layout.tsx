import type { ReactNode } from 'react';

export default function VendorOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-primary sm:text-[28px]">
          Vendor onboarding
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete each step, then submit your profile for review.
        </p>
      </header>
      {children}
    </main>
  );
}
