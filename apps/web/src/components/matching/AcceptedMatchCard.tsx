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
    <div className="bg-white rounded-xl border border-[#E8E0D8] shadow-sm p-4 flex flex-col gap-3">
      {/* Avatar + ID */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#7B2D42]/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-[#7B2D42]">{shortId.slice(0, 2)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2E2E38] truncate">Profile #{shortId}</p>
          <p className="text-xs text-[#6B6B76]">Matched on {acceptedOn}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-[#059669]/10 px-2 py-0.5 text-xs font-medium text-[#059669]">
          Matched
        </span>
      </div>

      {/* Message snippet */}
      {request.message && (
        <p className="text-xs text-[#6B6B76] italic line-clamp-2 border-l-2 border-[#C5A47E] pl-2">
          &ldquo;{request.message}&rdquo;
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link
          href={`/profiles/${otherId}`}
          className="flex-1 text-center rounded-lg border border-[#0E7C7B] text-[#0E7C7B] text-xs font-semibold py-2 min-h-[36px] flex items-center justify-center hover:bg-[#0E7C7B]/5 transition-colors"
        >
          View Profile
        </Link>
        <Link
          href={`/chat/${request.id}`}
          className="flex-1 text-center rounded-lg bg-[#0E7C7B] text-white text-xs font-semibold py-2 min-h-[36px] flex items-center justify-center hover:bg-[#149998] transition-colors"
        >
          Open Chat
        </Link>
      </div>
    </div>
  );
}
