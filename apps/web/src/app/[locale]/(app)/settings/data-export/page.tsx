import type { Metadata } from 'next';
import { Database } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { DataExportPanel } from './DataExportPanel.client';
import type { ExportRequest } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your Data — Smart Shaadi' };

export default async function DataExportPage() {
  const exports = (await fetchAuth<ExportRequest[]>('/api/v1/gdpr/export/mine')) ?? [];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Database className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">Your data</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Export a copy of everything Smart Shaadi holds about you. This is your right under
              India’s data-protection law.
            </p>
          </div>
        </div>

        <DataExportPanel initial={exports} />

        <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-primary">Good to know</p>
          <ul className="mt-2 space-y-1.5 list-disc pl-5">
            <li>You can request one export per day. Preparing the archive can take a few minutes.</li>
            <li>The download link is private to you and expires after a short window for your security.</li>
            <li>Looking to delete your account instead? Visit <strong>Settings → Security</strong>.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
