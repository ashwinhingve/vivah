'use client'

import { useState, useCallback } from 'react'
import type { ChatMessage } from '@smartshaadi/types'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput.client'

interface ChatViewProps {
  matchId: string
  currentUserId: string
  authToken: string
  initialMessages: ChatMessage[]
}

export default function ChatView({
  matchId,
  currentUserId,
  authToken,
  initialMessages,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)

  const handleMessageReceived = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m._id === message._id)) return prev
      return [...prev, message]
    })
  }, [])

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#0E7C7B]/10 flex items-center justify-center mb-4 text-3xl">
              💬
            </div>
            <p className="text-base font-semibold text-[#0F172A] font-heading">
              Start the conversation
            </p>
            <p className="text-sm text-[#6B6B76] mt-1 max-w-xs">
              Say hello and begin your journey together
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg._id} message={msg} currentUserId={currentUserId} />
          ))
        )}
      </div>
      <ChatInput
        matchId={matchId}
        currentUserId={currentUserId}
        authToken={authToken}
        onMessageReceived={handleMessageReceived}
      />
    </>
  )
}
