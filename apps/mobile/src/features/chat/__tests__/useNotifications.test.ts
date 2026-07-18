import { renderHook, waitFor, act } from '@testing-library/react-native';
import { createElement as h, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotifications } from '../useNotifications';
import { api } from '../../../lib/api';
import type { NotificationRow } from '@smartshaadi/types';

jest.mock('../../../lib/api', () => ({
  api: {
    users: {
      getNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markNotificationRead: jest.fn(),
      markAllNotificationsRead: jest.fn(),
    },
  },
}));

describe('useNotifications', () => {
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

  it('fetches notifications on mount', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-1',
        type: 'MESSAGE',
        title: 'New message',
        body: 'John sent you a message',
        data: { category: 'MESSAGE', jobType: 'NEW_CHAT_MESSAGE' },
        read: false,
        sentVia: ['push'],
        createdAt: '2026-07-18T10:00:00Z',
      },
    ];

    (api.users.getNotifications as jest.Mock).mockResolvedValue(
      mockNotifications,
    );
    (api.users.getUnreadCount as jest.Mock).mockResolvedValue({ count: 1 });

    const { result } = await renderHook(() => useNotifications(false, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.unreadCount).toBe(1);
  });

  it('filters unread notifications', async () => {
    (api.users.getNotifications as jest.Mock).mockResolvedValue([]);
    (api.users.getUnreadCount as jest.Mock).mockResolvedValue({ count: 0 });

    const { result } = await renderHook(() => useNotifications(true, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.users.getNotifications).toHaveBeenCalledWith({
      limit: 20,
      unreadOnly: true,
    });
  });

  it('marks a notification as read', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-1',
        type: 'MESSAGE',
        title: 'New message',
        body: 'John sent you a message',
        data: null,
        read: false,
        sentVia: null,
        createdAt: '2026-07-18T10:00:00Z',
      },
    ];

    (api.users.getNotifications as jest.Mock).mockResolvedValue(
      mockNotifications,
    );
    (api.users.getUnreadCount as jest.Mock).mockResolvedValue({ count: 1 });
    (api.users.markNotificationRead as jest.Mock).mockResolvedValue(undefined);

    const { result } = await renderHook(() => useNotifications(false, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.markRead('notif-1');
    });

    await waitFor(() => {
      expect(api.users.markNotificationRead).toHaveBeenCalledWith('notif-1');
      expect(result.current.notifications[0].read).toBe(true);
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('marks all notifications as read', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-1',
        type: 'MESSAGE',
        title: 'New message',
        body: 'John sent you a message',
        data: null,
        read: false,
        sentVia: null,
        createdAt: '2026-07-18T10:00:00Z',
      },
    ];

    (api.users.getNotifications as jest.Mock).mockResolvedValue(
      mockNotifications,
    );
    (api.users.getUnreadCount as jest.Mock).mockResolvedValue({ count: 1 });
    (api.users.markAllNotificationsRead as jest.Mock).mockResolvedValue(
      undefined,
    );

    const { result } = await renderHook(() => useNotifications(false, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.markAllRead();
    });

    await waitFor(() => {
      expect(api.users.markAllNotificationsRead).toHaveBeenCalled();
    });

    expect(result.current.notifications.every((n: NotificationRow) => n.read)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('refreshes unread count', async () => {
    (api.users.getNotifications as jest.Mock).mockResolvedValue([]);
    (api.users.getUnreadCount as jest.Mock).mockResolvedValue({ count: 0 });

    const { result } = await renderHook(() => useNotifications(false, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    (api.users.getUnreadCount as jest.Mock).mockResolvedValue({ count: 3 });

    act(() => {
      result.current.refreshCount();
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
    });
  });

  it('handles errors', async () => {
    const mockError = new Error('API Error');
    (api.users.getNotifications as jest.Mock).mockRejectedValue(mockError);
    (api.users.getUnreadCount as jest.Mock).mockRejectedValue(mockError);

    const { result } = await renderHook(() => useNotifications(false, 20), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(mockError);
    });

    expect(result.current.loading).toBe(false);
  });
});
