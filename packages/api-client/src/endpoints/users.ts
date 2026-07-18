import type { NotificationRow } from '@smartshaadi/types';
import type { ApiClient } from '../client.js';

export type DevicePlatform = 'ios' | 'android' | 'web';

/**
 * User / notification / device surface — Track C's REST endpoints, under
 * '/api/v1/users'.
 *
 * `registerDevice` is what makes push work: the FCM token the app obtains from
 * expo-notifications is useless until it is associated with the signed-in user
 * here. It is upserted on the token (onConflictDoUpdate in users/router.ts), so
 * calling it on every cold start is correct and cheap — tokens rotate, and a
 * stale row would otherwise keep receiving notifications for a signed-out user.
 */
export class UserEndpoints {
  constructor(private readonly client: ApiClient) {}

  getNotifications(
    params: { limit?: number; unreadOnly?: boolean } = {},
  ): Promise<NotificationRow[]> {
    return this.client.get<NotificationRow[]>('/api/v1/users/me/notifications', {
      query: { limit: params.limit, unreadOnly: params.unreadOnly },
    });
  }

  getUnreadCount(): Promise<{ count: number }> {
    return this.client.get<{ count: number }>(
      '/api/v1/users/me/notifications/unread-count',
    );
  }

  markNotificationRead(id: string): Promise<void> {
    return this.client.post<void>(`/api/v1/users/me/notifications/${id}/read`);
  }

  markAllNotificationsRead(): Promise<void> {
    return this.client.post<void>('/api/v1/users/me/notifications/read-all');
  }

  getEntitlements(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(
      '/api/v1/users/me/entitlements',
    );
  }

  // ── Push device registration ──────────────────────────────────────────────

  registerDevice(input: {
    token: string;
    platform: DevicePlatform;
    appVersion?: string;
  }): Promise<{ ok: boolean }> {
    return this.client.post<{ ok: boolean }>('/api/v1/users/me/devices', input);
  }

  /** Call on sign-out, so a shared handset stops receiving the old user's push. */
  unregisterDevice(token: string): Promise<void> {
    return this.client.delete<void>(
      `/api/v1/users/me/devices/${encodeURIComponent(token)}`,
    );
  }
}
