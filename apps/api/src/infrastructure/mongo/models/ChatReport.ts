import { mongoose } from '../index.js'

/**
 * Conversation abuse reports.
 *
 * Kept in a dedicated collection rather than inlined as a SYSTEM message in the
 * Chat document, so moderation data is not exposed to chat-history reads and can
 * be queried/triaged independently.
 */
const ChatReportSchema = new mongoose.Schema(
  {
    matchRequestId:    { type: String, required: true },
    reporterProfileId: { type: String, required: true },
    reason:            { type: String, required: true },
    status:            { type: String, enum: ['OPEN', 'REVIEWED', 'DISMISSED'], default: 'OPEN' },
  },
  { timestamps: true, collection: 'chat_reports' },
)

ChatReportSchema.index({ matchRequestId: 1 })
ChatReportSchema.index({ status: 1, createdAt: -1 })

export const ChatReport =
  mongoose.models['ChatReport'] ?? mongoose.model('ChatReport', ChatReportSchema)
