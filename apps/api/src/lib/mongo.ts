import mongoose from 'mongoose';
import { env } from './env.js';

let connected = false;

/**
 * Connect to MongoDB. Safe to call multiple times — subsequent calls are no-ops.
 * In mock mode the connection is skipped so the API can start without MongoDB running.
 */
export async function connectMongo(): Promise<void> {
  if (connected) return;
  if (env.USE_MOCK_SERVICES) {
    console.info('ℹ️  MongoDB skipped (USE_MOCK_SERVICES=true)');
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
