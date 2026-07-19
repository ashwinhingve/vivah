import type {
  ChatConversation,
  ChatMessage,
  ConversationListItem,
  SmartReplySuggestion,
} from '@smartshaadi/types';
import type { ApiClient } from '../client.js';

export type ConversationFilter = 'all' | 'unread' | 'archived';

/**
 * Chat surface — Track C's REST endpoints, under '/api/v1/chat'.
 *
 * Only the *durable* reads live here. Sending a message, typing indicators and
 * read receipts all go over Socket.io (apps/api/src/chat/socket), not REST —
 * see `src/lib/socket.ts` in the mobile app. Mixing the two transports in one
 * module would blur which operations are realtime and which survive a reconnect.
 */
export class ChatEndpoints {
  constructor(private readonly client: ApiClient) {}

  getConversations(
    filter: ConversationFilter = 'all',
  ): Promise<ConversationListItem[]> {
    return this.client.get<ConversationListItem[]>('/api/v1/chat/conversations', {
      query: { filter },
    });
  }

  getRecent(limit = 3): Promise<ConversationListItem[]> {
    return this.client.get<ConversationListItem[]>('/api/v1/chat/recent', {
      query: { limit },
    });
  }

  /** Thread head: participants, settings, and the first page of messages. */
  getConversation(matchId: string): Promise<ChatConversation> {
    return this.client.get<ChatConversation>(
      `/api/v1/chat/conversations/${matchId}`,
    );
  }

  getMessages(
    matchId: string,
    params: { before?: string; limit?: number } = {},
  ): Promise<ChatMessage[]> {
    return this.client.get<ChatMessage[]>(
      `/api/v1/chat/conversations/${matchId}`,
      { query: { before: params.before, limit: params.limit } },
    );
  }

  getSmartReplies(matchId: string): Promise<SmartReplySuggestion[]> {
    return this.client.get<SmartReplySuggestion[]>(
      `/api/v1/chat/conversations/${matchId}/smart-replies`,
    );
  }

  reportConversation(
    matchId: string,
    input: { category: string; details?: string },
  ): Promise<void> {
    return this.client.post<void>(
      `/api/v1/chat/conversations/${matchId}/report`,
      input,
    );
  }

  updateSettings(
    matchId: string,
    input: Record<string, unknown>,
  ): Promise<void> {
    return this.client.patch<void>(
      `/api/v1/chat/conversations/${matchId}/settings`,
      input,
    );
  }
}
