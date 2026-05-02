export type MessageType = 'TEXT' | 'PHOTO' | 'VOICE' | 'SYSTEM'

export type DeliveryState = 'SENT' | 'DELIVERED' | 'READ'

export interface MessageReaction {
  profileId: string
  emoji:     string
  at:        string
}

export interface ReplySnapshot {
  messageId: string
  senderId:  string
  type:      MessageType
  preview:   string
}

export interface LinkPreview {
  url:         string
  title:       string | null
  description: string | null
  image:       string | null
}

export interface ForwardedFrom {
  matchRequestId: string
  senderId:       string
}

export interface ChatMessage {
  _id:            string
  senderId:       string
  content:        string
  contentHi:      string | null
  contentEn:      string | null
  type:           MessageType
  photoKey:       string | null
  voiceKey:       string | null
  voiceDuration:  number | null
  sentAt:         string
  readAt:         string | null
  readBy:         string[]
  deliveredTo:    string[]
  reactions:      MessageReaction[]
  replyTo:        ReplySnapshot | null
  forwardedFrom:  ForwardedFrom | null
  linkPreview:    LinkPreview | null
  editedAt:       string | null
  deletedAt:      string | null
}

export interface ConversationSettings {
  mutedUntil:  string | null
  archived:    boolean
  pinned:      boolean
  wallpaper:   string | null
}

export interface ConversationParticipantPreview {
  profileId:       string
  firstName:       string | null
  age:             number | null
  city:            string | null
  primaryPhotoKey: string | null
  isOnline:        boolean
  lastSeenAt:      string | null
}

export interface ConversationListItem {
  matchRequestId: string
  participants:   string[]
  lastMessage:    {
    content:  string
    sentAt:   string
    senderId: string
    type:     MessageType
  } | null
  isActive:       boolean
  unreadCount:    number
  settings:       ConversationSettings
  other:          ConversationParticipantPreview | null
  updatedAt:      string
}

export interface ChatConversation {
  matchRequestId: string
  participants:   string[]
  messages:       ChatMessage[]
  lastMessage:    { content: string; sentAt: string; senderId: string } | null
  isActive:       boolean
  pinnedMessageIds: string[]
  settings:       ConversationSettings
}

export interface SmartReplySuggestion {
  text: string
  tone: 'friendly' | 'curious' | 'warm' | 'safe'
}

export interface SocketEvents {
  // Client → Server
  join_room:       { matchRequestId: string }
  leave_room:      { matchRequestId: string }
  send_message:    {
    matchRequestId: string
    content:        string
    type:           MessageType
    photoKey?:      string
    voiceKey?:      string
    voiceDuration?: number
    replyToId?:     string
  }
  edit_message:    { matchRequestId: string; messageId: string; content: string }
  delete_message:  { matchRequestId: string; messageId: string }
  react_message:   { matchRequestId: string; messageId: string; emoji: string }
  unreact_message: { matchRequestId: string; messageId: string }
  delivered_ack:   { matchRequestId: string; messageIds: string[] }
  mark_read:       { matchRequestId: string; messageIds: string[] }
  typing:          { matchRequestId: string }
  presence_ping:   {}
  // Server → Client
  message_received: ChatMessage
  message_edited:   { messageId: string; content: string; editedAt: string }
  message_deleted:  { messageId: string; deletedAt: string }
  message_reacted:  { messageId: string; reactions: MessageReaction[] }
  message_delivered:{ messageIds: string[]; profileId: string }
  message_read:     { messageIds: string[]; readBy: string }
  user_typing:      { userId: string; profileId: string }
  presence_update:  { profileId: string; isOnline: boolean; lastSeenAt: string | null }
  match_accepted:   { matchRequestId: string }
  error:            { message: string; code?: string }
}
