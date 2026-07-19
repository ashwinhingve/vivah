import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getSessionCookie } from './auth-client';
import { API_BASE_URL } from './env';

/**
 * Realtime chat transport.
 *
 * Auth: we send the full Cookie header as `handshake.auth.cookie`. React Native
 * has no cookie jar, so the browser's `withCredentials` path is unavailable, and
 * the older `auth.token` path is not viable either — the server wraps that value
 * in the hardcoded non-Secure cookie name (`better-auth.session_token`), which
 * is wrong once the API issues `__Secure-` cookies in production. Sending the
 * whole header keeps the name correct in every environment. The matching server
 * branch is source 1 in apps/api/src/chat/socket/auth.ts.
 *
 * Lifecycle: mobile apps are suspended, not closed. iOS tears down sockets on
 * background within seconds; Android is laxer but still kills them under memory
 * pressure. So we disconnect deliberately on background and reconnect on
 * foreground rather than letting a half-dead socket linger — a silently dead
 * socket that never errors is worse than a clean reconnect, because the UI keeps
 * showing "connected" while messages quietly stop arriving.
 */
export type ChatSocketStatus = 'disconnected' | 'connecting' | 'connected';

type StatusListener = (status: ChatSocketStatus) => void;

export class ChatSocket {
  private socket: Socket | null = null;
  private status: ChatSocketStatus = 'disconnected';
  private readonly statusListeners = new Set<StatusListener>();
  private appStateSub: { remove: () => void } | null = null;
  /** Rooms we should be in. Replayed after every reconnect. */
  private readonly joinedRooms = new Set<string>();

  getStatus(): ChatSocketStatus {
    return this.status;
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(next: ChatSocketStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }

  /** Idempotent: calling it while already connected is a no-op. */
  connect(): void {
    if (this.socket?.connected) return;

    const cookie = getSessionCookie();
    if (!cookie) {
      // Signed out. Connecting would just be rejected by the handshake.
      this.setStatus('disconnected');
      return;
    }

    this.socket?.removeAllListeners();
    this.socket?.disconnect();

    this.setStatus('connecting');
    this.socket = io(`${API_BASE_URL}/chat`, {
      auth: { cookie },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      // Cap the backoff: the default grows unbounded, so a phone that was
      // offline for a while would sit disconnected long after regaining signal.
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });

    this.socket.on('connect', () => {
      this.setStatus('connected');
      // Re-join every room. socket.io restores the CONNECTION but not server-side
      // room membership, so without this a reconnect looks fine and delivers
      // nothing.
      for (const room of this.joinedRooms) {
        this.socket?.emit('join_room', { matchId: room });
      }
    });

    this.socket.on('disconnect', () => this.setStatus('disconnected'));
    this.socket.on('connect_error', () => this.setStatus('disconnected'));

    this.startAppStateWatch();
  }

  disconnect(): void {
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.joinedRooms.clear();
    this.setStatus('disconnected');
  }

  private startAppStateWatch(): void {
    if (this.appStateSub) return;
    this.appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          // Re-read the cookie on resume: the session may have been rotated or
          // signed out in the meantime.
          if (!this.socket?.connected) this.connect();
        } else {
          this.socket?.disconnect();
          this.setStatus('disconnected');
        }
      },
    );
  }

  joinRoom(matchId: string): void {
    this.joinedRooms.add(matchId);
    this.socket?.emit('join_room', { matchId });
  }

  leaveRoom(matchId: string): void {
    this.joinedRooms.delete(matchId);
    this.socket?.emit('leave_room', { matchId });
  }

  on<T>(event: string, handler: (payload: T) => void): () => void {
    this.socket?.on(event, handler);
    return () => {
      this.socket?.off(event, handler);
    };
  }

  emit(event: string, payload: unknown): void {
    this.socket?.emit(event, payload);
  }
}

/** App-wide instance. Connected once the user is authenticated. */
export const chatSocket = new ChatSocket();
