import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { BlocksList } from './BlocksList.client';

export default function BlockedProfilesPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <div>
          <Link href="/settings/privacy" className="text-xs text-muted-foreground hover:text-primary">
            ← Privacy &amp; Safety
          </Link>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive">
              <ShieldX className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-primary">Blocked profiles</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Blocked profiles can&apos;t see you, send requests, or message you.
              </p>
            </div>
          </div>
        </div>

        <BlocksList />
      </div>
    </main>
  );
}
