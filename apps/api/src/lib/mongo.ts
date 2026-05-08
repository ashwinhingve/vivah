import mongoose from 'mongoose';
import { env } from './env.js';

let connected = false;

/**
 * Connect to MongoDB. Safe to call multiple times — subsequent calls are no-ops.
 * In mock mode the connection is skipped so the API can start without MongoDB running.
 */
export async function connectMongo(): Promise<void> {
  if (connected) return;

  // MongoDB connects when:
  //   - MONGO_LIVE=true (explicit override — real Atlas while other services stay mocked)
  //   - OR USE_MOCK_SERVICES is not true (default real-services mode)
  const shouldSkip = env.USE_MOCK_SERVICES && !env.MONGO_LIVE;
  if (shouldSkip) {
    console.info('ℹ️  MongoDB skipped (USE_MOCK_SERVICES=true, MONGO_LIVE not set)');
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS:          45_000,
      connectTimeoutMS:         10_000,
      maxPoolSize:              20,
    });
    connected = true;
    console.info('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    throw err;
  }
}

export { mongoose };
