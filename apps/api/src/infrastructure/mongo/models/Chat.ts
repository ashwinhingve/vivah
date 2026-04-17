import { mongoose } from '../index.js'

const MessageSchema = new mongoose.Schema({
  senderId:  { type: String, required: true },
  content:   { type: String, required: true },
  contentHi: { type: String },
  contentEn: { type: String },
  type:      { type: String, enum: ['TEXT', 'PHOTO', 'SYSTEM'], default: 'TEXT' },
  photoKey:  { type: String },
  sentAt:    { type: Date, default: Date.now },
  readAt:    { type: Date },
  readBy:    [{ type: String }],
})

const ChatSchema = new mongoose.Schema(
  {
    participants:   [{ type: String, required: true }],
    matchRequestId: { type: String, required: true, unique: true },
    messages:       [MessageSchema],
    lastMessage: {
      content:  { type: String },
      sentAt:   { type: Date },
      senderId: { type: String },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

ChatSchema.index({ participants: 1 })
ChatSchema.index({ matchRequestId: 1 })

export const Chat = mongoose.model('Chat', ChatSchema)
