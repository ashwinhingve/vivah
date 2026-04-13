# KYC & Identity Verification Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete KYC pipeline — Aadhaar verification (Digilocker mock), photo fraud detection (AWS Rekognition), duplicate account detection, verified badge, and an admin review queue — without storing any raw Aadhaar data.

**Architecture:** KYC follows the same layered pattern as auth: Router → Service → external clients (Aadhaar/Rekognition). Status lives in the existing `profiles.verification_status` column (PENDING → MANUAL_REVIEW → VERIFIED | REJECTED). A new `kyc_verifications` table stores fraud detection results and admin review metadata. All status changes go through MANUAL_REVIEW first — no auto-approval, no auto-rejection.

**Tech Stack:** Express.js · Drizzle ORM (PostgreSQL) · @aws-sdk/client-rekognition · @aws-sdk/client-s3 (R2 download) · Vitest · Zod · @smartshaadi/types · @smartshaadi/schemas · @smartshaadi/db

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `packages/db/schema/kyc.ts` | `kyc_verifications` table + relations |
| `packages/types/src/kyc.ts` | `KycErrorCode`, `PhotoAnalysis`, `KycStatusResponse` types |
| `packages/schemas/src/kyc.ts` | Zod schemas for KYC endpoints |
| `apps/api/src/kyc/aadhaar.ts` | Digilocker OAuth mock (one-line real swap) |
| `apps/api/src/kyc/rekognition.ts` | AWS Rekognition + R2 download |
| `apps/api/src/kyc/service.ts` | Core KYC business logic |
| `apps/api/src/kyc/router.ts` | Route handlers (user + admin endpoints) |
| `apps/api/src/kyc/__tests__/service.test.ts` | Vitest tests for service logic |

### Modified files
| File | Change |
|------|--------|
| `packages/db/schema/index.ts` | Add `kycVerifications` table + relations at bottom |
| `packages/types/src/index.ts` | Add `export * from './kyc.js'` |
| `packages/schemas/src/index.ts` | Add `export * from './kyc.js'` |
| `apps/api/src/lib/env.ts` | Add `AWS_REKOGNITION_REGION` validation |
| `apps/api/src/index.ts` | Mount KYC router at `/api/v1` |
| `apps/api/package.json` | Add `@aws-sdk/client-rekognition`, `@aws-sdk/client-s3` |

---

## Task 1: Add `kyc_verifications` DB table

**Files:**
- Modify: `packages/db/schema/index.ts` (append near end, before relations)

- [ ] **Step 1: Add PhotoAnalysis type import comment and kycVerifications table**

Append to `packages/db/schema/index.ts`, right after the `profilePhotos` table block and before the matchmaking section:

```typescript
// ── KYC ─────────────────────────────────────────────────────────────────────

export const kycVerifications = pgTable('kyc_verifications', {
  id:               uuid('id').primaryKey().defaultRandom(),
  profileId:        uuid('profile_id').unique().notNull()
                      .references(() => profiles.id, { onDelete: 'cascade' }),
  aadhaarVerified:  boolean('aadhaar_verified').default(false).notNull(),
  aadhaarRefId:     varchar('aadhaar_ref_id', { length: 100 }),   // DigiLocker ref, never Aadhaar number
  photoAnalysis:    jsonb('photo_analysis'),                        // PhotoAnalysis JSON
  duplicateFlag:    boolean('duplicate_flag').default(false).notNull(),
  duplicateReason:  text('duplicate_reason'),
  adminNote:        text('admin_note'),
  reviewedBy:       uuid('reviewed_by').references(() => users.id),
  reviewedAt:       timestamp('reviewed_at'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('kyc_profile_idx').on(t.profileId),
]);
```

- [ ] **Step 2: Add relations for kycVerifications**

In the relations section at the bottom of `packages/db/schema/index.ts`, add:

```typescript
export const kycVerificationsRelations = relations(kycVerifications, ({ one }) => ({
  profile:  one(profiles,  { fields: [kycVerifications.profileId],  references: [profiles.id] }),
  reviewer: one(users,     { fields: [kycVerifications.reviewedBy], references: [users.id] }),
}));
```

Also update `profilesRelations` to add `kycVerification: one(kycVerifications)`.

- [ ] **Step 3: Push schema to dev DB**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm db:push
```

Expected: `kyc_verifications` table created, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/schema/index.ts
git commit -m "feat(db): add kyc_verifications table"
```

---

## Task 2: KYC types package

**Files:**
- Create: `packages/types/src/kyc.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Write the test (types are compile-time, so write a type test)**

Create `packages/types/src/__tests__/kyc.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { KycErrorCode } from '../kyc.js';

describe('KycErrorCode', () => {
  it('has all required error codes', () => {
    const expected = [
      'PROFILE_NOT_FOUND',
      'KYC_ALREADY_VERIFIED',
      'KYC_IN_REVIEW',
      'KYC_REJECTED',
      'DUPLICATE_ACCOUNT_DETECTED',
      'PHOTO_FRAUD_DETECTED',
      'AADHAAR_VERIFICATION_FAILED',
    ];
    expected.forEach(code => {
      expect(KycErrorCode).toHaveProperty(code);
      expect(KycErrorCode[code as keyof typeof KycErrorCode]).toBe(code);
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi/packages/types
pnpm test
```

Expected: "Cannot find module '../kyc.js'"

- [ ] **Step 3: Create `packages/types/src/kyc.ts`**

```typescript
export const KycErrorCode = {
  PROFILE_NOT_FOUND:           'PROFILE_NOT_FOUND',
  KYC_ALREADY_VERIFIED:        'KYC_ALREADY_VERIFIED',
  KYC_IN_REVIEW:               'KYC_IN_REVIEW',
  KYC_REJECTED:                'KYC_REJECTED',
  DUPLICATE_ACCOUNT_DETECTED:  'DUPLICATE_ACCOUNT_DETECTED',
  PHOTO_FRAUD_DETECTED:        'PHOTO_FRAUD_DETECTED',
  AADHAAR_VERIFICATION_FAILED: 'AADHAAR_VERIFICATION_FAILED',
} as const;

export type KycErrorCode = typeof KycErrorCode[keyof typeof KycErrorCode];

export interface PhotoAnalysis {
  isRealPerson:     boolean;
  confidenceScore:  number;
  hasSunglasses:    boolean;
  multipleFaces:    boolean;
  analyzedAt:       string; // ISO 8601
}

export interface AadhaarVerificationResult {
  verified: boolean;
  refId:    string;
  // name intentionally omitted — callers must NOT persist it
}

export interface KycStatusResponse {
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
  aadhaarVerified:    boolean;
  duplicateFlag:      boolean;
  photoAnalysis:      PhotoAnalysis | null;
  adminNote:          string | null;
}
```

- [ ] **Step 4: Add barrel export to `packages/types/src/index.ts`**

```typescript
export * from './auth.js';
export * from './kyc.js';
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi/packages/types
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/kyc.ts packages/types/src/index.ts packages/types/src/__tests__/kyc.test.ts
git commit -m "feat(types): add KYC error codes and response types"
```

---

## Task 3: KYC Zod schemas package

**Files:**
- Create: `packages/schemas/src/kyc.ts`
- Modify: `packages/schemas/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/schemas/src/__tests__/kyc.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { KycInitiateSchema, KycPhotoSchema, AdminReviewSchema } from '../kyc.js';

describe('KycInitiateSchema', () => {
  it('accepts a valid redirectUri', () => {
    const r = KycInitiateSchema.safeParse({ redirectUri: 'https://app.vivah.in/kyc/callback' });
    expect(r.success).toBe(true);
  });
  it('rejects non-URL redirectUri', () => {
    const r = KycInitiateSchema.safeParse({ redirectUri: 'not-a-url' });
    expect(r.success).toBe(false);
  });
});

describe('KycPhotoSchema', () => {
  it('accepts a valid r2Key', () => {
    const r = KycPhotoSchema.safeParse({ r2Key: 'profiles/abc123/photo.jpg' });
    expect(r.success).toBe(true);
  });
  it('rejects empty r2Key', () => {
    const r = KycPhotoSchema.safeParse({ r2Key: '' });
    expect(r.success).toBe(false);
  });
});

describe('AdminReviewSchema', () => {
  it('accepts with optional note', () => {
    const r = AdminReviewSchema.safeParse({ note: 'Looks good' });
    expect(r.success).toBe(true);
  });
  it('accepts without note', () => {
    const r = AdminReviewSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi/packages/schemas
pnpm test
```

Expected: "Cannot find module '../kyc.js'"

- [ ] **Step 3: Create `packages/schemas/src/kyc.ts`**

```typescript
import { z } from 'zod';

export const KycInitiateSchema = z.object({
  redirectUri: z.string().url('redirectUri must be a valid URL'),
});

export const KycPhotoSchema = z.object({
  r2Key: z.string().min(1).max(500),
});

export const AdminReviewSchema = z.object({
  note: z.string().max(1000).optional(),
});

export type KycInitiateInput  = z.infer<typeof KycInitiateSchema>;
export type KycPhotoInput     = z.infer<typeof KycPhotoSchema>;
export type AdminReviewInput  = z.infer<typeof AdminReviewSchema>;
```

- [ ] **Step 4: Add barrel export to `packages/schemas/src/index.ts`**

```typescript
export * from './auth.js';
export * from './kyc.js';
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi/packages/schemas
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/schemas/src/kyc.ts packages/schemas/src/index.ts packages/schemas/src/__tests__/kyc.test.ts
git commit -m "feat(schemas): add KYC Zod validation schemas"
```

---

## Task 4: Aadhaar mock client

**Files:**
- Create: `apps/api/src/kyc/aadhaar.ts`

The swap comment must be obvious. A future developer replaces `false` with `true` and implements the TODO block. No other changes needed.

- [ ] **Step 1: Write failing test**

Create `apps/api/src/kyc/__tests__/aadhaar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getDigiLockerAuthUrl, verifyDigiLockerCallback } from '../aadhaar.js';

describe('getDigiLockerAuthUrl (mock)', () => {
  it('returns an authUrl and state', async () => {
    const result = await getDigiLockerAuthUrl('https://app.vivah.in/kyc/callback');
    expect(result.authUrl).toContain('https://app.vivah.in/kyc/callback');
    expect(result.state).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });
});

describe('verifyDigiLockerCallback (mock)', () => {
  it('returns verified=true with a refId', async () => {
    const result = await verifyDigiLockerCallback('mock-code-123');
    expect(result.verified).toBe(true);
    expect(result.refId).toMatch(/^MOCK-\d+$/);
  });

  it('does NOT expose an Aadhaar number in the result', async () => {
    const result = await verifyDigiLockerCallback('mock-code-123');
    expect(result).not.toHaveProperty('aadhaarNumber');
    expect(result).not.toHaveProperty('aadhaar');
    expect(result).not.toHaveProperty('uid');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api test -- --run apps/api/src/kyc/__tests__/aadhaar.test.ts
```

Expected: "Cannot find module '../aadhaar.js'"

- [ ] **Step 3: Create `apps/api/src/kyc/aadhaar.ts`**

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// SWAP FLAG: Set USE_REAL_DIGILOCKER = true once DigiLocker API approval arrives.
// Then implement the two TODO blocks below using the official DigiLocker SDK.
// No other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────
const USE_REAL_DIGILOCKER = false;

export interface DigiLockerAuthUrl {
  authUrl: string;
  state:   string;
}

export interface DigiLockerVerifyResult {
  verified: boolean;
  refId:    string;
  // Aadhaar number intentionally omitted — never expose, never persist
}

export async function getDigiLockerAuthUrl(redirectUri: string): Promise<DigiLockerAuthUrl> {
  if (USE_REAL_DIGILOCKER) {
    // TODO: import DigiLocker SDK and call getAuthUrl(redirectUri, scopes)
    throw new Error('Real DigiLocker client not yet configured');
  }

  const state = crypto.randomUUID();
  return {
    authUrl: `${redirectUri}?state=${state}&mock=true`,
    state,
  };
}

export async function verifyDigiLockerCallback(code: string): Promise<DigiLockerVerifyResult> {
  if (USE_REAL_DIGILOCKER) {
    // TODO: exchange code for token, pull Aadhaar XML, extract name + DOB,
    //       confirm identity, then discard all PII. Return only refId.
    throw new Error('Real DigiLocker client not yet configured');
  }

  // Mock: always succeeds with a unique reference ID
  void code; // suppress unused-variable warning
  return {
    verified: true,
    refId:    `MOCK-${Date.now()}`,
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api test -- --run apps/api/src/kyc/__tests__/aadhaar.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/kyc/aadhaar.ts apps/api/src/kyc/__tests__/aadhaar.test.ts
git commit -m "feat(kyc): add Aadhaar mock client with one-line real swap"
```

---

## Task 5: AWS Rekognition photo fraud client

**Files:**
- Modify: `apps/api/package.json` (add AWS SDK deps)
- Modify: `apps/api/src/lib/env.ts` (add `AWS_REKOGNITION_REGION`)
- Create: `apps/api/src/kyc/rekognition.ts`

- [ ] **Step 1: Install AWS SDK packages**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api add @aws-sdk/client-rekognition @aws-sdk/client-s3
```

Expected: packages added to `apps/api/package.json`.

- [ ] **Step 2: Add `AWS_REKOGNITION_REGION` to `apps/api/src/lib/env.ts`**

In the Zod schema inside `env.ts`, add:

```typescript
AWS_REKOGNITION_REGION: z.string().min(1).default('ap-south-1'),
```

Add it alongside existing env vars. The `CLOUDFLARE_R2_*` vars are already present (for R2 downloads).

- [ ] **Step 3: Write failing test**

Create `apps/api/src/kyc/__tests__/rekognition.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS SDK — Rekognition is an external service, never call it in tests
vi.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  DetectFacesCommand: vi.fn(),
  Attribute: { ALL: 'ALL' },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetObjectCommand: vi.fn(),
}));

import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { S3Client } from '@aws-sdk/client-s3';
import { analyzePhoto } from '../rekognition.js';

describe('analyzePhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isRealPerson=true when one face detected with high confidence', async () => {
    const mockR2Send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    (S3Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockR2Send }));

    const mockRekognitionSend = vi.fn().mockResolvedValue({
      FaceDetails: [{
        Confidence: 99.5,
        Sunglasses: { Value: false, Confidence: 95 },
      }],
    });
    (RekognitionClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockRekognitionSend }));

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.isRealPerson).toBe(true);
    expect(result.confidenceScore).toBe(99.5);
    expect(result.hasSunglasses).toBe(false);
    expect(result.multipleFaces).toBe(false);
    expect(result.analyzedAt).toMatch(/^\d{4}-/); // ISO date string
  });

  it('returns isRealPerson=false when no face detected', async () => {
    const mockR2Send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    (S3Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockR2Send }));

    const mockRekognitionSend = vi.fn().mockResolvedValue({ FaceDetails: [] });
    (RekognitionClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockRekognitionSend }));

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.isRealPerson).toBe(false);
    expect(result.confidenceScore).toBe(0);
  });

  it('flags multipleFaces when more than one face detected', async () => {
    const mockR2Send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    (S3Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockR2Send }));

    const mockRekognitionSend = vi.fn().mockResolvedValue({
      FaceDetails: [
        { Confidence: 98, Sunglasses: { Value: false, Confidence: 90 } },
        { Confidence: 95, Sunglasses: { Value: false, Confidence: 90 } },
      ],
    });
    (RekognitionClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockRekognitionSend }));

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.multipleFaces).toBe(true);
    expect(result.isRealPerson).toBe(true); // faces found, first face is real
  });

  it('flags hasSunglasses when confidence > 80', async () => {
    const mockR2Send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    (S3Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockR2Send }));

    const mockRekognitionSend = vi.fn().mockResolvedValue({
      FaceDetails: [{
        Confidence: 97,
        Sunglasses: { Value: true, Confidence: 92 },
      }],
    });
    (RekognitionClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockRekognitionSend }));

    const result = await analyzePhoto('profiles/test/photo.jpg');
    expect(result.hasSunglasses).toBe(true);
  });
});
```

- [ ] **Step 4: Run test — expect FAIL (module not found)**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api test -- --run apps/api/src/kyc/__tests__/rekognition.test.ts
```

- [ ] **Step 5: Create `apps/api/src/kyc/rekognition.ts`**

```typescript
import { RekognitionClient, DetectFacesCommand, Attribute } from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../lib/env.js';
import type { PhotoAnalysis } from '@smartshaadi/types';

const rekognition = new RekognitionClient({ region: env.AWS_REKOGNITION_REGION });

// Uses R2 credentials (S3-compatible) to fetch image bytes for Rekognition
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     env.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_KEY,
  },
});

async function fetchImageBytes(r2Key: string): Promise<Uint8Array> {
  const res = await r2.send(new GetObjectCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET,
    Key: r2Key,
  }));
  if (!res.Body) throw new Error(`Empty body for R2 key: ${r2Key}`);
  return res.Body.transformToByteArray();
}

export async function analyzePhoto(r2Key: string): Promise<PhotoAnalysis> {
  const imageBytes = await fetchImageBytes(r2Key);

  const result = await rekognition.send(new DetectFacesCommand({
    Image: { Bytes: imageBytes },
    Attributes: [Attribute.ALL],
  }));

  const faces = result.FaceDetails ?? [];
  const multipleFaces = faces.length > 1;
  const face = faces[0];

  const isRealPerson = faces.length > 0 && (face?.Confidence ?? 0) > 90;
  const confidenceScore = face?.Confidence ?? 0;
  const hasSunglasses = face?.Sunglasses?.Value === true && (face.Sunglasses?.Confidence ?? 0) > 80;

  return {
    isRealPerson,
    confidenceScore,
    hasSunglasses,
    multipleFaces,
    analyzedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api test -- --run apps/api/src/kyc/__tests__/rekognition.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/kyc/rekognition.ts apps/api/src/kyc/__tests__/rekognition.test.ts apps/api/src/lib/env.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(kyc): add AWS Rekognition photo fraud detection client"
```

---

## Task 6: KYC service — tests first

**Files:**
- Create: `apps/api/src/kyc/__tests__/service.test.ts`
- Create: `apps/api/src/kyc/service.ts`

- [ ] **Step 1: Write the full failing test suite**

Create `apps/api/src/kyc/__tests__/service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycErrorCode } from '@smartshaadi/types';

// Mock external clients — never call real services in unit tests
vi.mock('../aadhaar.js', () => ({
  getDigiLockerAuthUrl: vi.fn().mockResolvedValue({
    authUrl: 'https://test.com/callback?state=abc&mock=true',
    state: 'abc',
  }),
  verifyDigiLockerCallback: vi.fn().mockResolvedValue({
    verified: true,
    refId: 'MOCK-123456',
  }),
}));

vi.mock('../rekognition.js', () => ({
  analyzePhoto: vi.fn().mockResolvedValue({
    isRealPerson: true,
    confidenceScore: 98.5,
    hasSunglasses: false,
    multipleFaces: false,
    analyzedAt: '2026-04-07T10:00:00.000Z',
  }),
}));

// Mock DB — we test logic, not SQL
vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '../../lib/db.js';
import {
  initiateAadhaarVerification,
  analyzeProfilePhoto,
  getKycStatus,
  getPendingKycProfiles,
  approveKyc,
  rejectKyc,
} from '../service.js';

// Helper to build a Drizzle-style chainable mock
function mockQuery(returnValue: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
    leftJoin: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(returnValue),
    returning: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

const mockProfile = {
  id: 'profile-uuid-1',
  userId: 'user-uuid-1',
  verificationStatus: 'PENDING' as const,
};

const mockKyc = {
  profileId: 'profile-uuid-1',
  aadhaarVerified: false,
  duplicateFlag: false,
  photoAnalysis: null,
  adminNote: null,
};

describe('initiateAadhaarVerification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns authUrl and state for a PENDING profile', async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([mockProfile]) as unknown as ReturnType<typeof db.select>);

    const result = await initiateAadhaarVerification('user-uuid-1', 'https://test.com/callback');
    expect(result.authUrl).toContain('mock=true');
    expect(result.state).toBe('abc');
  });

  it('throws KYC_ALREADY_VERIFIED for a VERIFIED profile', async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ ...mockProfile, verificationStatus: 'VERIFIED' }]) as unknown as ReturnType<typeof db.select>
    );

    await expect(initiateAadhaarVerification('user-uuid-1', 'https://test.com/callback'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_ALREADY_VERIFIED });
  });

  it('throws PROFILE_NOT_FOUND when profile does not exist', async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as unknown as ReturnType<typeof db.select>);

    await expect(initiateAadhaarVerification('user-uuid-1', 'https://test.com/callback'))
      .rejects.toMatchObject({ name: KycErrorCode.PROFILE_NOT_FOUND });
  });
});

describe('analyzeProfilePhoto', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns MANUAL_REVIEW status with photoAnalysis on success', async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([mockProfile]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.update).mockReturnValue(mockQuery(null) as unknown as ReturnType<typeof db.update>);

    const result = await analyzeProfilePhoto('user-uuid-1', 'profiles/test/photo.jpg');
    expect(result.status).toBe('MANUAL_REVIEW');
    expect(result.photoAnalysis.isRealPerson).toBe(true);
    expect(result.photoAnalysis.confidenceScore).toBe(98.5);
  });

  it('throws PROFILE_NOT_FOUND when no profile exists', async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as unknown as ReturnType<typeof db.select>);

    await expect(analyzeProfilePhoto('user-uuid-1', 'profiles/test/photo.jpg'))
      .rejects.toMatchObject({ name: KycErrorCode.PROFILE_NOT_FOUND });
  });

  it('returns MANUAL_REVIEW even when fraud is detected (no auto-reject)', async () => {
    const { analyzePhoto } = await import('../rekognition.js');
    vi.mocked(analyzePhoto).mockResolvedValueOnce({
      isRealPerson: false,
      confidenceScore: 12,
      hasSunglasses: false,
      multipleFaces: true,
      analyzedAt: '2026-04-07T10:00:00.000Z',
    });

    vi.mocked(db.select).mockReturnValue(mockQuery([mockProfile]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.update).mockReturnValue(mockQuery(null) as unknown as ReturnType<typeof db.update>);

    const result = await analyzeProfilePhoto('user-uuid-1', 'profiles/fraud/photo.jpg');
    // Must never auto-reject — always MANUAL_REVIEW
    expect(result.status).toBe('MANUAL_REVIEW');
    expect(result.photoAnalysis.isRealPerson).toBe(false);
  });
});

describe('getKycStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns status with nulls when no KYC record exists yet', async () => {
    // First call returns profile, second call returns empty KYC
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQuery([mockProfile]) as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(mockQuery([]) as unknown as ReturnType<typeof db.select>);

    const result = await getKycStatus('user-uuid-1');
    expect(result.verificationStatus).toBe('PENDING');
    expect(result.aadhaarVerified).toBe(false);
    expect(result.photoAnalysis).toBeNull();
    expect(result.adminNote).toBeNull();
  });
});

describe('approveKyc / rejectKyc', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approveKyc sets verificationStatus to VERIFIED', async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([mockProfile]) as unknown as ReturnType<typeof db.select>);
    const updateMock = mockQuery(null);
    vi.mocked(db.update).mockReturnValue(updateMock as unknown as ReturnType<typeof db.update>);

    await approveKyc('profile-uuid-1', 'admin-uuid-1', 'Looks authentic');

    // update should have been called twice: once for profiles, once for kyc_verifications
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('rejectKyc sets verificationStatus to REJECTED', async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([mockProfile]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.update).mockReturnValue(mockQuery(null) as unknown as ReturnType<typeof db.update>);

    await rejectKyc('profile-uuid-1', 'admin-uuid-1', 'Photo is fake');

    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('approveKyc throws PROFILE_NOT_FOUND for unknown profileId', async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as unknown as ReturnType<typeof db.select>);

    await expect(approveKyc('bad-id', 'admin-uuid-1'))
      .rejects.toMatchObject({ name: KycErrorCode.PROFILE_NOT_FOUND });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api test -- --run apps/api/src/kyc/__tests__/service.test.ts
```

Expected: "Cannot find module '../service.js'"

- [ ] **Step 3: Create `apps/api/src/kyc/service.ts`**

```typescript
import { eq, and, ne } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users, profiles, sessions, kycVerifications } from '@smartshaadi/db';
import { KycErrorCode } from '@smartshaadi/types';
import { analyzePhoto } from './rekognition.js';
import { getDigiLockerAuthUrl, verifyDigiLockerCallback } from './aadhaar.js';

function kycErr(code: string): never {
  const e = new Error(code);
  e.name = code;
  throw e;
}

// ── Aadhaar Verification ─────────────────────────────────────────────────────

export async function initiateAadhaarVerification(userId: string, redirectUri: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED') kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile.verificationStatus === 'REJECTED') kycErr(KycErrorCode.KYC_REJECTED);
  if (profile.verificationStatus === 'MANUAL_REVIEW') kycErr(KycErrorCode.KYC_IN_REVIEW);

  return getDigiLockerAuthUrl(redirectUri);
}

export async function completeAadhaarVerification(
  userId: string,
  code: string,
  ipAddress: string,
  device: string,
) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED') kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);

  // Duplicate account detection: same IP + device used by a different user
  const otherSessions = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.ipAddress, ipAddress), eq(sessions.device, device), ne(sessions.userId, userId)))
    .limit(5);

  const duplicateFlag = otherSessions.length > 0;
  const duplicateReason = duplicateFlag
    ? `Device fingerprint matches ${otherSessions.length} other account(s)`
    : null;

  const verifyResult = await verifyDigiLockerCallback(code);
  if (!verifyResult.verified) kycErr(KycErrorCode.AADHAAR_VERIFICATION_FAILED);
  // verifyResult.name is available here for identity confirmation if needed,
  // but MUST NOT be persisted anywhere.

  // Upsert KYC record
  const [existing] = await db
    .select()
    .from(kycVerifications)
    .where(eq(kycVerifications.profileId, profile.id))
    .limit(1);

  if (!existing) {
    await db.insert(kycVerifications).values({
      profileId:       profile.id,
      aadhaarVerified: true,
      aadhaarRefId:    verifyResult.refId, // Reference only — never Aadhaar number
      duplicateFlag,
      duplicateReason,
    });
  } else {
    await db.update(kycVerifications).set({
      aadhaarVerified: true,
      aadhaarRefId:    verifyResult.refId,
      duplicateFlag,
      duplicateReason,
      updatedAt:       new Date(),
    }).where(eq(kycVerifications.profileId, profile.id));
  }

  // All paths go to MANUAL_REVIEW — admin approves, never auto-verified
  await db.update(profiles)
    .set({ verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));

  return { duplicateFlag, duplicateReason };
}

// ── Photo Fraud Detection ─────────────────────────────────────────────────────

export async function analyzeProfilePhoto(userId: string, r2Key: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED') kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);

  const photoAnalysis = await analyzePhoto(r2Key);

  await db.update(kycVerifications)
    .set({ photoAnalysis, updatedAt: new Date() })
    .where(eq(kycVerifications.profileId, profile.id));

  // Never auto-reject — fraud detected → MANUAL_REVIEW for admin to decide
  await db.update(profiles)
    .set({ verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));

  return { status: 'MANUAL_REVIEW' as const, photoAnalysis };
}

// ── Status Query ─────────────────────────────────────────────────────────────

export async function getKycStatus(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);

  const [kyc] = await db
    .select()
    .from(kycVerifications)
    .where(eq(kycVerifications.profileId, profile.id))
    .limit(1);

  return {
    verificationStatus: profile.verificationStatus,
    aadhaarVerified:    kyc?.aadhaarVerified ?? false,
    duplicateFlag:      kyc?.duplicateFlag ?? false,
    photoAnalysis:      (kyc?.photoAnalysis as import('@smartshaadi/types').PhotoAnalysis | null) ?? null,
    adminNote:          kyc?.adminNote ?? null,
  };
}

// ── Admin Review Queue ────────────────────────────────────────────────────────

export async function getPendingKycProfiles() {
  return db
    .select({
      profileId:        profiles.id,
      userId:           profiles.userId,
      verificationStatus: profiles.verificationStatus,
      aadhaarVerified:  kycVerifications.aadhaarVerified,
      duplicateFlag:    kycVerifications.duplicateFlag,
      duplicateReason:  kycVerifications.duplicateReason,
      photoAnalysis:    kycVerifications.photoAnalysis,
      submittedAt:      kycVerifications.createdAt,
    })
    .from(profiles)
    .leftJoin(kycVerifications, eq(kycVerifications.profileId, profiles.id))
    .where(eq(profiles.verificationStatus, 'MANUAL_REVIEW'));
}

export async function approveKyc(profileId: string, adminUserId: string, note?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);

  await db.update(profiles)
    .set({ verificationStatus: 'VERIFIED', updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  await db.update(kycVerifications).set({
    adminNote:   note ?? null,
    reviewedBy:  adminUserId,
    reviewedAt:  new Date(),
    updatedAt:   new Date(),
  }).where(eq(kycVerifications.profileId, profileId));
}

export async function rejectKyc(profileId: string, adminUserId: string, note?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);

  await db.update(profiles)
    .set({ verificationStatus: 'REJECTED', updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  await db.update(kycVerifications).set({
    adminNote:   note ?? null,
    reviewedBy:  adminUserId,
    reviewedAt:  new Date(),
    updatedAt:   new Date(),
  }).where(eq(kycVerifications.profileId, profileId));
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api test -- --run apps/api/src/kyc/__tests__/service.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/kyc/service.ts apps/api/src/kyc/__tests__/service.test.ts
git commit -m "feat(kyc): add KYC service with duplicate detection and status transitions"
```

---

## Task 7: KYC router

**Files:**
- Create: `apps/api/src/kyc/router.ts`

- [ ] **Step 1: Create `apps/api/src/kyc/router.ts`**

No new tests needed here — router tests are integration-style and add minimal value over service tests. The router is thin by design.

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { KycInitiateSchema, KycPhotoSchema, AdminReviewSchema } from '@smartshaadi/schemas';
import { KycErrorCode } from '@smartshaadi/types';
import * as service from './service.js';

export const kycRouter = Router();
export const adminKycRouter = Router();

// ── User-facing endpoints ─────────────────────────────────────────────────────

// POST /api/v1/kyc/initiate  — start DigiLocker Aadhaar flow
kycRouter.post('/initiate', authenticate, async (req, res) => {
  const parsed = KycInitiateSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    const result = await service.initiateAadhaarVerification(req.user!.sub, parsed.data.redirectUri);
    ok(res, result);
  } catch (e) {
    const code = (e as Error).name;
    if (code === KycErrorCode.PROFILE_NOT_FOUND)    { err(res, code, 'Profile not found', 404); return; }
    if (code === KycErrorCode.KYC_ALREADY_VERIFIED) { err(res, code, 'Already verified', 409); return; }
    if (code === KycErrorCode.KYC_REJECTED)         { err(res, code, 'KYC was rejected', 403); return; }
    if (code === KycErrorCode.KYC_IN_REVIEW)        { err(res, code, 'KYC is under review', 409); return; }
    err(res, 'INTERNAL_ERROR', 'Failed to initiate KYC', 500);
  }
});

// POST /api/v1/auth/kyc/initiate  — alias used in the auth namespace (per spec)
// Handled by mounting kycRouter under /api/v1/auth/kyc AND /api/v1/kyc

// GET /api/v1/kyc/callback  — DigiLocker OAuth callback
kycRouter.get('/callback', authenticate, async (req, res) => {
  const code = req.query['code'];
  if (typeof code !== 'string' || !code) {
    err(res, 'VALIDATION_ERROR', 'Missing DigiLocker code', 400);
    return;
  }
  const ipAddress = (req.ip ?? '').replace('::ffff:', '');
  const device = req.headers['user-agent'] ?? 'unknown';
  try {
    const result = await service.completeAadhaarVerification(req.user!.sub, code, ipAddress, device);
    ok(res, {
      message: 'Aadhaar verification submitted. Under review.',
      duplicateFlag: result.duplicateFlag,
    });
  } catch (e) {
    const code = (e as Error).name;
    if (code === KycErrorCode.PROFILE_NOT_FOUND)         { err(res, code, 'Profile not found', 404); return; }
    if (code === KycErrorCode.KYC_ALREADY_VERIFIED)      { err(res, code, 'Already verified', 409); return; }
    if (code === KycErrorCode.AADHAAR_VERIFICATION_FAILED) { err(res, code, 'Aadhaar verification failed', 422); return; }
    err(res, 'INTERNAL_ERROR', 'Aadhaar verification failed', 500);
  }
});

// POST /api/v1/kyc/photo  — trigger photo fraud check after R2 upload
kycRouter.post('/photo', authenticate, async (req, res) => {
  const parsed = KycPhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    const result = await service.analyzeProfilePhoto(req.user!.sub, parsed.data.r2Key);
    ok(res, { status: result.status, photoAnalysis: result.photoAnalysis });
  } catch (e) {
    const code = (e as Error).name;
    if (code === KycErrorCode.PROFILE_NOT_FOUND)    { err(res, code, 'Profile not found', 404); return; }
    if (code === KycErrorCode.KYC_ALREADY_VERIFIED) { err(res, code, 'Already verified', 409); return; }
    err(res, 'INTERNAL_ERROR', 'Photo analysis failed', 500);
  }
});

// GET /api/v1/kyc/status  — get current KYC status
kycRouter.get('/status', authenticate, async (req, res) => {
  try {
    const result = await service.getKycStatus(req.user!.sub);
    ok(res, result);
  } catch (e) {
    const code = (e as Error).name;
    if (code === KycErrorCode.PROFILE_NOT_FOUND) { err(res, code, 'Profile not found', 404); return; }
    err(res, 'INTERNAL_ERROR', 'Failed to fetch KYC status', 500);
  }
});

// ── Admin endpoints ───────────────────────────────────────────────────────────

// GET /api/v1/admin/kyc/pending
adminKycRouter.get('/pending', authenticate, authorize(['ADMIN']), async (_req, res) => {
  try {
    const profiles = await service.getPendingKycProfiles();
    ok(res, { profiles, total: profiles.length });
  } catch {
    err(res, 'INTERNAL_ERROR', 'Failed to fetch pending KYC queue', 500);
  }
});

// PUT /api/v1/admin/kyc/:profileId/approve
adminKycRouter.put('/:profileId/approve', authenticate, authorize(['ADMIN']), async (req, res) => {
  const parsed = AdminReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    await service.approveKyc(req.params['profileId']!, req.user!.sub, parsed.data.note);
    ok(res, { message: 'KYC approved' });
  } catch (e) {
    const code = (e as Error).name;
    if (code === KycErrorCode.PROFILE_NOT_FOUND) { err(res, code, 'Profile not found', 404); return; }
    err(res, 'INTERNAL_ERROR', 'Failed to approve KYC', 500);
  }
});

// PUT /api/v1/admin/kyc/:profileId/reject
adminKycRouter.put('/:profileId/reject', authenticate, authorize(['ADMIN']), async (req, res) => {
  const parsed = AdminReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    await service.rejectKyc(req.params['profileId']!, req.user!.sub, parsed.data.note);
    ok(res, { message: 'KYC rejected' });
  } catch (e) {
    const code = (e as Error).name;
    if (code === KycErrorCode.PROFILE_NOT_FOUND) { err(res, code, 'Profile not found', 404); return; }
    err(res, 'INTERNAL_ERROR', 'Failed to reject KYC', 500);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/kyc/router.ts
git commit -m "feat(kyc): add KYC route handlers (user + admin)"
```

---

## Task 8: Wire up routes in main index

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Mount KYC routers in `apps/api/src/index.ts`**

Add imports after the existing `authRouter` import:

```typescript
import { kycRouter, adminKycRouter } from './kyc/router.js';
```

Add mounts after the existing `app.use('/api/v1/auth', authRouter)` line:

```typescript
app.use('/api/v1/auth/kyc', kycRouter);   // POST /api/v1/auth/kyc/initiate (spec alias)
app.use('/api/v1/kyc', kycRouter);         // GET /api/v1/kyc/status, POST /api/v1/kyc/photo
app.use('/api/v1/admin/kyc', adminKycRouter);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(kyc): mount KYC and admin KYC routers"
```

---

## Task 9: Run full test suite and type-check

- [ ] **Step 1: Run all API tests**

```bash
cd D:/Do\ Not\ Open/vivah/smart_shaadi
pnpm --filter @smartshaadi/api test
```

Expected: all tests pass (jwt, middleware, otp, aadhaar, rekognition, service).

- [ ] **Step 2: Run type-check across monorepo**

```bash
pnpm type-check
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no lint errors.

- [ ] **Step 4: Build packages to verify dist outputs**

```bash
pnpm --filter @smartshaadi/types build
pnpm --filter @smartshaadi/schemas build
```

Expected: dist files updated without errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(kyc): verify all tests pass and type-check clean"
```

---

## Verification Checklist

After implementation, verify end-to-end manually:

1. **GET /health** → `{ status: 'ok' }` (server is up)
2. **POST /api/v1/kyc/initiate** with valid Bearer token → returns `{ authUrl, state }` with `mock=true`
3. **GET /api/v1/kyc/callback?code=test** with Bearer token → returns `{ duplicateFlag: false }`
4. **GET /api/v1/kyc/status** → returns `{ verificationStatus: 'MANUAL_REVIEW', aadhaarVerified: true, ... }`
5. **POST /api/v1/kyc/photo** with `{ r2Key: '...' }` → returns `{ status: 'MANUAL_REVIEW', photoAnalysis: {...} }`
6. **GET /api/v1/admin/kyc/pending** with ADMIN token → returns list of profiles
7. **PUT /api/v1/admin/kyc/:profileId/approve** → returns `{ message: 'KYC approved' }`
8. **GET /api/v1/kyc/status** again → `verificationStatus: 'VERIFIED'`
9. **POST /api/v1/kyc/initiate** again → `409 KYC_ALREADY_VERIFIED`

---

## Key Invariants (Never Violate)

| Rule | Rationale |
|------|-----------|
| Never persist Aadhaar number | Legal compliance — store only verification status + DigiLocker refId |
| Never auto-reject on fraud | Could be false positive — always MANUAL_REVIEW for admin to decide |
| Never auto-approve after Aadhaar | Photo check + admin review always required |
| Phone uniqueness already enforced | `users.phone` has UNIQUE constraint — duplicate phone catches registration, not KYC |
| Device fingerprint is soft flag | IP+device match → `duplicateFlag=true`, not block — admin reviews queue |
