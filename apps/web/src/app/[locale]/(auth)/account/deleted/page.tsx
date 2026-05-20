import type { Metadata } from 'next';
import Link from 'next/link';
import { Trash2, Clock, Phone } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account scheduled for deletion — Smart Shaadi' };

export default function AccountDeletedPage() {
  return (
    <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-gold/25 bg-surface/92 p-8 shadow-xl backdrop-blur-md">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-primary">
          Account scheduled for deletion
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ve received your deletion request. Your data will be permanently removed in 30
          days.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Changed your mind?</p>
            <p className="text-muted-foreground mt-1">
              Sign in any time within 30 days and tap <span className="font-semibold">Restore
              account</span> to keep your matches, conversations, and bookings.
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/login"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        <Phone className="h-4 w-4" />
        Sign in to restore
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        Need help?{' '}
        <a href="mailto:support@smartshaadi.co.in" className="font-semibold text-teal underline-offset-4 hover:underline">
          support@smartshaadi.co.in
        </a>
      </p>
    </div>
  );
}
