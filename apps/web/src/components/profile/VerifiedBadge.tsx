// Server component — no 'use client' needed
interface Props {
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  className?: string;
}

export function VerifiedBadge({ status, className }: Props) {
  if (status === 'VERIFIED') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-[#0E7C7B]/10 px-2.5 py-1 text-xs font-medium text-[#0E7C7B] ${className ?? ''}`}>
        {/* Shield check icon — inline SVG */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
        Verified
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-[#D97706]/10 px-2.5 py-1 text-xs font-medium text-[#D97706] ${className ?? ''}`}>
        Pending Verification
      </span>
    );
  }
  return null; // REJECTED shows nothing
}
