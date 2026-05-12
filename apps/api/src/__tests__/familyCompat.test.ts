/**
 * Family Compatibility API tests (P3 Phase 3 item 9).
 * Better Auth + familyCompatService mocked. Tests assert route wiring,
 * authorization translation, and joint-score arithmetic via direct service calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const {
  mockGetSession,
  mockSubmitRating,
  mockGetRatings,
  mockComputeJoint,
  mockDeleteRating,
} = vi.hoisted(() => ({
  mockGetSession:    vi.fn(),
  mockSubmitRating:  vi.fn(),
  mockGetRatings:    vi.fn(),
  mockComputeJoint:  vi.fn(),
  mockDeleteRating:  vi.fn(),
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
  submitRating:             mockSubmitRating,
  getRatingsForCandidate:   mockGetRatings,
  computeJointScore:        mockComputeJoint,
  deleteRating:             mockDeleteRating,
  batchComputeJointScores:  vi.fn().mockResolvedValue(new Map()),
}));
vi.mock('../services/parentModeService.js', () => ({
  createParentLink:    vi.fn(),
  approveLink:         vi.fn(),
  revokeLink:          vi.fn(),
  listMyLinks:         vi.fn(),
  draftAction:         vi.fn(),
  approveAction:       vi.fn(),
  rejectAction:        vi.fn(),
  listPendingActions:  vi.fn(),
  listDraftedActions:  vi.fn(),
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

const USER = { id: 'user_a', role: 'INDIVIDUAL', status: 'ACTIVE', phoneNumber: '+91' };
const SUBJECT = '550e8400-e29b-41d4-a716-446655440001';
const CANDIDATE = '550e8400-e29b-41d4-a716-446655440002';
const RATING_ID = '550e8400-e29b-41d4-a716-446655440099';

describe('Family Compatibility — routes + service contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: USER, session: {} });
  });

  it('POST /ratings — happy path creates rating + returns joint score', async () => {
    mockSubmitRating.mockResolvedValueOnce({
      ratingId: RATING_ID,
      joint: { jointScore: 72, familySignalCount: 1, agreementPct: 100, userMatchScore: 80, familyAvgScore: 70 },
    });
    const res = await request(buildApp())
      .post('/api/v1/family-mode/ratings')
      .send({ subject_profile_id: SUBJECT, candidate_profile_id: CANDIDATE, overall_score: 70 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.joint.jointScore).toBe(72);
    expect(mockSubmitRating).toHaveBeenCalledWith(expect.objectContaining({
      raterUserId: 'user_a', subjectProfileId: SUBJECT, candidateProfileId: CANDIDATE, overallScore: 70,
    }));
  });

  it('POST /ratings — translates FORBIDDEN service error to 403', async () => {
    const e = new Error('Not authorized') as Error & { code: string };
    e.code = 'FORBIDDEN';
    mockSubmitRating.mockRejectedValueOnce(e);
    const res = await request(buildApp())
      .post('/api/v1/family-mode/ratings')
      .send({ subject_profile_id: SUBJECT, candidate_profile_id: CANDIDATE, overall_score: 50 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /ratings — 422 on invalid overall_score', async () => {
    const res = await request(buildApp())
      .post('/api/v1/family-mode/ratings')
      .send({ subject_profile_id: SUBJECT, candidate_profile_id: CANDIDATE, overall_score: 150 });
    expect(res.status).toBe(422);
  });

  it('GET /ratings/:subject/:candidate — returns ratings + joint score', async () => {
    mockGetRatings.mockResolvedValueOnce([{
      id: RATING_ID, raterUserId: 'user_dad', subjectProfileId: SUBJECT,
      candidateProfileId: CANDIDATE, overallScore: 80, compatibilityConcerns: null,
      notes: null, ratedAt: new Date(), raterRelationship: 'FATHER', raterDisplayName: null,
    }]);
    mockComputeJoint.mockResolvedValueOnce({
      jointScore: 75, familySignalCount: 1, agreementPct: 100, userMatchScore: 72, familyAvgScore: 80,
    });
    const res = await request(buildApp())
      .get(`/api/v1/family-mode/ratings/${SUBJECT}/${CANDIDATE}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ratings.length).toBe(1);
    expect(res.body.data.joint.jointScore).toBe(75);
  });

  it('DELETE /ratings/:id — happy path returns deleted=true; 404 when missing', async () => {
    mockDeleteRating.mockResolvedValueOnce({ subjectProfileId: SUBJECT, candidateProfileId: CANDIDATE });
    const ok = await request(buildApp()).delete(`/api/v1/family-mode/ratings/${RATING_ID}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.deleted).toBe(true);

    mockDeleteRating.mockResolvedValueOnce(null);
    const missing = await request(buildApp()).delete(`/api/v1/family-mode/ratings/${RATING_ID}`);
    expect(missing.status).toBe(404);
  });
});
