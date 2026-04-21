import { ShieldCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  className?: string;
}

export function VerifiedBadge({ status, className }: Props) {
  if (status === 'VERIFIED') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal',
          className
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Verified
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning',
          className
        )}
      >
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Pending Verification
      </span>
    );
  }
  return null;
}
