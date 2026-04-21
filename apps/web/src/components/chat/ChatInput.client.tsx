'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ImagePlus, Send, Loader2 } from 'lucide-react';
import type { ChatMessage } from '@smartshaadi/types';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  matchId: string;
  currentUserId: string;
  authToken: string;
  onMessageReceived?: (message: ChatMessage) => void;
}

export default function ChatInput({
  matchId,
  currentUserId,
  authToken,
  onMessageReceived,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageReceivedRef = useRef(onMessageReceived);
  onMessageReceivedRef.current = onMessageReceived;

  useEffect(() => {
    const socketUrl = process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:4000';
    const socket = io(`${socketUrl}/chat`, {
      auth: { token: authToken },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_room', { matchRequestId: matchId });
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('message_received', (message: ChatMessage) => {
      onMessageReceivedRef.current?.(message);
      if (message.senderId !== currentUserId) {
        socket.emit('mark_read', { matchRequestId: matchId, messageIds: [message._id] });
      }
    });
    socket.on('user_typing', (data: { userId: string }) => {
      if (data.userId !== currentUserId) {
        setTypingUser(data.userId);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 2000);
      }
    });

    socketRef.current = socket;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      socket.disconnect();
    };
  }, [matchId, authToken, currentUserId]);

  const emitTyping = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { matchRequestId: matchId });
    }, 500);
  }, [matchId]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    emitTyping();
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 24 * 4 + 16)}px`;
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || !socketRef.current) return;
    socketRef.current.emit('send_message', {
      matchRequestId: matchId,
      content: trimmed,
      type: 'TEXT',
    });
    setContent('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socketRef.current || isUploading) return;
    setIsUploading(true);

    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';
    try {
      const res = await fetch(`${apiUrl}/chat/conversations/${matchId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data: { uploadUrl: string; key: string };
      };
      if (!json.success) return;

      await fetch(json.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      socketRef.current.emit('send_message', {
        matchRequestId: matchId,
        content: 'Photo',
        type: 'PHOTO',
        photoKey: json.data.key,
      });
    } catch {
      /* silent fail — user can retry */
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const canSend = !!content.trim() && isConnected;

  return (
    <div className="border-t border-gold/20 bg-surface/95 px-4 py-3 backdrop-blur-xl">
      {typingUser ? (
        <div className="mb-2 flex items-center gap-1.5 pl-1">
          <span className="flex gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal [animation-delay:300ms]" />
          </span>
          <span className="text-xs text-muted-foreground">typing…</span>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label={isUploading ? 'Uploading…' : 'Send photo'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-surface text-muted-foreground transition-all hover:border-gold hover:text-primary disabled:opacity-40"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? 'Type a message…' : 'Connecting…'}
          disabled={!isConnected}
          rows={1}
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm leading-6 text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 disabled:opacity-50"
          style={{ height: '44px' }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all',
            canSend
              ? 'bg-teal shadow-md shadow-teal/25 hover:-translate-y-0.5 hover:bg-teal-hover active:scale-95'
              : 'bg-teal/40 cursor-not-allowed'
          )}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
