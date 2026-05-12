/**
 * GDPR Article 15 — data export service.
 *
 * Aggregates the full user footprint into a single JSON archive:
 *   - user record + profile + profile_sections
 *   - match_requests (sent + received)
 *   - chat messages (MongoDB)
 *   - weddings the user owns
 *   - subscriptions + payment history
 *   - referral codes + referrals
 *   - consent_ledger history
 *
 * The archive is uploaded to R2 and a presigned URL valid for 7 days is
 * stored on the data_export_requests row. The export worker drives this
 * service; the routes only enqueue + read status.
 */

import { Buffer } from 'node:buffer';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq, or, desc } from 'drizzle-orm';
import {
  consentLedger, dataExportRequests, matchRequests, profiles,
  profileSections, referralCodes, referrals, subscriptions, user,
  weddings,
} from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { getPhotoUrl } from '../storage/service.js';
import { sendEmail } from '../notifications/providers/ses.js';

const EXPORT_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface ExportRequestRow {
  id:                 string;
  userId:             string;
  status:             string;
  requestedAt:        Date;
  completedAt:        Date | null;
  downloadUrl:        string | null;
  downloadExpiresAt:  Date | null;
  fileSizeBytes:      number | null;
  r2Key:              string | null;
  error:              string | null;
}

export async function createExportRequest(userId: string): Promise<ExportRequestRow> {
  const [row] = await db.insert(dataExportRequests).values({
    userId,
    status: 'PENDING',
  }).returning();
  return row as ExportRequestRow;
}

export async function getExportRequest(requestId: string): Promise<ExportRequestRow | null> {
  const [row] = await db.select()
    .from(dataExportRequests)
    .where(eq(dataExportRequests.id, requestId))
    .limit(1);
  return (row as ExportRequestRow) ?? null;
}

export async function listExportsForUser(userId: string): Promise<ExportRequestRow[]> {
  const rows = await db.select()
    .from(dataExportRequests)
    .where(eq(dataExportRequests.userId, userId))
    .orderBy(desc(dataExportRequests.requestedAt))
    .limit(20);
  return rows as ExportRequestRow[];
}

export async function markDownloaded(requestId: string): Promise<void> {
  await db.update(dataExportRequests)
    .set({ status: 'DOWNLOADED' })
    .where(eq(dataExportRequests.id, requestId));
}

interface ExportArchive {
  generatedAt:  string;
  userId:       string;
  user:         unknown;
  profile:      unknown;
  sections:     unknown[];
  matches:      unknown[];
  weddings:     unknown[];
  subscriptions: unknown[];
  referralCodes: unknown[];
  referrals:    unknown[];
  consents:     unknown[];
  chats:        unknown[];
}

async function loadChatHistory(profileId: string | null): Promise<unknown[]> {
  if (!profileId) return [];
  if (env.USE_MOCK_SERVICES) return [];
  try {
    const mod = await import('../infrastructure/mongo/models/Chat.js');
    const Chat = (mod as { Chat: { find: (q: unknown) => { lean: () => Promise<unknown[]> } } }).Chat;
    const chats = await Chat.find({ participants: profileId }).lean();
    return chats;
  } catch (e) {
    console.warn('[data-export] chat load failed:', (e as Error).message);
    return [];
  }
}

async function aggregateUserData(userId: string): Promise<ExportArchive> {
  const [userRow] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  const [profileRow] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const profileId = (profileRow as { id?: string } | undefined)?.id ?? null;

  const sectionRows = profileId
    ? await db.select().from(profileSections).where(eq(profileSections.profileId, profileId))
    : [];

  const matchRows = profileId
    ? await db.select().from(matchRequests).where(or(
        eq(matchRequests.senderId,   profileId),
        eq(matchRequests.receiverId, profileId),
      ))
    : [];

  const weddingRows = profileId
    ? await db.select().from(weddings).where(eq(weddings.profileId, profileId))
    : [];

  const subscriptionRows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));

  const referralCodeRows = await db.select().from(referralCodes).where(eq(referralCodes.ownerUserId, userId));
  const referralRows = await db.select().from(referrals).where(or(
    eq(referrals.referrerUserId, userId),
    eq(referrals.referredUserId, userId),
  ));

  const consentRows = await db.select().from(consentLedger).where(eq(consentLedger.userId, userId));

  const chats = await loadChatHistory(profileId);

  return {
    generatedAt:   new Date().toISOString(),
    userId,
    user:          userRow ?? null,
    profile:       profileRow ?? null,
    sections:      sectionRows,
    matches:       matchRows,
    weddings:      weddingRows,
    subscriptions: subscriptionRows,
    referralCodes: referralCodeRows,
    referrals:     referralRows,
    consents:      consentRows,
    chats,
  };
}

function r2Client(): S3Client {
  return new S3Client({
    region:   'auto',
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     env.CLOUDFLARE_R2_ACCESS_KEY,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_KEY,
    },
  });
}

async function uploadArchive(r2Key: string, body: Buffer): Promise<void> {
  if (env.USE_MOCK_SERVICES) return;
  const cmd = new PutObjectCommand({
    Bucket:      env.CLOUDFLARE_R2_BUCKET,
    Key:         r2Key,
    Body:        body,
    ContentType: 'application/json',
  });
  await r2Client().send(cmd);
}

export async function processExportRequest(requestId: string): Promise<void> {
  const current = await getExportRequest(requestId);
  if (!current) throw new Error(`export request not found: ${requestId}`);

  await db.update(dataExportRequests)
    .set({ status: 'PROCESSING' })
    .where(eq(dataExportRequests.id, requestId));

  try {
    const archive = await aggregateUserData(current.userId);
    const buf = Buffer.from(JSON.stringify(archive, null, 2), 'utf-8');
    const r2Key = `gdpr-exports/${current.userId}/${requestId}.json`;

    await uploadArchive(r2Key, buf);
    const downloadUrl = await getPhotoUrl(r2Key, EXPORT_TTL_SECONDS);
    const expiresAt = new Date(Date.now() + EXPORT_TTL_SECONDS * 1000);

    await db.update(dataExportRequests).set({
      status:            'READY',
      completedAt:       new Date(),
      downloadUrl,
      downloadExpiresAt: expiresAt,
      fileSizeBytes:     buf.byteLength,
      r2Key,
    }).where(eq(dataExportRequests.id, requestId));

    const userRow = (archive.user as { email?: string | null } | null) ?? null;
    const email = userRow?.email;
    if (email) {
      await sendEmail({
        to:      email,
        subject: 'Your Smart Shaadi data export is ready',
        html:    `<p>Your data archive is ready to download.</p><p><a href="${downloadUrl}">Download archive</a></p><p>This link expires in 7 days.</p>`,
        text:    `Your data archive is ready: ${downloadUrl}\nThis link expires in 7 days.`,
      });
    }
  } catch (e) {
    await db.update(dataExportRequests).set({
      status: 'FAILED',
      error:  (e as Error).message.slice(0, 500),
    }).where(eq(dataExportRequests.id, requestId));
    throw e;
  }
}
