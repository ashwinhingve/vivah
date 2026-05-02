import { redis } from '../lib/redis.js'

const ONLINE_KEY  = (profileId: string): string => `presence:${profileId}`
const LASTSEEN_KEY = (profileId: string): string => `lastSeen:${profileId}`
const TTL_SECONDS = 60

/**
 * Mark a profile online for the next TTL_SECONDS. Sockets call this on
 * connect and every 30s heartbeat. Online status decays naturally if the
 * client disconnects without firing offline (network drops, app kills).
 */
export async function markOnline(profileId: string): Promise<void> {
  try {
    await redis.set(ONLINE_KEY(profileId), '1', 'EX', TTL_SECONDS)
  } catch {
    /* presence is best-effort */
  }
}

export async function markOffline(profileId: string): Promise<void> {
  const now = new Date().toISOString()
  try {
    await Promise.all([
      redis.del(ONLINE_KEY(profileId)),
      redis.set(LASTSEEN_KEY(profileId), now),
    ])
  } catch {
    /* best-effort */
  }
}

export async function isOnline(profileId: string): Promise<boolean> {
  try {
    return (await redis.exists(ONLINE_KEY(profileId))) === 1
  } catch {
    return false
  }
}

export async function getLastSeen(profileId: string): Promise<string | null> {
  try {
    return await redis.get(LASTSEEN_KEY(profileId))
  } catch {
    return null
  }
}

export async function getPresence(
  profileId: string,
): Promise<{ isOnline: boolean; lastSeenAt: string | null }> {
  const [online, lastSeen] = await Promise.all([isOnline(profileId), getLastSeen(profileId)])
  return { isOnline: online, lastSeenAt: lastSeen }
}

export async function getPresenceMany(
  profileIds: string[],
): Promise<Record<string, { isOnline: boolean; lastSeenAt: string | null }>> {
  if (profileIds.length === 0) return {}
  try {
    const onlineKeys = profileIds.map(ONLINE_KEY)
    const lastSeenKeys = profileIds.map(LASTSEEN_KEY)
    const [onlineVals, lastSeenVals] = await Promise.all([
      redis.mget(...onlineKeys),
      redis.mget(...lastSeenKeys),
    ])
    const out: Record<string, { isOnline: boolean; lastSeenAt: string | null }> = {}
    profileIds.forEach((id, i) => {
      out[id] = {
        isOnline: onlineVals[i] === '1',
        lastSeenAt: lastSeenVals[i] ?? null,
      }
    })
    return out
  } catch {
    return Object.fromEntries(profileIds.map((id) => [id, { isOnline: false, lastSeenAt: null }]))
  }
}
