import Link from 'next/link';
import type { MatchRequest } from '@smartshaadi/types';

interface Props {
  request: MatchRequest;
  perspective: 'received' | 'sent';
}

export function AcceptedMatchCard({ request, perspective }: Props) {
  const otherId = perspective === 'received' ? request.senderId : request.receiverId;
  const shortId = otherId.slice(0, 8).toUpperCase();
  const acceptedOn = new Date(request.updatedAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm p-4 flex flex-col gap-3">
      {/* Avatar + ID */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">{shortId.slice(0, 2)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">Profile #{shortId}</p>
          <p className="text-xs text-muted-foreground">Matched on {acceptedOn}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
          Matched
        </span>
      </div>

      {/* Message snippet */}
      {request.message && (
        <p className="text-xs text-muted-foreground italic line-clamp-2 border-l-2 border-gold pl-2">
          &ldquo;{request.message}&rdquo;
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link
          href={`/profiles/${otherId}`}
          className="flex-1 text-center rounded-lg border border-teal text-teal text-xs font-semibold py-2 min-h-[36px] flex items-center justify-center hover:bg-teal/5 transition-colors"
        >
          View Profile
        </Link>
        <Link
          href={`/chat/${request.id}`}
          className="flex-1 text-center rounded-lg bg-teal text-white text-xs font-semibold py-2 min-h-[36px] flex items-center justify-center hover:bg-teal-hover transition-colors"
        >
          Open Chat
        </Link>
      </div>
    </div>
  );
}
