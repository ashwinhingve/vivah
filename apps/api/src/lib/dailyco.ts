// ─────────────────────────────────────────────────────────────────────────────
// SWAP FLAG: Set USE_MOCK_SERVICES=false once Daily.co API key is obtained
// Real: POST https://api.daily.co/v1/rooms with Authorization: Bearer {key}
// ─────────────────────────────────────────────────────────────────────────────
import { env } from './env.js';

const USE_MOCK = env.USE_MOCK_SERVICES;

export interface DailyRoom {
  id:        string;
  name:      string;
  url:       string;
  createdAt: string;
  expiresAt: string;
}

export async function createRoom(
  name: string,
  expiryMinutes = 60,
): Promise<DailyRoom> {
  if (USE_MOCK) {
    const mockName = `mock-room-${name}-${Date.now()}`;
    return {
      id:        `mock_${Date.now()}`,
      name:      mockName,
      url:       `https://smartshaadi.daily.co/${mockName}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60000).toISOString(),
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
  if (USE_MOCK) return;
  await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.DAILY_CO_API_KEY}` },
  });
}

export async function getRoom(roomName: string): Promise<DailyRoom | null> {
  if (USE_MOCK) return null;
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
  if (USE_MOCK) return `mock-token-${input.roomName}`;
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
