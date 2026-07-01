// ─────────────────────────────────────────────────────────────────────────────
// SWAP FLAG: Set VIDEO_LIVE=true (with a real DAILY_CO_API_KEY) to create real
// Daily.co rooms — this escapes USE_MOCK_SERVICES like R2_LIVE, so video can go
// live while Razorpay/MSG91 stay mocked. Gate = shouldUseMockVideo.
// Real: POST https://api.daily.co/v1/rooms with Authorization: Bearer {key}
// ─────────────────────────────────────────────────────────────────────────────
import { env, shouldUseMockVideo } from './env.js';

export interface DailyRoom {
  id:        string;
  name:      string;
  url:       string;
  createdAt: string;
  expiresAt: string;
  isMock?:   boolean;
}

export async function createRoom(
  name: string,
  expiryMinutes = 60,
): Promise<DailyRoom> {
  if (shouldUseMockVideo) {
    const mockName = `mock-room-${name}-${Date.now()}`;
    return {
      id:        `mock_${Date.now()}`,
      name:      mockName,
      url:       `https://smartshaadi.daily.co/${mockName}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60000).toISOString(),
      isMock:    true,
    };
  }
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DAILY_CO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      properties: {
        exp: Math.floor(Date.now() / 1000) + expiryMinutes * 60,
        enable_chat: true,
        enable_knocking: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily.co error: ${res.status}`);
  return res.json() as Promise<DailyRoom>;
}

export async function deleteRoom(roomName: string): Promise<void> {
  if (shouldUseMockVideo) return;
  await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.DAILY_CO_API_KEY}` },
  });
}

export async function getRoom(roomName: string): Promise<DailyRoom | null> {
  if (shouldUseMockVideo) return null;
  const res = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    headers: { Authorization: `Bearer ${env.DAILY_CO_API_KEY}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<DailyRoom>;
}

export interface MeetingTokenInput {
  roomName:      string;
  userName:      string;
  isOwner?:      boolean;
  expirySeconds?: number;
}

export async function createMeetingToken(input: MeetingTokenInput): Promise<string> {
  if (shouldUseMockVideo) return `mock-token-${input.roomName}`;
  const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.DAILY_CO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: input.roomName,
        user_name: input.userName,
        is_owner:  input.isOwner ?? false,
        exp:       Math.floor(Date.now() / 1000) + (input.expirySeconds ?? 3600),
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily.co token error: ${res.status}`);
  const data = await res.json() as { token: string };
  return data.token;
}
