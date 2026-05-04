import { describe, it, expect, vi, beforeEach } from 'vitest';

// Verifies fix for C1: DISPUTE_RAISED_VENDOR and DISPUTE_NEEDS_REVIEW jobs
// produce real notification copy through the render switch instead of being
// dropped to the generic fallback (which used the empty payload title/body).

const sentEmails: Array<{ to: string; subject: string }> = [];
const sentSmses:  Array<{ phone: string; message: string }> = [];
const inserted:   Array<{ userId: string; type: string; title: string; body: string }> = [];

vi.mock('../providers/fcm.js',   () => ({ sendPush:  vi.fn(async () => ({ ok: true,  provider: 'fcm',  id: 'm' })) }));
vi.mock('../providers/ses.js',   () => ({ sendEmail: vi.fn(async (p: { to: string; subject: string }) => { sentEmails.push(p); return { ok: true,  provider: 'ses',   id: 'm' }; }) }));
vi.mock('../providers/msg91.js', () => ({ sendSms:   vi.fn(async (p: { phone: string; message: string }) => { sentSmses.push(p); return { ok: true,  provider: 'msg91', id: 'm' }; }) }));

vi.mock('drizzle-orm', () => ({
  eq:  vi.fn(() => ({ type: 'eq' })),
  and: vi.fn(() => ({ type: 'and' })),
}));

vi.mock('@smartshaadi/db', () => ({
  user:                    {},
  notifications:           {},
  notificationPreferences: {},
  deviceTokens:            {},
  profiles:                {},
}));

const dbResponses: Record<string, unknown[]> = {
  prefs:    [{ push: false, sms: false, email: true, inApp: true, marketing: false, mutedTypes: [] }],
  user:     [{ name: 'Alice', email: 'alice@example.com', phoneNumber: '+919876543210' }],
  tokens:   [],
  profiles: [{ userId: 'user-resolved' }],
};

let queryNum = 0;
const queryOrder: Array<keyof typeof dbResponses> = ['prefs', 'user', 'tokens'];

function makeWhereChain() {
  // Awaitable directly OR via .limit() — both pop the next response.
  const rows = (): unknown[] => dbResponses[queryOrder[queryNum++] ?? 'prefs'] ?? [];
  const obj: { then: typeof Promise.prototype.then; limit: () => Promise<unknown[]> } = {
    then: (resolve, reject) => Promise.resolve(rows()).then(resolve, reject),
    limit: () => Promise.resolve(rows()),
  };
  return obj;
}

vi.mock('../../infrastructure/redis/queues.js', () => ({
  notificationsQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => makeWhereChain()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockImplementation((row: { userId: string; type: string; title: string; body: string }) => {
        inserted.push(row);
        return Promise.resolve();
      }),
    })),
  },
}));

describe('notifications/service > dispute event types', () => {
  beforeEach(() => {
    sentEmails.length = 0;
    sentSmses.length = 0;
    inserted.length = 0;
    queryNum = 0;
  });

  it('renders DISPUTE_RAISED_VENDOR with vendor-facing copy', async () => {
    const { deliverNotification } = await import('../service.js');
    const r = await deliverNotification({
      userId:  'user-resolved',
      type:    'DISPUTE_RAISED_VENDOR',
      payload: { bookingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', reason: 'Service not delivered' },
    });
    expect(r.sentVia).toContain('inapp');
    expect(inserted[0]?.title).toBe('Customer raised a dispute');
    expect(inserted[0]?.body).toContain('aaaaaaaa');
    expect(sentEmails[0]?.subject).toContain('Customer raised a dispute');
  });

  it('renders DISPUTE_NEEDS_REVIEW with admin-facing copy', async () => {
    const { deliverNotification } = await import('../service.js');
    const r = await deliverNotification({
      userId:  'user-resolved',
      type:    'DISPUTE_NEEDS_REVIEW',
      payload: { bookingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', reason: 'Disputed by customer' },
    });
    expect(r.sentVia).toContain('inapp');
    expect(inserted[0]?.title).toBe('Dispute needs admin review');
  });
});
