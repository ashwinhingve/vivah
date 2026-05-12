/**
 * Parent Mode API tests (P3 Phase 3 item 10).
 * Better Auth + parentModeService mocked. Exercises link lifecycle + action
 * draft/approve/reject + permission gating + expiry semantics through the
 * route layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const {
  mockGetSession,
  mockCreateLink,
  mockApproveLink,
  mockRevokeLink,
  mockListMyLinks,
  mockDraftAction,
  mockApproveAction,
  mockRejectAction,
  mockListPending,
  mockListDrafted,
} = vi.hoisted(() => ({
  mockGetSession:     vi.fn(),
  mockCreateLink:     vi.fn(),
  mockApproveLink:    vi.fn(),
  mockRevokeLink:     vi.fn(),
  mockListMyLinks:    vi.fn(),
  mockDraftAction:    vi.fn(),
  mockApproveAction:  vi.fn(),
  mockRejectAction:   vi.fn(),
  mockListPending:    vi.fn(),
  mockListDrafted:    vi.fn(),
}));

vi.mock('../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => { res.json({ success: true }); }),
    api: { getSession: mockGetSession },
  },
}));
vi.mock('better-auth/node', () => ({
  toNodeHandler: (authObj: { handler: (req: Request, res: Response) => void }) =>
    (req: Request, res: Response) => authObj.handler(req, res),
  fromNodeHeaders: vi.fn((h: Record<string, string>) => h),
}));
vi.mock('../auth/lastActive.js', () => ({ pingLastActive: vi.fn() }));

vi.mock('../services/familyCompatService.js', () => ({
  submitRating:             vi.fn(),
  getRatingsForCandidate:   vi.fn(),
  computeJointScore:        vi.fn(),
  deleteRating:             vi.fn(),
  batchComputeJointScores:  vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../services/parentModeService.js', () => ({
  createParentLink:   mockCreateLink,
  approveLink:        mockApproveLink,
  revokeLink:         mockRevokeLink,
  listMyLinks:        mockListMyLinks,
  draftAction:        mockDraftAction,
  approveAction:      mockApproveAction,
  rejectAction:       mockRejectAction,
  listPendingActions: mockListPending,
  listDraftedActions: mockListDrafted,
}));

vi.mock('../lib/env.js', () => ({
  env: { NODE_ENV: 'test', USE_MOCK_SERVICES: false, DATABASE_URL: 'postgres://x' },
}));
vi.mock('../lib/redis.js', () => ({
  redis: { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) },
}));

import { familyModeRouter } from '../routes/familyMode.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/family-mode', familyModeRouter);
  return app;
}

const PARENT = { id: 'user_parent', role: 'INDIVIDUAL', status: 'ACTIVE', phoneNumber: '+91' };
const LINK_ID = '550e8400-e29b-41d4-a716-446655440011';
const ACTION_ID = '550e8400-e29b-41d4-a716-446655440022';

describe('Parent Mode — links + drafted actions routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: PARENT, session: {} });
  });

  it('POST /parent/links — creates pending link', async () => {
    mockCreateLink.mockResolvedValueOnce({
      id: LINK_ID, parentUserId: 'user_parent', childUserId: 'user_child',
      relationship: 'FATHER', permissions: 'DRAFT_ACTIONS',
      childConsentStatus: 'PENDING', childConsentedAt: null, createdAt: new Date(), revokedAt: null,
    });
    const res = await request(buildApp())
      .post('/api/v1/family-mode/parent/links')
      .send({ child_user_id: 'user_child', relationship: 'FATHER', requested_permissions: 'DRAFT_ACTIONS' });

    expect(res.status).toBe(201);
    expect(res.body.data.childConsentStatus).toBe('PENDING');
    expect(mockCreateLink).toHaveBeenCalledWith(expect.objectContaining({
      parentUserId: 'user_parent', childUserId: 'user_child', relationship: 'FATHER',
      requestedPermissions: 'DRAFT_ACTIONS',
    }));
  });

  it('POST /parent/links — 409 LINK_EXISTS surfaces as 409', async () => {
    const e = new Error('exists') as Error & { code: string };
    e.code = 'LINK_EXISTS';
    mockCreateLink.mockRejectedValueOnce(e);
    const res = await request(buildApp())
      .post('/api/v1/family-mode/parent/links')
      .send({ child_user_id: 'user_child', relationship: 'FATHER' });
    expect(res.status).toBe(409);
  });

  it('POST /parent/actions — draft action 403 INSUFFICIENT_PERMISSION', async () => {
    const e = new Error('permission') as Error & { code: string };
    e.code = 'INSUFFICIENT_PERMISSION';
    mockDraftAction.mockRejectedValueOnce(e);
    const res = await request(buildApp())
      .post('/api/v1/family-mode/parent/actions')
      .send({ child_user_id: 'user_child', action_type: 'SEND_INTEREST', payload: { targetProfileId: 'x' } });
    expect(res.status).toBe(403);
  });

  it('POST /parent/actions/:id/approve — happy path returns EXECUTED action', async () => {
    mockApproveAction.mockResolvedValueOnce({
      id: ACTION_ID, parentUserId: 'p', childUserId: 'user_parent',
      actionType: 'SEND_INTEREST', payload: {}, status: 'EXECUTED',
      parentDraftedAt: new Date(), childRespondedAt: new Date(), executedAt: new Date(),
      expiresAt: null, errorMessage: null,
    });
    const res = await request(buildApp())
      .post(`/api/v1/family-mode/parent/actions/${ACTION_ID}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('EXECUTED');
  });

  it('POST /parent/actions/:id/approve — 410 GONE when EXPIRED service error', async () => {
    const e = new Error('expired') as Error & { code: string };
    e.code = 'EXPIRED';
    mockApproveAction.mockRejectedValueOnce(e);
    const res = await request(buildApp())
      .post(`/api/v1/family-mode/parent/actions/${ACTION_ID}/approve`);
    expect(res.status).toBe(410);
  });
});
