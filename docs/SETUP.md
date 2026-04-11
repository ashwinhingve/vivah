# Local Development Setup

---

## Prerequisites

```bash
node --version    # 20.x or higher
python --version  # 3.11.x or higher
docker --version  # 24.x or higher
pnpm --version    # 8.x or higher

# Install pnpm if not present
npm install -g pnpm
```

---

## Day 1 Setup (Do This Once)

### 1. Clone and Install

```bash
git clone https://github.com/ashwinhingve/smart-shaadi-infinity.git
cd smart-shaadi-infinity
pnpm install
```

### 2. Environment Files

```bash
# Copy all environment templates
cp infrastructure/.env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/ai-service/.env.example apps/ai-service/.env
```

Fill in each `.env` file with real credentials. See the **Environment Variables** section below.

### 3. Start Local Infrastructure

```bash
# Start PostgreSQL, MongoDB, Redis, and Adminer
docker compose up -d

# Verify containers are running
docker compose ps
```

| Container | Port | Purpose |
|-----------|------|---------|
| `smart-shaadi-postgres` | 5432 | PostgreSQL database |
| `smart-shaadi-mongo` | 27017 | MongoDB database |
| `smart-shaadi-redis` | 6379 | Redis cache + queues |
| `smart-shaadi-adminer` | 8080 | Database browser UI |

### 4. Database Setup

```bash
# Push Drizzle schema to PostgreSQL
pnpm db:push

# Seed with development test data
pnpm db:seed
```

### 5. Python AI Service Setup

```bash
cd apps/ai-service
python -m venv venv
source venv/bin/activate     # Mac/Linux
# venv\Scripts\activate      # Windows
pip install -r requirements.txt
cd ../..
```

### 6. Start Everything

```bash
pnpm dev
```

This runs all services in parallel via Turborepo. Wait for all three to show "ready":
- `[web] ▲ Next.js 15 ready on http://localhost:3000`
- `[api] ✓ API ready on http://localhost:4000`
- `[ai-service] INFO: Uvicorn running on http://0.0.0.0:8000`

---

## Environment Variables

### Core (`.env` in root)

```bash
# Shared across all services
NODE_ENV=development
```

### Web App (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

### API (`apps/api/.env`)

```bash
# Database
DATABASE_URL=postgresql://vivah:vivah@localhost:5432/smart_shaadi
MONGODB_URI=mongodb://localhost:27017/smart_shaadi
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=dev-access-secret-change-in-prod
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-prod
BETTER_AUTH_SECRET=dev-auth-secret-change-in-prod

# Storage
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=smart-shaadi-dev
CLOUDFLARE_R2_PUBLIC_URL=https://...

# Payments (use Razorpay test keys for dev)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Communications (can use test mode)
MSG91_API_KEY=...
MSG91_SENDER_ID=VIVAH
MSG91_TEMPLATE_OTP=...
AWS_SES_ACCESS_KEY=...
AWS_SES_SECRET_KEY=...
AWS_SES_REGION=ap-south-1
AWS_SES_FROM_EMAIL=noreply@smart_shaadi.in

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# KYC
DIGILOCKER_CLIENT_ID=...
DIGILOCKER_CLIENT_SECRET=...
DIGILOCKER_REDIRECT_URI=http://localhost:4000/auth/kyc/callback
AWS_REKOGNITION_ACCESS_KEY=...
AWS_REKOGNITION_SECRET_KEY=...
AWS_REKOGNITION_REGION=ap-south-1

# Video
DAILY_CO_API_KEY=...

# AI Service
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=internal-service-key-dev

# Monitoring
SENTRY_DSN=https://...
```

### AI Service (`apps/ai-service/.env`)

```bash
ANTHROPIC_API_KEY=sk-ant-...
HELICONE_API_KEY=sk-helicone-...
MONGODB_URI=mongodb://localhost:27017/smart_shaadi
REDIS_URL=redis://localhost:6379
INTERNAL_API_KEY=internal-service-key-dev
ENVIRONMENT=development
```

---

## Development Workflow (Daily)

```bash
# Start of day
docker compose up -d          # Ensure infrastructure is running
pnpm dev                      # Start all services

# During development
pnpm db:studio                # Visual database browser (http://localhost:4983)

# Before committing
pnpm lint                     # Fix linting issues
pnpm type-check               # Ensure no TypeScript errors
pnpm test                     # Run unit tests

# End of day
# Update ROADMAP.md — mark completed items, add blockers
git add -A && git commit -m "chore: end of day checkpoint"
```

---

## Testing

```bash
# Unit tests (Vitest)
pnpm test

# Watch mode (auto-reruns on save)
pnpm test --watch

# E2E tests (Playwright)
pnpm e2e

# E2E with browser UI (for debugging)
pnpm e2e --ui

# Test a specific file
pnpm test apps/api/modules/matchmaking/guna-milan.test.ts
```

**Test coverage targets:**
- Guna Milan algorithm: 100% — all 8 factors, edge cases
- Escrow payment logic: 100% — all state transitions
- Razorpay webhook handler: 100% — all event types
- Reciprocal matching engine: 90%+
- API endpoint integration tests: 80%+

---

## MCP Configuration (Claude Code)

> **Environment:** This project uses Claude Code via WSL (Windows Subsystem for Linux).
> The `npx` commands below are correct for WSL/Linux. If you are running Claude Code
> natively on Windows (not WSL), wrap each entry as:
> `"command": "cmd", "args": ["/c", "npx", ...]`

Create or update `~/.claude/claude_desktop_config.json` (inside WSL home, i.e. `~`):

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    },
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_..." }
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp"]
    },
    "linear": {
      "command": "npx",
      "args": ["linear-mcp"],
      "env": { "LINEAR_API_KEY": "lin_api_..." }
    },
    "21st-dev-magic": {
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@latest"],
      "env": { "API_KEY": "your-21st-dev-api-key" }
    }
  }
}
```

Get your 21st.dev API key at [21st.dev/magic](https://21st.dev/magic). This gives Claude Code access to a library of polished React + Tailwind components. Use the `/ui` command in Claude Code to pull components, then adapt them to the Smart Shaadi design system using `/ui-component`.

**One-time skill installs (run once in terminal):**
```bash
npx skills add anthropics/claude-code --skill frontend-design
```

Add these MCPs after the corresponding services are set up:
- **Figma MCP** — when design work begins (Week 2)
- **Sentry MCP** — after first production deploy
- **Cloudflare MCP** — when R2 bucket work begins

---

## Common Issues

**PostgreSQL connection refused:**
```bash
docker compose restart smart-shaadi-postgres
# Wait 10 seconds, then retry
```

**MongoDB not connecting:**
```bash
# MongoDB takes longer to start than PostgreSQL
docker compose logs smart-shaadi-mongo
```

**Drizzle schema out of sync:**
```bash
pnpm db:push     # Re-push schema
pnpm db:seed     # Re-seed if tables were dropped
```

**Python venv not found:**
```bash
cd apps/ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Port already in use:**
```bash
lsof -ti:3000 | xargs kill -9    # Kill whatever is on 3000
lsof -ti:4000 | xargs kill -9    # Kill whatever is on 4000
```
