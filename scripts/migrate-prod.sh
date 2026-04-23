#!/bin/bash
# Run after Railway PostgreSQL is provisioned
# Usage: DATABASE_URL=postgresql://... bash scripts/migrate-prod.sh

set -euo pipefail

echo "Running production database migration..."
cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

# Build db package first so drizzle-kit's emitted JS has correct ESM
# extensions (source uses bare paths for drizzle-kit's own loader).
pnpm --filter @smartshaadi/db build

if ! pnpm --filter @smartshaadi/db db:push; then
  echo "!! Migration failed." >&2
  exit 1
fi

echo "Migration complete."
