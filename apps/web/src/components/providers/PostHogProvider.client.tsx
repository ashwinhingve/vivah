'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

let initialized = false;

function initPostHog(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  const key = process.env['NEXT_PUBLIC_POSTHOG_KEY'];
  if (!key) return;
  posthog.init(key, {
    api_host: process.env['NEXT_PUBLIC_POSTHOG_HOST'] ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,    // we capture manually below to handle App Router transitions
    capture_pageleave: true,
    autocapture: false,
  });
  initialized = true;
}

// Reads search params — must live inside a Suspense boundary so static
// prerender of pages above this provider does not bail out.
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!initialized || typeof window === 'undefined') return;
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
