'use client';

import { useState } from 'react';

interface ReferralActionsProps {
  code:      string;
  shareUrl:  string;
}

export function ReferralActions({ code, shareUrl }: ReferralActionsProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  async function copy(value: string, kind: 'code' | 'link'): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API blocked (older browsers, http context) — best-effort UI
    }
  }

  async function share(): Promise<void> {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Join me on Smart Shaadi',
          text:  `Use my referral code ${code} when you sign up.`,
          url:   shareUrl,
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard copy
      }
    }
    await copy(shareUrl, 'link');
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={() => copy(code, 'code')}
        className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-card hover:opacity-90"
      >
        {copied === 'code' ? 'Copied!' : 'Copy code'}
      </button>
      <button
        type="button"
        onClick={share}
        className="h-11 rounded-lg border border-gold bg-background px-4 text-sm font-medium text-primary hover:bg-gold/10"
      >
        {copied === 'link' ? 'Link copied!' : 'Share invite link'}
      </button>
    </div>
  );
}
