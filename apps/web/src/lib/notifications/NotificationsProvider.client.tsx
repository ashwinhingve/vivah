'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import type { NotificationRow, NotificationEvent } from '@smartshaadi/types';
import { useToast } from '@/components/ui/toast';
import {
  markReadAction, markUnreadAction, markAllReadAction, removeAction, clearAllAction,
} from '@/app/[locale]/(app)/notifications/actions';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function getSessionToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : '';
}

export interface NotificationsContextValue {
  items:       NotificationRow[];
  unreadCount: number;
  connected:   boolean;
  markRead:    (id: string) => void;
  markUnread:  (id: string) => void;
  markAllRead: () => void;
  remove:      (id: string) => void;
  clearAll:    () => void;
}

const noop = (): void => {};
const DEFAULT: NotificationsContextValue = {
  items: [], unreadCount: 0, connected: false,
  markRead: noop, markUnread: noop, markAllRead: noop, remove: noop, clearAll: noop,
};

const NotificationsContext = createContext<NotificationsContextValue>(DEFAULT);

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}

interface Props {
  initial:  { items: NotificationRow[]; unreadCount: number };
  children: ReactNode;
}

export function NotificationsProvider({ initial, children }: Props) {
  const [items, setItems] = useState<NotificationRow[]>(initial.items);
  const [unreadCount, setUnreadCount] = useState<number>(initial.unreadCount);
  const [connected, setConnected] = useState(false);
  const { toast } = useToast();

  // Live socket — mirrors SocketProvider's connect/cleanup discipline. Connects
  // to the dedicated /notifications namespace; multiplexes with chat's socket
  // when both are alive (same base URL + opts share one transport).
  useEffect(() => {
    const token = getSessionToken();
    const s: Socket = io(`${API_URL}/notifications`, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('notification_received', (e: NotificationEvent) => {
      const row: NotificationRow = {
        id:        e.id,
        userId:    '',
        type:      e.type,
        title:     e.title,
        body:      e.body,
        data:      e.payload ?? (e.category ? { category: e.category } : {}),
        read:      false,
        sentVia:   null,
        createdAt: e.createdAt,
      };
      setItems((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
      setUnreadCount((c) => c + 1);
      toast(e.title, 'info');
    });

    return () => { s.disconnect(); };
    // toast identity is stable (useCallback in ToastProvider); intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUnread = useCallback(
    (id: string) => items.some((n) => n.id === id && !n.read),
    [items],
  );

  const markRead = useCallback((id: string) => {
    if (!isUnread(id)) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    void markReadAction(id).then((r) => {
      if (!r.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
        setUnreadCount((c) => c + 1);
      }
    });
  }, [isUnread]);

  const markUnread = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    setUnreadCount((c) => c + 1);
    void markUnreadAction(id).then((r) => {
      if (!r.ok) {
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    void markAllReadAction();
  }, []);

  const remove = useCallback((id: string) => {
    const wasUnread = isUnread(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    void removeAction(id);
  }, [isUnread]);

  const clearAll = useCallback(() => {
    setItems([]);
    setUnreadCount(0);
    void clearAllAction();
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({ items, unreadCount, connected, markRead, markUnread, markAllRead, remove, clearAll }),
    [items, unreadCount, connected, markRead, markUnread, markAllRead, remove, clearAll],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
