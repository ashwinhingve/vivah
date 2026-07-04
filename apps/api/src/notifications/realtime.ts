import type { NotificationEvent } from '@smartshaadi/types';

/**
 * Decouples the notification delivery worker from the socket transport.
 *
 * The socket layer registers its emitter at boot (initSocket → setNotificationEmitter);
 * the delivery service calls emitNotification() WITHOUT importing — and thus
 * without dragging in — the whole socket.io / handlers module graph. This keeps
 * service.ts (and its unit tests) free of the realtime transport dependency,
 * and leaves emit a no-op until a socket server is actually running.
 */
type Emitter = (userId: string, event: NotificationEvent) => void;

let emitter: Emitter | null = null;

export function setNotificationEmitter(fn: Emitter): void {
  emitter = fn;
}

export function emitNotification(userId: string, event: NotificationEvent): void {
  if (!emitter) return;
  try {
    emitter(userId, event);
  } catch (err) {
    console.warn('[notifications] realtime emit failed:', err);
  }
}
