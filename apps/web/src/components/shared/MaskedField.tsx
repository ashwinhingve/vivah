'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type MaskKind = 'phone' | 'email' | 'custom';

interface MaskedFieldProps {
  value: string;
  kind?: MaskKind;
  unlocked?: boolean;
  /** Tooltip / aria-label explaining why the value is masked. */
  lockedReason?: string;
  className?: string;
}

function maskValue(value: string, kind: MaskKind): string {
  if (kind === 'phone') {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 4) return '••••';
    const tail = digits.slice(-4);
    return `+•• ••• ••• ${tail}`;
  }
  if (kind === 'email') {
    const [local, domain] = value.split('@');
    if (!local || !domain) return '••••';
    const visible = local.slice(0, 1);
    return `${visible}${'•'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
  }
  return '••••••';
}

/**
 * MaskedField — phone/email reveal pattern.
 * Defaults to masked. Reveal toggle appears only when `unlocked` is true,
 * enforcing the rule that contact info never appears until the user unlocks
 * the match.
 */
export function MaskedField({
  value,
  kind = 'phone',
  unlocked = false,
  lockedReason = 'Contact unlock required to view',
  className,
}: MaskedFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const displayed = unlocked && revealed ? value : maskValue(value, kind);

  if (!unlocked) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}
        aria-label={lockedReason}
        title={lockedReason}
      >
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-mono tabular-nums">{displayed}</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-foreground', className)}>
      <span className="font-mono tabular-nums">{displayed}</span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? 'Hide value' : 'Show value'}
        aria-pressed={revealed}
        className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
