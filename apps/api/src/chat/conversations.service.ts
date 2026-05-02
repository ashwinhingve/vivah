import type { Model } from 'mongoose'
import { eq, inArray, and } from 'drizzle-orm'
import { profiles, profilePhotos, user } from '@smartshaadi/db'
import { db } from '../lib/db.js'
import { Chat } from '../infrastructure/mongo/models/Chat.js'
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js'
import { env } from '../lib/env.js'
import { mockGet } from '../lib/mockStore.js'
import { getPresenceMany } from './presence.js'
import type { ConversationListItem, ConversationParticipantPreview } from '@smartshaadi/types'

function ageFromDob(dob: Date | null | undefined): number | null {
  if (!dob) return null
  const ms = Date.now() - new Date(dob).getTime()
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000))
}

/**
 * Build participant preview cards for a list of profile IDs in batched
 * queries — one PG query for profiles+user+photo, one Mongo query for
 * personal/location, one Redis MGET for presence. O(1) round-trips.
 */
async function buildParticipantPreviews(
  profileIds: string[],
): Promise<Map<string, ConversationParticipantPreview>> {
  const out = new Map<string, ConversationParticipantPreview>()
  if (profileIds.length === 0) return out

  const [profileRows, photoRows, presenceMap] = await Promise.all([
    db
      .select({
        profileId: profiles.id,
        userId:    profiles.userId,
        name:      user.name,
      })
      .from(profiles)
      .innerJoin(user, eq(profiles.userId, user.id))
      .where(inArray(profiles.id, profileIds)),
    db
      .select()
      .from(profilePhotos)
      .where(
        and(inArray(profilePhotos.profileId, profileIds), eq(profilePhotos.isPrimary, true)),
      ),
    getPresenceMany(profileIds),
  ])

  const photoByProfile = new Map<string, string>()
  for (const p of photoRows) photoByProfile.set(p.profileId, p.r2Key)

  let contentByUser = new Map<string, { city: string | null; dob: Date | null; firstName: string | null }>()
  if (!env.USE_MOCK_SERVICES) {
    const userIds = profileRows.map((r) => r.userId)
    if (userIds.length > 0) {
      const model = ProfileContent as unknown as Model<{
        userId:    string
        personal?: { fullName?: string; dob?: Date }
        location?: { city?: string }
      }>
      const docs = await model
        .find({ userId: { $in: userIds } })
        .select('userId personal.fullName personal.dob location.city')
        .lean()
      for (const d of docs) {
        const fullName = d.personal?.fullName ?? null
        const firstName = fullName ? fullName.split(/\s+/)[0] ?? null : null
        contentByUser.set(d.userId, {
          city: d.location?.city ?? null,
          dob:  d.personal?.dob ?? null,
          firstName,
        })
      }
    }
  } else {
    contentByUser = new Map()
  }

  for (const r of profileRows) {
    const content = contentByUser.get(r.userId)
    const baseFirst = content?.firstName ?? (r.name ? r.name.split(/\s+/)[0] ?? null : null)
    out.set(r.profileId, {
      profileId:       r.profileId,
      firstName:       baseFirst,
      age:             ageFromDob(content?.dob ?? null),
      city:            content?.city ?? null,
      primaryPhotoKey: photoByProfile.get(r.profileId) ?? null,
      isOnline:        presenceMap[r.profileId]?.isOnline ?? false,
      lastSeenAt:      presenceMap[r.profileId]?.lastSeenAt ?? null,
    })
  }

  return out
}

/**
 * Get a single participant preview. Used by the chat detail page header.
 */
export async function getParticipantPreview(
  profileId: string,
): Promise<ConversationParticipantPreview | null> {
  const map = await buildParticipantPreviews([profileId])
  return map.get(profileId) ?? null
}

/**
 * Compute unread count for a viewer in a given chat — messages where the
 * viewer's profileId is NOT in readBy and they aren't the sender.
 */
function unreadCountFor(
  messages: Array<{ senderId: string; readBy?: string[]; deletedAt?: Date | null }>,
  viewerProfileId: string,
): number {
  let n = 0
  for (const m of messages) {
    if (m.deletedAt) continue
    if (m.senderId === viewerProfileId) continue
    if (m.readBy && m.readBy.includes(viewerProfileId)) continue
    n++
  }
  return n
}

interface ListConversationsOpts {
  profileId: string
  filter?:   'all' | 'unread' | 'archived'
}

interface RawChatDoc {
  matchRequestId: string
  participants:   string[]
  isActive:       boolean
  updatedAt:      Date
  lastMessage:    { content?: string; sentAt?: Date; senderId?: string; type?: string } | null
  messages:       Array<{ senderId: string; readBy?: string[]; deletedAt?: Date | null }>
  pinnedMessageIds?: string[]
  settings?: {
    mutedBy?:    string[]
    archivedBy?: string[]
    pinnedBy?:   string[]
    wallpaper?:  string | null
  }
}

export async function listConversations(
  opts: ListConversationsOpts,
): Promise<ConversationListItem[]> {
  const { profileId, filter = 'all' } = opts

  if (env.USE_MOCK_SERVICES) return []

  const docs = (await Chat.find({ participants: profileId })
    .select(
      'matchRequestId participants lastMessage isActive updatedAt messages.senderId messages.readBy messages.deletedAt pinnedMessageIds settings',
    )
    .sort({ updatedAt: -1 })
    .lean()) as unknown as RawChatDoc[]

  const otherProfileIds = Array.from(
    new Set(
      docs.flatMap((d) => d.participants.filter((p) => p !== profileId)),
    ),
  )
  const previews = await buildParticipantPreviews(otherProfileIds)

  const items: ConversationListItem[] = docs.map((d) => {
    const otherId = d.participants.find((p) => p !== profileId) ?? null
    const archived = d.settings?.archivedBy?.includes(profileId) ?? false
    const pinned   = d.settings?.pinnedBy?.includes(profileId)   ?? false
    const muted    = d.settings?.mutedBy?.includes(profileId)    ?? false
    return {
      matchRequestId: d.matchRequestId,
      participants:   d.participants,
      lastMessage:    d.lastMessage?.content
        ? {
            content:  d.lastMessage.content,
            sentAt:   (d.lastMessage.sentAt ?? d.updatedAt).toISOString(),
            senderId: d.lastMessage.senderId ?? '',
            type:     ((d.lastMessage.type as 'TEXT' | 'PHOTO' | 'VOICE' | 'SYSTEM' | undefined) ?? 'TEXT'),
          }
        : null,
      isActive:       d.isActive,
      unreadCount:    unreadCountFor(d.messages ?? [], profileId),
      settings:       {
        mutedUntil: muted ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString() : null,
        archived,
        pinned,
        wallpaper: d.settings?.wallpaper ?? null,
      },
      other:          otherId ? previews.get(otherId) ?? null : null,
      updatedAt:      d.updatedAt.toISOString(),
    }
  })

  const filtered = items.filter((it) => {
    if (filter === 'unread')   return it.unreadCount > 0 && !it.settings.archived
    if (filter === 'archived') return it.settings.archived
    return !it.settings.archived
  })

  filtered.sort((a, b) => {
    if (a.settings.pinned !== b.settings.pinned) return a.settings.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return filtered
}

/** Suppress unused-import error in mock-only paths. */
void mockGet
