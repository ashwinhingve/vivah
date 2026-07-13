import { SearchX } from 'lucide-react';

/**
 * Root 404 — renders OUTSIDE the [locale] segment, so it has no next-intl
 * context. Must stay free of next-intl components (i18n Link, useTranslations,
 * EmptyState which imports i18n Link) or it throws at request time → 500.
 * Normal unknown paths are caught by [locale]/[...rest] and render the
 * localized [locale]/not-found.tsx instead; this is the locale-less fallback.
 */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4"
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
          <SearchX className="h-7 w-7 text-gold-muted" aria-hidden="true" />
        </div>
        <h1 className="mb-2 font-heading text-2xl font-semibold text-primary">
          Page not found
        </h1>
        <p className="mb-6 text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>
        <a
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
        >
          Back to dashboard
        </a>
      </div>
    </main>
  );
}
