import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { UiPreview } from './UiPreview.client';

export const metadata: Metadata = {
  title: 'UI Preview — Smart Shaadi',
  robots: { index: false, follow: false },
};

/**
 * Visual QA surface for the UI overhaul sprint (Days 2–7). Dev/preview only —
 * 404s in production so it never ships to users.
 */
export default function UiPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UiPreview />;
}
