import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { chatSocket, type ChatSocketStatus } from '../../lib/socket';
import type { ChatMessage, ChatConversation } from '@smartshaadi/types';

export interface UseThreadState {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  loading: boolean;
  error: unknown;
  socketStatus: ChatSocketStatus;
  unsentMessages: Map<string, string>; // tempId -> content
}

/**
 * Hook to manage a single chat thread.
 * - Loads initial conversation + messages from REST
 * - Joins the room and listens for realtime socket events
 * - Handles optimistic message rendering
 */
export function useThread(matchId: string): UseThreadState & {
  retry: () => Promise<void>;
  sendMessage: (content: string) => void;
  markMessagesRead: (messageIds: string[]) => void;
} {
  const [state, setState] = useState<UseThreadState>({
    conversation: null,
    messages: [],
    loading: true,
    error: null,
    socketStatus: 'disconnected',
    unsentMessages: new Map(),
  });

  const unsubscribeRef = useRef<Array<() => void>>([]);

  const loadConversation = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api.chat.getConversation(matchId);
      setState((prev) => ({
        ...prev,
        conversation: data,
        messages: data.messages,
        loading: false,
        error: null,
      }));

      // Join the socket room after loading
      chatSocket.joinRoom(matchId);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err,
      }));
    }
  }, [matchId]);

  const sendMessage = useCallback((content: string): void => {
    const tempId = `temp-${Date.now()}`;
    setState((prev) => {
      const newUnsentMessages = new Map(prev.unsentMessages);
      newUnsentMessages.set(tempId, content);
      return { ...prev, unsentMessages: newUnsentMessages };
    });

    chatSocket.emit('send_message', {
      matchRequestId: matchId,
      content,
      type: 'TEXT',
    });
  }, [matchId]);

  const markMessagesRead = useCallback((messageIds: string[]): void => {
    if (messageIds.length === 0) return;
    chatSocket.emit('mark_read', {
      matchRequestId: matchId,
      messageIds,
    });
  }, [matchId]);

  useEffect(() => {
    // Load initial data
    void loadConversation();

    // Connect socket and setup listeners
    chatSocket.connect();

    const unsubscribers: Array<() => void> = [];

    // Listen for socket status changes
    unsubscribers.push(
      chatSocket.onStatusChange((status) => {
        setState((prev) => ({ ...prev, socketStatus: status }));
      }),
    );

    // Listen for incoming messages
    unsubscribers.push(
      chatSocket.on<ChatMessage>('message_received', (message) => {
        setState((prev) => {
          const newMessages = [...prev.messages, message];
          return { ...prev, messages: newMessages };
        });
      }),
    );

    // Listen for message edits
    unsubscribers.push(
      chatSocket.on<{ messageId: string; content: string; editedAt: string }>(
        'message_edited',
        ({ messageId, content, editedAt }) => {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m._id === messageId ? { ...m, content, editedAt } : m,
            ),
          }));
        },
      ),
    );

    // Listen for message deletes
    unsubscribers.push(
      chatSocket.on<{ messageId: string; deletedAt: string }>(
        'message_deleted',
        ({ messageId, deletedAt }) => {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m._id === messageId ? { ...m, deletedAt, content: '[deleted]' } : m,
            ),
          }));
        },
      ),
    );

    // Listen for read receipts
    unsubscribers.push(
      chatSocket.on<{ messageIds: string[]; readBy: string }>(
        'message_read',
        ({ messageIds, readBy }) => {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              messageIds.includes(m._id) && !m.readBy.includes(readBy)
                ? { ...m, readBy: [...m.readBy, readBy] }
                : m,
            ),
          }));
        },
      ),
    );

    unsubscribeRef.current = unsubscribers;

    return () => {
      chatSocket.leaveRoom(matchId);
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [matchId, loadConversation]);

  return {
    ...state,
    retry: loadConversation,
    sendMessage,
    markMessagesRead,
  };
}
