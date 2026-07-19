import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import type { ConversationListItem } from '@smartshaadi/types';

type ConversationFilter = 'all' | 'unread' | 'archived';

export interface UseConversationsState {
  conversations: ConversationListItem[];
  loading: boolean;
  error: unknown;
}

/**
 * Hook to fetch and manage conversation list.
 * Handles loading, error, and retry states.
 */
export function useConversations(filter: ConversationFilter = 'all'): UseConversationsState & { retry: () => Promise<void> } {
  const [state, setState] = useState<UseConversationsState>({
    conversations: [],
    loading: true,
    error: null,
  });

  const fetchConversations = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api.chat.getConversations(filter);
      setState({
        conversations: data,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err,
      }));
    }
  }, [filter]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  return {
    ...state,
    retry: fetchConversations,
  };
}
