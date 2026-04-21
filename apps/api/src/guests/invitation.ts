/**
 * Smart Shaadi — Invitation Delivery
 *
 * sendInvitations — generates per-guest RSVP tokens, upserts invitation rows,
 *                   and mocks delivery (real AWS SES / MSG91 wiring is a TODO).
 *
 * RSVP link format: https://smartshaadi.co.in/rsvp/{token}
 */

import { randomUUID } from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { guests, invitations, guestLists } from '@smartshaadi/db';
import { env } from '../lib/env.js';
import type { SendInvitationsInput } from '@smartshaadi/schemas';

const RSVP_BASE_URL = 'https://smartshaadi.co.in/rsvp';

export interface SendInvitationsResult {
  sent:   number;
  failed: number;
  details: Array<{ guestId: string; token?: string; error?: string }>;
}

export async function sendInvitations(
  weddingId: string,
  input: SendInvitationsInput,
): Promise<SendInvitationsResult> {
  const { guestIds, channel, message } = input;

  // Verify all requested guests belong to this wedding's guest list
  const glRows = await db
    .select({ id: guestLists.id })
    .from(guestLists)
    .where(eq(guestLists.weddingId, weddingId))
    .limit(1);

  const gl = glRows[0];
  if (!gl) {
    return { sent: 0, failed: guestIds.length, details: guestIds.map(guestId => ({ guestId, error: 'Guest list not found' })) };
  }

  const guestRows = await db
    .select()
    .from(guests)
    .where(and(
      eq(guests.guestListId, gl.id),
      inArray(guests.id, guestIds),
    ));

  const guestMap = new Map(guestRows.map(g => [g.id, g]));

  const details: SendInvitationsResult['details'] = [];
  let sent = 0;
  let failed = 0;

  for (const guestId of guestIds) {
    const guest = guestMap.get(guestId);
    if (!guest) {
      details.push({ guestId, error: 'Guest not found or does not belong to this wedding' });
      failed++;
      continue;
    }

    try {
      const token = randomUUID();
      const rsvpLink = `${RSVP_BASE_URL}/${token}`;

      // Upsert invitation: delete old and insert new to keep token fresh
      const existingInvs = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(eq(invitations.guestId, guestId))
        .limit(1);

      if (existingInvs[0]) {
        await db
          .update(invitations)
          .set({
            sentAt:    new Date(),
            channel:   channel,
            messageId: token,
            openedAt:  null,
            rsvpAt:    null,
          })
          .where(eq(invitations.id, existingInvs[0].id));
      } else {
        await db
          .insert(invitations)
          .values({
            guestId,
            sentAt:    new Date(),
            channel:   channel,
            messageId: token,
          });
      }

      if (env.USE_MOCK_SERVICES) {
        // TODO: Wire real delivery via AWS SES (EMAIL) or MSG91 (SMS / WHATSAPP)
        // when USE_MOCK_SERVICES=false. Each channel needs:
        //   EMAIL     → aws-sdk SES sendEmail with rsvpLink in body
        //   SMS       → MSG91 API POST with rsvpLink in message text
        //   WHATSAPP  → MSG91 WhatsApp API with template + rsvpLink
        console.log(
          `[MOCK] Invitation sent to guest ${guest.name} (${guestId}) via ${channel} — RSVP link: ${rsvpLink}${message ? ` | Message: ${message}` : ''}`,
        );
      } else {
        // Real delivery not yet wired. Surface the gap instead of silently
        // swallowing it — the invitation row was persisted, but nothing went out.
        // TODO: Implement:
        //   EMAIL    → aws-sdk SES sendEmail with rsvpLink in body
        //   SMS      → MSG91 API POST with rsvpLink in message text
        //   WHATSAPP → MSG91 WhatsApp API with template + rsvpLink
        throw new Error(
          `DELIVERY_NOT_IMPLEMENTED: ${channel} delivery not wired when USE_MOCK_SERVICES=false (guest ${guestId})`,
        );
      }

      details.push({ guestId, token });
      sent++;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      details.push({ guestId, error: errorMsg });
      failed++;
    }
  }

  return { sent, failed, details };
}
