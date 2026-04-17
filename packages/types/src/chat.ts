export interface ChatMessage {
  _id:        string
  senderId:   string
  content:    string
  contentHi:  string | null
  contentEn:  string | null
  type:       'TEXT' | 'PHOTO' | 'SYSTEM'
  photoKey:   string | null
  sentAt:     string
  readAt:     string | null
  readBy:     string[]
}

export interface ChatConversation {
  matchRequestId: string
  participants:   string[]
  messages:       ChatMessage[]
  lastMessage:    { content: string; sentAt: string; senderId: string } | null
  isActive:       boolean
}

export interface SocketEvents {
  // Client → Server
  join_room:    { matchRequestId: string }
  send_message: { matchRequestId: string; content: string; type: 'TEXT' | 'PHOTO'; photoKey?: string }
  mark_read:    { matchRequestId: string; messageIds: string[] }
  typing:       { matchRequestId: string }
  // Server → Client
  message_received: ChatMessage
  message_read:     { messageIds: string[]; readBy: string }
  user_typing:      { userId: string }
  match_accepted:   { matchRequestId: string }
}
