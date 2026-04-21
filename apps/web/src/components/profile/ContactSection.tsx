// Server component
interface Props {
  phone: string | null;
  email: string | null;
  isSelf: boolean;
}

export function ContactSection({ phone, email, isSelf }: Props) {
  const hasContact = phone != null || email != null;

  if (!hasContact && !isSelf) {
    // Locked state — contact masked
    return (
      <div className="rounded-xl bg-background border border-border p-4 flex items-center gap-3">
        {/* Lock icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9E7F5A" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Contact Details</p>
          <p className="text-xs text-muted-foreground italic mt-0.5">Visible after mutual interest</p>
        </div>
      </div>
    );
  }

  // Unlocked state
  return (
    <div className="rounded-xl bg-surface border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Contact Details</h3>
      {phone && (
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" strokeWidth="2" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5.07 2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span className="text-sm text-foreground">{phone}</span>
        </div>
      )}
      {email && (
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E7C7B" strokeWidth="2" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span className="text-sm text-foreground">{email}</span>
        </div>
      )}
    </div>
  );
}
