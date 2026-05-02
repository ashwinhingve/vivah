import { env } from '../../lib/env.js';
import type { EmailPayload, DeliveryResult } from './types.js';

let sesClient: { send: (cmd: unknown) => Promise<{ MessageId?: string }> } | null = null;
let initialized = false;

async function getClient(): Promise<typeof sesClient> {
  if (initialized) return sesClient;
  initialized = true;

  if (env.USE_MOCK_SERVICES || !env.AWS_SES_ACCESS_KEY) return null;
  try {
    const ses = await import('@aws-sdk/client-ses');
    sesClient = new ses.SESClient({
      region:      env.AWS_SES_REGION,
      credentials: {
        accessKeyId:     env.AWS_SES_ACCESS_KEY,
        secretAccessKey: env.AWS_SES_SECRET_KEY,
      },
    }) as unknown as typeof sesClient;
  } catch (err) {
    console.warn('[ses] init failed:', err);
  }
  return sesClient;
}

export async function sendEmail(p: EmailPayload): Promise<DeliveryResult> {
  const client = await getClient();
  if (!client) {
    if (env.USE_MOCK_SERVICES) {
      console.log(`[ses:mock] to=${p.to} subject="${p.subject}"`);
      return { ok: true, provider: 'ses', id: 'mock' };
    }
    return { ok: false, provider: 'ses', error: 'SES not configured' };
  }
  try {
    const ses = await import('@aws-sdk/client-ses');
    const cmd = new ses.SendEmailCommand({
      Source:      p.from ?? env.AWS_SES_FROM,
      Destination: { ToAddresses: [p.to] },
      Message: {
        Subject: { Data: p.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: p.html, Charset: 'UTF-8' },
          Text: { Data: p.text, Charset: 'UTF-8' },
        },
      },
    });
    const res = await client.send(cmd);
    return { ok: true, provider: 'ses', id: res.MessageId ?? '' };
  } catch (err) {
    return { ok: false, provider: 'ses', error: (err as Error).message };
  }
}
