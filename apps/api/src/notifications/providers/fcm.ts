import { env } from '../../lib/env.js';
import type { PushPayload, DeliveryResult } from './types.js';

let firebaseInitialized = false;
let messagingClient: { send: (msg: unknown) => Promise<string> } | null = null;

async function getMessaging(): Promise<typeof messagingClient> {
  if (firebaseInitialized) return messagingClient;
  firebaseInitialized = true;

  if (env.USE_MOCK_SERVICES || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return null;
  }
  try {
    const admin = await import('firebase-admin');
    const json = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as Record<string, string>;
    const app = admin.default.apps.length
      ? admin.default.apps[0]!
      : admin.default.initializeApp({ credential: admin.default.credential.cert(json as never) });
    messagingClient = admin.default.messaging(app) as unknown as typeof messagingClient;
  } catch (err) {
    console.warn('[fcm] init failed, push disabled:', err);
  }
  return messagingClient;
}

export async function sendPush(p: PushPayload): Promise<DeliveryResult> {
  const m = await getMessaging();
  if (!m) {
    if (!env.USE_MOCK_SERVICES) console.warn('[fcm] not configured, dropping push');
    return { ok: env.USE_MOCK_SERVICES, provider: 'fcm', id: 'mock' };
  }
  try {
    const id = await m.send({
      token:        p.token,
      notification: { title: p.title, body: p.body },
      data:         p.data,
    });
    return { ok: true, provider: 'fcm', id };
  } catch (err) {
    return { ok: false, provider: 'fcm', error: (err as Error).message };
  }
}
