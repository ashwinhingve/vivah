/**
 * WhatsApp Business (Unit 6.1) — provider mock parity + enqueue-not-sync.
 *
 * Two guarantees:
 *  A. The provider is MOCKED unless WHATSAPP_LIVE=true (a mis-flip throws loudly).
 *  B. queueWhatsAppMessage persists a QUEUED row and ENQUEUES the send — it never
 *     calls the provider synchronously (Rule 8). The worker path flips it to MOCKED.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── A. Provider mock parity ──────────────────────────────────────────────────
async function loadProvider(useMockWhatsApp: boolean) {
  vi.resetModules();
  vi.doMock('../../lib/env.js', () => ({ shouldUseMockWhatsApp: useMockWhatsApp, env: {} }));
  return import('../provider.js');
}

describe('WhatsApp provider mock parity', () => {
  it('shouldUseMockWhatsApp=true → sendTemplate returns a mock success, no external call', async () => {
    const provider = await loadProvider(true);
    const result = await provider.sendTemplate({ toPhone: '+919876543210', template: 'BOOKING_CONFIRMATION' });
    expect(result.mock).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.providerRef).toMatch(/^mock-/);
  });

  it('shouldUseMockWhatsApp=false → sendTemplate throws (real Cloud API unconfigured)', async () => {
    const provider = await loadProvider(false);
    await expect(
      provider.sendTemplate({ toPhone: '+919876543210', template: 'BOOKING_CONFIRMATION' }),
    ).rejects.toThrow('WhatsApp Cloud API not yet configured');
  });
});

// ── B. Service enqueue-not-sync + worker path ────────────────────────────────
const queueAdd = vi.fn().mockResolvedValue(undefined);
const sendTemplate = vi.fn();
let insertedRow: Record<string, unknown> = {};
let selectedRow: Record<string, unknown> | undefined;
const updateSet = vi.fn().mockResolvedValue(undefined);
const capturedUpdate: { set?: Record<string, unknown> } = {};

async function loadService() {
  vi.resetModules();
  queueAdd.mockClear();
  sendTemplate.mockReset();
  updateSet.mockClear();
  delete capturedUpdate.set;

  vi.doMock('../../lib/env.js', () => ({ shouldUseMockWhatsApp: true, env: {} }));
  vi.doMock('../../infrastructure/redis/queues.js', () => ({
    whatsappQueue: { add: queueAdd },
    DEFAULT_JOB_OPTS: {},
  }));
  vi.doMock('../provider.js', () => ({ sendTemplate }));
  vi.doMock('../../lib/db.js', () => ({
    db: {
      insert: () => ({ values: () => ({ returning: async () => [insertedRow] }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => (selectedRow ? [selectedRow] : []) }) }) }),
      update: () => ({ set: (v: Record<string, unknown>) => { capturedUpdate.set = v; return { where: updateSet }; } }),
    },
  }));
  return import('../service.js');
}

describe('WhatsApp service enqueue behavior', () => {
  beforeEach(() => { insertedRow = {}; selectedRow = undefined; });

  it('queueWhatsAppMessage persists QUEUED + enqueues, never calls the provider inline', async () => {
    insertedRow = { id: 'wa-1', mock: true };
    const svc = await loadService();
    const result = await svc.queueWhatsAppMessage({
      profileId: 'p1', toPhone: '+919876543210', template: 'BOOKING_CONFIRMATION',
    });
    expect(result).toEqual({ id: 'wa-1', status: 'QUEUED', providerRef: null, mock: true });
    expect(queueAdd).toHaveBeenCalledWith('send', { messageId: 'wa-1' }, expect.objectContaining({ jobId: 'wa-wa-1' }));
    expect(sendTemplate).not.toHaveBeenCalled(); // enqueued, not sent inline
  });

  it('processWhatsAppMessage sends via provider and marks the row MOCKED', async () => {
    selectedRow = { id: 'wa-1', toPhone: '+919876543210', template: 'BOOKING_CONFIRMATION', params: null };
    const svc = await loadService(); // resets sendTemplate — configure it AFTER
    sendTemplate.mockResolvedValue({ ok: true, providerRef: 'mock-BOOKING_CONFIRMATION', mock: true });
    await svc.processWhatsAppMessage('wa-1');
    expect(sendTemplate).toHaveBeenCalledTimes(1);
    expect(capturedUpdate.set).toMatchObject({ status: 'MOCKED', providerRef: 'mock-BOOKING_CONFIRMATION' });
  });

  it('processWhatsAppMessage throws NOT_FOUND for an unknown message id', async () => {
    selectedRow = undefined;
    const svc = await loadService();
    await expect(svc.processWhatsAppMessage('missing')).rejects.toThrow('not found');
  });
});
