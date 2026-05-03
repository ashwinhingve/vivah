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
import { sendEmail } from '../notifications/providers/ses.js';
import { sendSms } from '../notifications/providers/msg91.js';
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

      // Real delivery via existing notification providers (SES / MSG91).
      // Mock mode short-circuits inside each provider, so no token leaks here.
      const subject = `You're invited — ${guest.name}`;
      const body = (message ? `${message}\n\n` : '') + `Please RSVP: ${rsvpLink}`;
      let delivery: { ok: boolean; error?: string };
      switch (channel) {
        case 'EMAIL':
          if (!guest.email) { delivery = { ok: false, error: 'guest.email missing' }; break; }
          delivery = await sendEmail({
            to:      guest.email,
            subject,
            html:    `<p>${(message ?? '').replace(/</g, '&lt;')}</p><p><a href="${rsvpLink}">RSVP here</a></p>`,
            text:    body,
          });
          break;
        case 'SMS':
          if (!guest.phone) { delivery = { ok: false, error: 'guest.phone missing' }; break; }
          delivery = await sendSms({ phone: guest.phone, message: body });
          break;
        case 'WHATSAPP':
          // WhatsApp Cloud / MSG91 WhatsApp template not yet wired — fail loud
          // so this code path cannot silently appear successful in production.
          delivery = { ok: false, error: 'WHATSAPP delivery not yet implemented' };
          break;
        default:
          delivery = { ok: false, error: `unknown channel ${channel as string}` };
      }

      if (!delivery.ok) {
        details.push({ guestId, error: delivery.error ?? 'delivery failed' });
        failed++;
        continue;
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
