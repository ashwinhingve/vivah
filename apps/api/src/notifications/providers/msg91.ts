import { env } from '../../lib/env.js';
import type { SmsPayload, DeliveryResult } from './types.js';

const MSG91_BASE = 'https://api.msg91.com/api/v5';

export async function sendSms(p: SmsPayload): Promise<DeliveryResult> {
  if (env.USE_MOCK_SERVICES || !env.MSG91_API_KEY) {
    if (env.USE_MOCK_SERVICES) {
      console.log(`[msg91:mock] phone=${p.phone} msg="${p.message.slice(0, 60)}..."`);
      return { ok: true, provider: 'msg91', id: 'mock' };
    }
    return { ok: false, provider: 'msg91', error: 'MSG91 not configured' };
  }

  try {
    const phone = p.phone.replace(/^\+/, '');
    const res = await fetch(`${MSG91_BASE}/flow/`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey:        env.MSG91_API_KEY,
      },
      body: JSON.stringify({
        template_id: p.template ?? env.MSG91_TEMPLATE_ID,
        recipients:  [{ mobiles: phone, message: p.message }],
      }),
    });
    if (!res.ok) {
      return { ok: false, provider: 'msg91', error: `HTTP ${res.status}` };
    }
    const data = await res.json() as { request_id?: string };
    return { ok: true, provider: 'msg91', id: data.request_id ?? '' };
  } catch (err) {
    return { ok: false, provider: 'msg91', error: (err as Error).message };
  }
}
