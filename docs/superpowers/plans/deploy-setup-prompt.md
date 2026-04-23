You are setting up Smart Shaadi (VivahOS Infinity) for production deployment
on Railway (API + DB + Redis) and Vercel (frontend).

Read these files FULLY before touching anything:
- CLAUDE.md (architecture rules)
- apps/api/src/index.ts (entry point)
- apps/api/package.json (scripts + dependencies)
- apps/web/package.json (scripts)
- turbo.json (monorepo task graph)
- pnpm-workspace.yaml (workspace config)
- packages/db/drizzle.config.ts (DB config)

Then complete ALL tasks below in order. Do NOT skip any task.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — Dockerfile for API service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create apps/api/Dockerfile:

```dockerfile
# ── Stage 1: Builder ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace manifests first (layer cache)
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY pnpm-lock.yaml ./

# Copy all package.json files for dependency resolution
COPY packages/types/package.json ./packages/types/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/types/ ./packages/types/
COPY packages/schemas/ ./packages/schemas/
COPY packages/db/ ./packages/db/
COPY apps/api/ ./apps/api/

# Build shared packages first, then API
RUN pnpm --filter @smartshaadi/types build
RUN pnpm --filter @smartshaadi/schemas build
RUN pnpm --filter @smartshaadi/db build
RUN pnpm --filter @smartshaadi/api build

# ── Stage 2: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm@9

# Copy workspace config
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy package.json files for production install
COPY packages/types/package.json ./packages/types/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built outputs from builder
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Start the API
CMD ["node", "apps/api/dist/src/index.js"]
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — Railway configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create railway.toml in the monorepo ROOT:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/api/Dockerfile"

[deploy]
startCommand = "node apps/api/dist/src/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[services]]
name = "api"

[services.deploy]
region = "ap-south-1"
```

Also create apps/api/.railwayignore:
```
node_modules
dist
.env
.env.local
*.log
__tests__
*.test.ts
*.spec.ts
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — Vercel configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create vercel.json in the monorepo ROOT:

```json
{
  "version": 2,
  "buildCommand": "pnpm --filter @smartshaadi/types build && pnpm --filter @smartshaadi/schemas build && pnpm --filter @smartshaadi/web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://api.smartshaadi.co.in/api/v1/:path*"
    }
  ]
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 4 — Production environment template
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create apps/api/.env.production.example:

```bash
# ── Core ─────────────────────────────────────────────────────
NODE_ENV=production
PORT=4000

# ── Database (Railway auto-injects DATABASE_URL) ──────────────
DATABASE_URL=postgresql://user:pass@host:5432/railway

# ── MongoDB Atlas ─────────────────────────────────────────────
MONGODB_URI=mongodb+srv://vivah:PASSWORD@cluster0.xxxxx.mongodb.net/smart_shaadi

# ── Redis (Railway auto-injects REDIS_URL) ────────────────────
REDIS_URL=redis://default:pass@host:6379

# ── Better Auth ───────────────────────────────────────────────
BETTER_AUTH_SECRET=GENERATE_WITH_openssl_rand_-base64_32
BETTER_AUTH_URL=https://api.smartshaadi.co.in
JWT_ACCESS_SECRET=GENERATE_WITH_openssl_rand_-base64_32
JWT_REFRESH_SECRET=GENERATE_WITH_openssl_rand_-base64_32

# ── CORS ──────────────────────────────────────────────────────
CORS_ORIGIN=https://smartshaadi.co.in

# ── Cloudflare R2 ─────────────────────────────────────────────
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY=your_access_key
CLOUDFLARE_R2_SECRET_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET=smartshaadi-media
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev

# ── Mock Services (keep true until company registration) ──────
USE_MOCK_SERVICES=true

# ── Third-party (mocked — swap after registration) ────────────
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder
RAZORPAY_WEBHOOK_SECRET=placeholder
MSG91_API_KEY=placeholder
DIGILOCKER_CLIENT_ID=placeholder
DIGILOCKER_CLIENT_SECRET=placeholder
AWS_REKOGNITION_ACCESS_KEY=placeholder
AWS_REKOGNITION_SECRET_KEY=placeholder
AWS_REKOGNITION_REGION=ap-south-1
DAILY_CO_API_KEY=mock-daily-key

# ── AI Service (not deployed for demo) ────────────────────────
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=internal-service-key-dev
```

Create apps/web/.env.production.example:

```bash
NEXT_PUBLIC_API_URL=https://api.smartshaadi.co.in
NEXT_PUBLIC_SOCKET_URL=https://api.smartshaadi.co.in
NODE_ENV=production
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 5 — Fix CORS for production
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read apps/api/src/index.ts.
Find the CORS configuration.

If CORS origin is hardcoded to localhost or * — fix it:

```typescript
import cors from 'cors'

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.CORS_ORIGIN ?? 'https://smartshaadi.co.in',
      'https://www.smartshaadi.co.in',
    ]
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]

app.use(cors({
  origin: allowedOrigins,
  credentials: true,                 // required for Better Auth cookies
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Cookie'],
}))
```

If cors package is not installed:
pnpm --filter @smartshaadi/api add cors
pnpm --filter @smartshaadi/api add -D @types/cors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 6 — Fix Socket.io CORS for production
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read apps/api/src/chat/socket/index.ts.
Find where Socket.io server is initialised.

Update cors config to use env-based origins:

```typescript
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [
          process.env.CORS_ORIGIN ?? 'https://smartshaadi.co.in',
          'https://www.smartshaadi.co.in',
        ]
      : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],  // polling fallback for Railway
})
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 7 — Database migration script for production
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create scripts/migrate-prod.sh in monorepo root:

```bash
#!/bin/bash
# Run after Railway PostgreSQL is provisioned
# Usage: DATABASE_URL=postgresql://... bash scripts/migrate-prod.sh

set -e

echo "Running production database migration..."
cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

pnpm --filter @smartshaadi/db db:push

echo "Migration complete."
```

Make it executable:
chmod +x scripts/migrate-prod.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 8 — Add graceful shutdown (if missing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read apps/api/src/index.ts.
Check if graceful shutdown exists for SIGTERM/SIGINT.
Railway sends SIGTERM before killing containers.

If missing — add at the bottom of index.ts:

```typescript
const shutdown = async (signal: string) => {
  console.log(`${signal} received — shutting down gracefully`)
  server.close(async () => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  // Force exit after 10s if server hasn't closed
  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 9 — Verify Docker build locally
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run from monorepo root:

```bash
# Build the Docker image
docker build -f apps/api/Dockerfile -t smartshaadi-api:test .

# Test it runs
docker run --rm \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e DATABASE_URL="postgresql://vivah:vivah@host.docker.internal:5432/smart_shaadi" \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/smart_shaadi" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  -e BETTER_AUTH_SECRET="test-secret-32-chars-minimum-ok" \
  -e BETTER_AUTH_URL="http://localhost:4000" \
  -e JWT_ACCESS_SECRET="test-jwt-access-secret-ok" \
  -e JWT_REFRESH_SECRET="test-jwt-refresh-secret-ok" \
  -e USE_MOCK_SERVICES="true" \
  -p 4000:4000 \
  smartshaadi-api:test

# In another terminal, test health:
curl http://localhost:4000/health
# Expected: {"success":true,"data":{"status":"ok"},"error":null,"meta":null}
```

Report the docker build output and health check result.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 10 — Final checks and commit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Verify .gitignore has these entries (add if missing):
   .env
   .env.local
   .env.production
   apps/api/dist/
   apps/web/.next/
   node_modules/

2. Run type-check — must be zero errors:
   pnpm type-check

3. Run API tests — must be 310/310:
   pnpm --filter @smartshaadi/api test

4. Commit everything:
   git add -A
   git commit -m "chore(deploy): Railway Dockerfile + railway.toml + Vercel config + production env + CORS + graceful shutdown"
   git push

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORT WHEN DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report:
1. Docker build result (success/fail + image size)
2. Health check result from running container
3. Type-check result
4. Test count
5. Commit hash
6. Any task that could not be completed and why
