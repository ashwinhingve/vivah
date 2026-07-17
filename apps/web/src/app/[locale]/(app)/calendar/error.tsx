'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[calendar] page error:', error);
  }, [error]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-2xl bg-surface border border-destructive/20 shadow-card p-8 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-heading font-bold text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mb-6">
          Failed to load the calendar. Please try again.
        </p>
        <Button onClick={reset} className="bg-primary text-white hover:bg-primary/90">
          Try again
        </Button>
      </div>
    </main>
  );
}
