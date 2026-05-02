# AWS Rekognition — Activation Runbook

---

## What it does in vivahOS

Two KYC capabilities:
1. **Face match.** User uploads selfie → compared against Aadhaar/PAN photo → similarity score → pass/fail.
2. **Liveness.** User performs a video challenge (blink, head turn) → Rekognition Face Liveness verifies it's a real person, not a photo.

Code reference: `apps/api/src/kyc/faceMatch.ts` (TODO at line 29), `apps/api/src/kyc/liveness.ts` (TODO at line 32), `apps/api/src/kyc/rekognition.ts`.

---

## Lead time

**1 day** if AWS account already exists (it should, after SES). If not: 1 day for AWS account creation + 1 day for IAM setup.

---

## What we need from the client

### AWS IAM
- [ ] AWS account ready (same one as SES; share billing)
- [ ] IAM user `vivahos-rekognition` created with policies:
  - `rekognition:CompareFaces`
  - `rekognition:CreateCollection`, `IndexFaces`, `SearchFacesByImage`
  - `rekognition:StartFaceLivenessSession`, `GetFaceLivenessSessionResults`
- [ ] Access key + secret generated
- [ ] **Region: `ap-south-1`** (Mumbai — required for data residency under DPDP Act)

### Face collection
- [ ] (Developer creates programmatically) Collection `vivahos-faces-prod` for indexing user faces (used to detect duplicate signups)

### Hand over to developer
- [ ] **`AWS_REKOGNITION_ACCESS_KEY`**
- [ ] **`AWS_REKOGNITION_SECRET_KEY`**
- [ ] **`AWS_REKOGNITION_REGION`** = `ap-south-1`
- [ ] **`AWS_REKOGNITION_FACE_COLLECTION`** = `vivahos-faces-prod`

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set AWS_REKOGNITION_ACCESS_KEY=AKIAxxxxx
railway env set AWS_REKOGNITION_SECRET_KEY=xxxxx
railway env set AWS_REKOGNITION_REGION=ap-south-1
railway env set AWS_REKOGNITION_FACE_COLLECTION=vivahos-faces-prod

# 2. Create face collection (one-time)
aws rekognition create-collection --collection-id vivahos-faces-prod --region ap-south-1

# 3. Implement adapters
#    faceMatch.ts: CompareFaces API — 0.5 day
#    liveness.ts: Face Liveness with frontend SDK integration — 1 day

# 4. Flip mock + deploy
railway env set USE_REKOGNITION_MOCK=false
git push origin main
pnpm test:provider:rekognition -- --live
# Compare two photos of same person (>95% similarity expected); two different (<70%)
```

---

## Rollback

```bash
railway env set USE_REKOGNITION_MOCK=true
# Mock returns 95% similarity → all users pass; non-blocking
```

---

## Cost model

| Operation | Cost |
|-----------|------|
| `CompareFaces` | $0.001 per image |
| `IndexFaces` | $0.001 per face |
| `SearchFaces` | $0.001 per search |
| `Face Liveness` session | $0.0025 per session |

At 10k MAU with full KYC: ~₹2,000/mo. Scales linearly.

---

## Critical security note

Selfies and Aadhaar photos uploaded to Rekognition are processed in `ap-south-1` and **not** retained by AWS (Rekognition is stateless except for the indexed face collection, which we control). Photos are deleted from R2 after KYC completion (24h grace period for re-verification, then purged by `accountPurgeJob`).

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Similarity below threshold | UI shows retry | User retakes selfie; allow 3 attempts before manual review |
| Liveness fails (low confidence) | UI shows retry | Most common cause: poor lighting; UI prompts user |
| Collection limit reached (1M faces default) | Sentry alert | Request quota increase from AWS |
| Region mismatch | Cross-region API call | Verify region env var; data residency violation otherwise |

---

## Why this is fast

AWS has no human review for Rekognition activation — it's pay-as-you-go from day 1. The only gate is account billing setup, which is shared with SES.
