import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import type { NotificationRow } from '@smartshaadi/types';

export interface UseNotificationsState {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  error: unknown;
}

/**
 * Hook to fetch and manage notifications.
 * Supports filtering and mark-as-read operations.
 */
export function useNotifications(
  unreadOnly: boolean = false,
  limit: number = 20,
): UseNotificationsState & {
  retry: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshCount: () => Promise<void>;
} {
  const [state, setState] = useState<UseNotificationsState>({
    notifications: [],
    unreadCount: 0,
    loading: true,
    error: null,
  });

  const fetchNotifications = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [notifications, countRes] = await Promise.all([
        api.users.getNotifications({ limit, unreadOnly }),
        api.users.getUnreadCount(),
      ]);
      setState({
        notifications,
        unreadCount: countRes.count,
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
  }, [limit, unreadOnly]);

  const markRead = useCallback(
    async (id: string): Promise<void> => {
      try {
        await api.users.markNotificationRead(id);
        setState((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    },
    [],
  );

  const markAllRead = useCallback(async (): Promise<void> => {
    try {
      await api.users.markAllNotificationsRead();
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  }, []);

  const refreshCount = useCallback(async (): Promise<void> => {
    try {
      const countRes = await api.users.getUnreadCount();
      setState((prev) => ({
        ...prev,
        unreadCount: countRes.count,
      }));
    } catch (err) {
      console.error('Failed to refresh unread count:', err);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  return {
    ...state,
    retry: fetchNotifications,
    markRead,
    markAllRead,
    refreshCount,
  };
}
