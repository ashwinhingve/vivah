/**
 * Smart Shaadi — WhatsApp Business Router (Unit 6.1, Tier 2)
 *
 * UNMOUNTED here — Phase 2 mounts this at /api/v1/whatsapp.
 *
 * Routes:
 *   POST /whatsapp/send      → queueWhatsAppMessage   (auth, ADMIN — ops/booking trigger)
 *   GET  /whatsapp/messages  → own profile's messages (auth; ADMIN sees recent 100)
 *
 * Sends are always enqueued via Bull (never sync). Mocked until WHATSAPP_LIVE.
 */

import { Router, type Response } from 'express';
import { SendWhatsAppSchema } from '@smartshaadi/schemas';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { resolveProfileId } from '../lib/profile.js';
import {
  queueWhatsAppMessage,
  listWhatsAppMessages,
  listRecentWhatsAppMessages,
  WhatsAppError,
} from './service.js';

export const whatsappRouter = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  INSERT_FAILED: 500,
  VALIDATION_ERROR: 400,
};

function handleWhatsAppError(res: Response, e: unknown): void {
  if (e instanceof WhatsAppError) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  err(res, 'INTERNAL_ERROR', msg, 500);
}

// ── Send a template message (admin/ops trigger) ──────────────────────────────
whatsappRouter.post('/send', authenticate, authorize(['ADMIN']), async (req, res) => {
  const parsed = SendWhatsAppSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }

  try {
    // Attribute the message to the admin's profile when they have one; else null
    // (system recipient). Kept optional so ops can message a raw phone number.
    const profileId = await resolveProfileId(req.user!.id);
    const result = await queueWhatsAppMessage({
      profileId,
      toPhone:  parsed.data.toPhone,
      template: parsed.data.template,
      params:   parsed.data.params,
    });
    ok(res, result, 202);
  } catch (e) {
    handleWhatsAppError(res, e);
  }
});

// ── List messages ────────────────────────────────────────────────────────────
whatsappRouter.get('/messages', authenticate, async (req, res) => {
  try {
    if (req.user!.role === 'ADMIN') {
      const messages = await listRecentWhatsAppMessages();
      ok(res, { messages });
      return;
    }
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }
    const messages = await listWhatsAppMessages(profileId);
    ok(res, { messages });
  } catch (e) {
    handleWhatsAppError(res, e);
  }
});
