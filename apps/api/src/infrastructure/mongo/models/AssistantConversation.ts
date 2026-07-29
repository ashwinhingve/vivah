/**
 * Assistant conversation history — READ-side model.
 *
 * The Python ai-service WRITES these documents (motor, snake_case fields — see
 * apps/ai-service/src/services/assistant_service.py persist_turn); this model
 * only reads/deletes them for the history endpoints. Field names must stay in
 * lockstep with the Python writer.
 *
 * The ai-service selects its database via MONGODB_DB (default smartshaadiDB),
 * independent of any db name in MONGODB_URI's path — so this model binds to
 * mongoose.connection.useDb(env.MONGODB_DB) to guarantee both services use the
 * same database.
 */
import { mongoose } from '../index.js';
import { env } from '../../../lib/env.js';

const AssistantMessageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    ts:      { type: Date, required: true },
  },
  { _id: false },
);

const AssistantConversationSchema = new mongoose.Schema(
  {
    conversation_id: { type: String, required: true, unique: true },
    user_id:         { type: String, required: true, index: true },
    profile_id:      { type: String, required: true },
    messages:        { type: [AssistantMessageSchema], default: [] },
    created_at:      { type: Date, required: true },
    updated_at:      { type: Date, required: true, index: true },
  },
  { collection: 'assistant_conversations', versionKey: false },
);

const conn = mongoose.connection.useDb(env.MONGODB_DB, { useCache: true });

export const AssistantConversation =
  conn.models['AssistantConversation'] ??
  conn.model('AssistantConversation', AssistantConversationSchema);
