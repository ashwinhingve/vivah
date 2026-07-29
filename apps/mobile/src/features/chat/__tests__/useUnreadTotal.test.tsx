import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { api } from '../../../lib/api';
import { useUnreadTotal } from '../useUnreadTotal';

jest.mock('../../../lib/api', () => ({
  api: {
    chat: {
      getConversations: jest.fn(),
    },
  },
  ApiRequestError: Error,
  NetworkError: Error,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUnreadTotal', () => {
  it('sums unreadCount across conversations', async () => {
    (api.chat.getConversations as jest.Mock).mockResolvedValue([
      { id: 'c1', unreadCount: 2 },
      { id: 'c2', unreadCount: 0 },
      { id: 'c3', unreadCount: 5 },
    ]);

    const { result } = await renderHook(() => useUnreadTotal(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).toBe(7));
    expect(api.chat.getConversations).toHaveBeenCalledWith('all');
  });

  it('returns 0 while loading and 0 on error', async () => {
    (api.chat.getConversations as jest.Mock).mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useUnreadTotal(), { wrapper: createWrapper() });

    expect(result.current).toBe(0);
    await waitFor(() => expect(api.chat.getConversations).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });
});
