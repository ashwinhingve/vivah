#!/bin/bash
# Run after Railway PostgreSQL is provisioned
# Usage: DATABASE_URL=postgresql://... bash scripts/migrate-prod.sh

set -e

echo "Running production database migration..."
cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

pnpm --filter @smartshaadi/db db:push

echo "Migration complete."
