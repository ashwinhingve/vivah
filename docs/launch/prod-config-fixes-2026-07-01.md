# Prod Config Fixes — 2026-07-01

Operator-applied (dashboard) fixes discovered during live QA. None are code changes;
all are environment/bucket configuration on the hosting platforms.

## 1. R2 photo upload — CORS policy (RESOLVED)

**Symptom:** Browser upload to presigned R2 URL failed with
`No 'Access-Control-Allow-Origin' header is present` (CORS preflight block) on
`https://smartshaadi.co.in`.

**Cause:** R2 buckets serve no CORS headers until a bucket CORS policy exists.
Presigned PUT from the browser requires it.

**Fix:** Cloudflare dashboard → R2 → bucket `smartshaadi-media` → Settings →
CORS Policy → add:

```json
[
  {
    "AllowedOrigins": [
      "https://smartshaadi.co.in",
      "https://www.smartshaadi.co.in"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add preview/staging origins here too if the browser uploads from them.

**Note on the presign host:** The presigned URL host must be
`<CLOUDFLARE_R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (path-style; `forcePathStyle:
true` in `apps/api/src/storage/service.ts`). The host is derived from
`CLOUDFLARE_R2_ENDPOINT` (preferred) or `CLOUDFLARE_R2_ACCOUNT_ID` — both set on the
**Railway API** service (that's where presigning happens, not Vercel). If uploads ever
target a garbled host, verify those two vars on Railway and redeploy the API.

## 2. ai-service 401 `missing_or_invalid_internal_key`

**Symptom:** API → ai-service calls (`/ai/assistant/chat`, `/ai/emotional/score`, etc.)
return `401 Unauthorized`, ai-service logs `event: auth_denied reason:
missing_or_invalid_internal_key`.

**Cause:** The shared internal key differs between the two services.
- API sends `X-Internal-Key: AI_SERVICE_INTERNAL_KEY` (`apps/api/src/lib/ai.ts`).
- ai-service validates against `AI_SERVICE_API_KEY` **first**, then
  `AI_SERVICE_INTERNAL_KEY` (`apps/ai-service/src/main.py`).

They only match when both hold the same secret. If ai-service has a different
`AI_SERVICE_API_KEY` set, it wins and breaks the match.

**Fix (Railway):**
- API service: `AI_SERVICE_INTERNAL_KEY = <secret>`
- ai-service:  `AI_SERVICE_INTERNAL_KEY = <same secret>`, and ensure
  `AI_SERVICE_API_KEY` is **unset** (or set to the identical value).

Redeploy both. The API refuses to boot in production if
`AI_SERVICE_INTERNAL_KEY` is left at the `internal-key-change-in-prod` placeholder.
