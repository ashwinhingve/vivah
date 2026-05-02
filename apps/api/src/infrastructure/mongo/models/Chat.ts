import { mongoose } from '../index.js'

const ReactionSchema = new mongoose.Schema(
  {
    profileId: { type: String, required: true },
    emoji:     { type: String, required: true },
    at:        { type: Date, default: Date.now },
  },
  { _id: false },
)

const ReplySnapshotSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true },
    senderId:  { type: String, required: true },
    type:      { type: String, enum: ['TEXT', 'PHOTO', 'VOICE', 'SYSTEM'], required: true },
    preview:   { type: String, required: true },
  },
  { _id: false },
)

const LinkPreviewSchema = new mongoose.Schema(
  {
    url:         { type: String, required: true },
    title:       { type: String, default: null },
    description: { type: String, default: null },
    image:       { type: String, default: null },
  },
  { _id: false },
)

const ForwardedFromSchema = new mongoose.Schema(
  {
    matchRequestId: { type: String, required: true },
    senderId:       { type: String, required: true },
  },
  { _id: false },
)

const MessageSchema = new mongoose.Schema({
  senderId:      { type: String, required: true },
  content:       { type: String, required: true },
  contentHi:     { type: String, default: null },
  contentEn:     { type: String, default: null },
  type:          { type: String, enum: ['TEXT', 'PHOTO', 'VOICE', 'SYSTEM'], default: 'TEXT' },
  photoKey:      { type: String, default: null },
  voiceKey:      { type: String, default: null },
  voiceDuration: { type: Number, default: null },
  sentAt:        { type: Date, default: Date.now },
  readAt:        { type: Date, default: null },
  readBy:        [{ type: String }],
  deliveredTo:   [{ type: String }],
  reactions:     [ReactionSchema],
  replyTo:       { type: ReplySnapshotSchema, default: null },
  forwardedFrom: { type: ForwardedFromSchema, default: null },
  linkPreview:   { type: LinkPreviewSchema, default: null },
  editedAt:      { type: Date, default: null },
  deletedAt:     { type: Date, default: null },
})

const ConversationSettingsSchema = new mongoose.Schema(
  {
    mutedBy:    [{ type: String }],
    archivedBy: [{ type: String }],
    pinnedBy:   [{ type: String }],
    wallpaper:  { type: String, default: null },
  },
  { _id: false },
)

const ChatSchema = new mongoose.Schema(
  {
    participants:     [{ type: String, required: true }],
    matchRequestId:   { type: String, required: true, unique: true },
    messages:         [MessageSchema],
    pinnedMessageIds: [{ type: String }],
    settings:         { type: ConversationSettingsSchema, default: () => ({}) },
    lastMessage: {
      content:  { type: String },
      sentAt:   { type: Date },
      senderId: { type: String },
      type:     { type: String },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

ChatSchema.index({ participants: 1 })
ChatSchema.index({ matchRequestId: 1 })
ChatSchema.index({ 'messages._id': 1 })

export const Chat = mongoose.model('Chat', ChatSchema)
