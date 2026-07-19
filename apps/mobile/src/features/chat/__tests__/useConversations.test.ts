import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement as h, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversations } from '../useConversations';
import { api } from '../../../lib/api';
import type { ConversationListItem } from '@smartshaadi/types';

jest.mock('../../../lib/api', () => ({
  api: {
    chat: {
      getConversations: jest.fn(),
    },
  },
  ApiRequestError: Error,
  NetworkError: Error,
}));

describe('useConversations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createWrapper = () => ({ children }: { children: ReactNode }) =>
    h(QueryClientProvider, { client: queryClient, children });

  it('fetches conversations on mount', async () => {
    const mockConversations: ConversationListItem[] = [
      {
        matchRequestId: 'conv-1',
        participants: ['user1', 'user2'],
        lastMessage: {
          content: 'Hello',
          sentAt: '2026-07-18T10:00:00Z',
          senderId: 'user1',
          type: 'TEXT' as const,
        },
        isActive: true,
        unreadCount: 2,
        settings: {
          mutedUntil: null,
          archived: false,
          pinned: false,
          wallpaper: null,
        },
        other: {
          profileId: 'user2',
          firstName: 'John',
          age: 28,
          city: 'Mumbai',
          primaryPhotoKey: 'photo1',
          isOnline: true,
          lastSeenAt: null,
        },
        updatedAt: '2026-07-18T10:00:00Z',
      },
    ];

    (api.chat.getConversations as jest.Mock).mockResolvedValue(
      mockConversations,
    );

    const { result } = await renderHook(() => useConversations('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.conversations).toEqual(mockConversations);
    expect(result.current.error).toBe(null);
    expect(api.chat.getConversations).toHaveBeenCalledWith('all');
  });

  it('handles errors gracefully', async () => {
    const mockError = new Error('API Error');
    (api.chat.getConversations as jest.Mock).mockRejectedValue(mockError);

    const { result } = await renderHook(() => useConversations('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(mockError);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.conversations).toEqual([]);
  });

  it('filters by conversation type', async () => {
    const mockConversations: ConversationListItem[] = [];
    (api.chat.getConversations as jest.Mock).mockResolvedValue(
      mockConversations,
    );

    const { result } = await renderHook(() => useConversations('unread'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.chat.getConversations).toHaveBeenCalledWith('unread');
  });

  it('provides a retry function', async () => {
    const mockConversations: ConversationListItem[] = [];
    (api.chat.getConversations as jest.Mock).mockResolvedValue(
      mockConversations,
    );

    const { result } = await renderHook(() => useConversations('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.chat.getConversations).toHaveBeenCalledTimes(1);

    await result.current.retry();

    expect(api.chat.getConversations).toHaveBeenCalledTimes(2);
  });
});
