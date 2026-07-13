'use client';

import { useState } from 'react';
import { Copy, Check, KeyRound } from 'lucide-react';

/**
 * Shows the signed-in user their own account code so they can hand it to a
 * family member who wants to assist them. Sharing your OWN id is not an
 * enumeration risk (unlike a directory lookup).
 */
export function FamilyInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the code is still visible to copy manually */
    }
  }

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-gold-muted" />
        <h2 className="font-heading text-base text-primary">Your family code</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Share this with a family member so they can send you a link request to help with your search.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-primary">
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/5 px-3 text-sm font-medium text-teal hover:bg-teal/10"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
