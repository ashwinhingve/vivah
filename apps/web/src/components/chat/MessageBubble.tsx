import type { ChatMessage } from '@smartshaadi/types'

interface MessageBubbleProps {
  message: ChatMessage
  currentUserId: string
}

export default function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isSent = message.senderId === currentUserId

  if (message.type === 'SYSTEM') {
    return (
      <div className="flex w-full justify-center py-1">
        <span className="text-[#6B6B76] italic text-sm text-center">{message.content}</span>
      </div>
    )
  }

  return (
    <div className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col max-w-[75%]">
        {message.type === 'PHOTO' && message.photoKey ? (
          <div
            className={`rounded-xl overflow-hidden border ${
              isSent
                ? 'bg-[#0E7C7B] border-[#0E7C7B]'
                : 'bg-white border-[#C5A47E]/20'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.photoKey}
              alt="Shared photo"
              className="rounded-lg max-w-full block"
            />
          </div>
        ) : (
          <div
            className={`rounded-xl px-4 py-2 ${
              isSent
                ? 'bg-[#0E7C7B] text-white'
                : 'bg-white border border-[#C5A47E]/20 text-[#0F172A]'
            }`}
          >
            <p className="text-sm leading-relaxed break-words">{message.content}</p>
          </div>
        )}
        <span
          className={`text-[#6B6B76] text-xs mt-1 ${isSent ? 'text-right' : 'text-left'}`}
        >
          {new Date(message.sentAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })}
          {isSent && message.readAt && (
            <span className="ml-1 text-[#059669]">✓✓</span>
          )}
        </span>
      </div>
    </div>
  )
}
