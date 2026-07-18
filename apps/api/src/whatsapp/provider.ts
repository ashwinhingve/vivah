/**
 * Smart Shaadi — WhatsApp Business provider (Unit 6.1, Tier 2)
 *
 * The single swap point for the Meta/BSP WhatsApp Cloud API. Mocked by default
 * (shouldUseMockWhatsApp) until WHATSAPP_LIVE=true AND real Meta Business + BSP
 * credentials land — the live swap is a credentials change here, not a redesign.
 * Mirrors the kyc/aadhaar.ts and lib/dailyco.ts mock-swap convention.
 */

import { shouldUseMockWhatsApp } from '../lib/env.js';

export interface WhatsAppSendPayload {
  toPhone:  string;
  template: string;
  params?:  Record<string, string | number> | undefined;
}

export interface WhatsAppProviderResult {
  ok:          boolean;
  providerRef: string;
  mock:        boolean;
}

/**
 * Send a WhatsApp Business template message. In mock mode the payload is logged
 * and a success is returned with no external call. The live branch is an
 * unimplemented TODO stub so a mis-flip (WHATSAPP_LIVE=true without creds) fails
 * loudly at send time rather than silently no-op'ing.
 */
export async function sendTemplate(payload: WhatsAppSendPayload): Promise<WhatsAppProviderResult> {
  if (shouldUseMockWhatsApp) {
    // eslint-disable-next-line no-console
    console.log(
      `[whatsapp:mock] to=${payload.toPhone} template=${payload.template} params=${JSON.stringify(payload.params ?? {})}`,
    );
    return { ok: true, providerRef: `mock-${payload.template}`, mock: true };
  }

  // TODO: real WhatsApp Cloud API call —
  //   POST https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
  //   Authorization: Bearer {WHATSAPP_API_KEY}
  //   body: { messaging_product: 'whatsapp', to, type: 'template', template: {...} }
  // Credentials-only swap; nothing else in this unit changes.
  throw new Error(
    'WhatsApp Cloud API not yet configured (set WHATSAPP_LIVE=true with Meta Business + BSP credentials)',
  );
}
