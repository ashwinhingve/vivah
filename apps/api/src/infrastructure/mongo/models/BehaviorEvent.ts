import { Schema, model, models } from 'mongoose';

/**
 * BehaviorEvent — capture stream of authenticated request observations.
 * Linked to PostgreSQL user (Better Auth id) via userId. Compact projection
 * of route, method, status, duration, optional per-event meta.
 *
 * TTL: 90 days. Mongo expires documents via the `ts` index automatically.
 */

const behaviorEventSchema = new Schema(
  {
    userId:     { type: String, required: true },
    route:      { type: String, required: true },
    method:     { type: String, required: true },
    statusCode: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    ts:         { type: Date,   required: true, expires: 60 * 60 * 24 * 90 },
    meta:       { type: Schema.Types.Mixed, default: undefined },
  },
  { collection: 'behavior_events', timestamps: false, versionKey: false },
);

behaviorEventSchema.index({ userId: 1, ts: -1 });
behaviorEventSchema.index({ userId: 1, route: 1, ts: -1 });

export const BehaviorEvent =
  models.BehaviorEvent ?? model('BehaviorEvent', behaviorEventSchema);
