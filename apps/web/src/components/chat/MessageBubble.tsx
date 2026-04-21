import Image from 'next/image';
import { Check, CheckCheck } from 'lucide-react';
import type { ChatMessage } from '@smartshaadi/types';
import { cn } from '@/lib/utils';
import { resolvePhotoUrl } from '@/lib/photo';

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId: string;
}

export default function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isSent = message.senderId === currentUserId;

  if (message.type === 'SYSTEM') {
    return (
      <div className="flex w-full justify-center py-1">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-center text-xs italic text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  const time = new Date(message.sentAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className={cn('flex w-full', isSent ? 'justify-end' : 'justify-start')}>
      <div className="flex max-w-[78%] flex-col">
        {message.type === 'PHOTO' && message.photoKey ? (
          (() => {
            const photoUrl = resolvePhotoUrl(message.photoKey);
            return photoUrl ? (
              <div
                className={cn(
                  'overflow-hidden rounded-2xl shadow-sm',
                  isSent ? 'rounded-br-md' : 'rounded-bl-md border border-gold/20'
                )}
              >
                <Image
                  src={photoUrl}
                  alt="Shared photo"
                  width={320}
                  height={220}
                  className="block max-w-full"
                />
              </div>
            ) : null;
          })()
        ) : (
          <div
            className={cn(
              'rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm',
              isSent
                ? 'rounded-br-md bg-teal text-white'
                : 'rounded-bl-md border border-gold/20 bg-surface text-foreground'
            )}
          >
            <p className="break-words">{message.content}</p>
          </div>
        )}
        <span
          className={cn(
            'mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground',
            isSent ? 'self-end' : 'self-start'
          )}
        >
          {time}
          {isSent ? (
            message.readAt ? (
              <CheckCheck className="h-3 w-3 text-teal" aria-label="Read" />
            ) : (
              <Check className="h-3 w-3" aria-label="Sent" />
            )
          ) : null}
        </span>
      </div>
    </div>
  );
}
