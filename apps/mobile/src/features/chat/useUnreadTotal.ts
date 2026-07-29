import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ConversationListItem } from '@smartshaadi/types';

/**
 * Total unread messages across conversations — drives the Chat tab badge.
 * No polling: the badge is a hint, not a realtime counter. It refreshes when
 * the query goes stale across mounts/invalidations, matching the client's
 * metered-data defaults (no refetch-on-focus, screens opt in via AppState).
 * A polling interval here also leaves an open handle that hangs jest on exit.
 */
export function useUnreadTotal(): number {
  const { data } = useQuery<ConversationListItem[]>({
    queryKey: ['chat', 'unread-total'],
    queryFn: () => api.chat.getConversations('all'),
    staleTime: 60_000,
  });
  return (data ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}
