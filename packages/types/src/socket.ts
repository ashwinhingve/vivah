// Shared Socket.IO event contract — server emits + client listens, both ends import.

import type { ChatMessage, MessageReaction } from './chat.js';

export interface PresenceUpdate {
  profileId:  string;
  isOnline:   boolean;
  lastSeenAt: string | null;
}

export interface MessageDeliveredEvent {
  matchRequestId: string;
  messageIds:     string[];
  profileId:      string;
}

export interface MessageReadEvent {
  matchRequestId: string;
  messageIds:     string[];
  readBy:         string;
  readAt:         string;
}

export interface MessageEditedEvent {
  matchRequestId: string;
  messageId:      string;
  content:        string;
  editedAt:       string;
}

export interface MessageDeletedEvent {
  matchRequestId: string;
  messageId:      string;
  deletedAt:      string;
}

export interface MessageReactedEvent {
  matchRequestId: string;
  messageId:      string;
  reactions:      MessageReaction[];
}

export interface MessageTranslatedEvent {
  matchRequestId: string;
  messageId:      string;
  contentHi:      string | null;
  contentEn:      string | null;
}

export interface ConversationUpdatedEvent {
  matchRequestId: string;
  kind:           'last_message' | 'unread_cleared' | 'muted' | 'archived' | 'pinned';
  lastMessage?:   { content: string; sentAt: string; senderId: string; type: string };
}

export interface NotificationEvent {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  payload?:  Record<string, unknown>;
  createdAt: string;
}

export interface VideoCallStartedEvent {
  matchId:  string;
  roomUrl:  string;
}

export interface RateLimitedEvent {
  matchRequestId: string;
  retryAfterMs:   number;
  reason:         string;
}

// ── Server → Client ──────────────────────────────────────────────────────────
export interface ServerToClientEvents {
  message_received:        (msg: ChatMessage) => void;
  message_edited:          (e: MessageEditedEvent) => void;
  message_deleted:         (e: MessageDeletedEvent) => void;
  message_reacted:         (e: MessageReactedEvent) => void;
  message_delivered:       (e: MessageDeliveredEvent) => void;
  message_read:            (e: MessageReadEvent) => void;
  message_translated:      (e: MessageTranslatedEvent) => void;
  presence_update:         (p: PresenceUpdate) => void;
  conversation_updated:    (e: ConversationUpdatedEvent) => void;
  user_typing:             (e: { userId?: string; profileId?: string }) => void;
  notification_received:   (n: NotificationEvent) => void;
  videoCallStarted:        (e: VideoCallStartedEvent) => void;
  rate_limited:            (e: RateLimitedEvent) => void;
  error:                   (e: { message: string; code?: string }) => void;
}

// ── Client → Server ──────────────────────────────────────────────────────────
export interface SendMessagePayload {
  matchRequestId: string;
  content:        string;
  type:           'TEXT' | 'PHOTO' | 'VOICE';
  photoKey?:      string;
  voiceKey?:      string;
  voiceDuration?: number;
  replyToId?:     string;
  clientMsgId?:   string;
}

export interface ClientToServerEvents {
  join_room:        (e: { matchRequestId: string }) => void;
  leave_room:       (e: { matchRequestId: string }) => void;
  presence_ping:    () => void;
  send_message:     (p: SendMessagePayload) => void;
  edit_message:     (e: { matchRequestId: string; messageId: string; content: string }) => void;
  delete_message:   (e: { matchRequestId: string; messageId: string }) => void;
  react_message:    (e: { matchRequestId: string; messageId: string; emoji: string }) => void;
  unreact_message:  (e: { matchRequestId: string; messageId: string }) => void;
  delivered_ack:    (e: { matchRequestId: string; messageIds: string[] }) => void;
  mark_read:        (e: { matchRequestId: string; messageIds: string[] }) => void;
  typing:           (e: { matchRequestId: string }) => void;
}
