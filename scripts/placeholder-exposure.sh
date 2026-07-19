#!/usr/bin/env bash
#
# Placeholder supply exposure gate.
#
# Sprints 8.1s/8.2 shipped four supply tables seeded with FICTIONAL inventory so
# the features work end-to-end before any partner signs. Each such row carries
# `is_placeholder = true`. That flag is internal provenance: it never hides a
# row, never changes ranking, and gates exactly one thing — placeholder supply
# cannot be booked or paid for (see assertBookable in apps/api/src/packages/
# service.ts).
#
# Enquiries stay open, which is the entire point of seeding it. But before
# PUBLIC launch those rows still need licensed photography, real contact
# details and re-based pricing, because a real member of the public will read
# them as real businesses.
#
# The roadmap recorded that requirement as a SQL query a human was expected to
# remember to run. This script exists so it is checked instead of remembered.
#
# Usage:
#   scripts/placeholder-exposure.sh                 # report only, always exit 0
#   scripts/placeholder-exposure.sh --gate          # exit 1 if ANY row is placeholder
#
# DATABASE_URL must be set, or apps/api/.env must carry one.
#
# Exit codes:
#   0  no placeholder rows, or report-only mode
#   1  --gate and placeholder rows exist
#   2  could not reach the database

set -euo pipefail

GATE=0
[[ "${1:-}" == "--gate" ]] && GATE=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The env file may carry a leading space before the key, so match loosely, then
# strip quotes and any trailing CR that a Windows-side edit would leave behind.
if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(grep -hE '^[[:space:]]*DATABASE_URL=' "$REPO_ROOT/apps/api/.env" 2>/dev/null \
    | head -1 | cut -d= -f2- | tr -d '"'"'"'\r' | xargs || true)"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set and none found in apps/api/.env" >&2
  exit 2
fi

if ! psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "ERROR: cannot connect to the database" >&2
  exit 2
fi

echo "Placeholder supply exposure"
echo "==========================="
psql "$DATABASE_URL" -X --no-align --field-separator=' | ' --pset footer=off -c "
SELECT
  t.name        AS \"table\",
  t.placeholder AS \"placeholder\",
  t.total       AS \"total\",
  CASE WHEN t.total = 0 THEN 'n/a'
       ELSE round(100.0 * t.placeholder / t.total, 1) || '%'
  END           AS \"exposed\"
FROM (
  SELECT 'premium_packages'       AS name,
         count(*) FILTER (WHERE is_placeholder) AS placeholder, count(*) AS total
    FROM premium_packages
  UNION ALL
  SELECT 'post_marriage_services',
         count(*) FILTER (WHERE is_placeholder), count(*) FROM post_marriage_services
  UNION ALL
  SELECT 'service_partners',
         count(*) FILTER (WHERE is_placeholder), count(*) FROM service_partners
  UNION ALL
  SELECT 'vendors',
         count(*) FILTER (WHERE is_placeholder), count(*) FROM vendors
) t
ORDER BY t.placeholder DESC, t.name;
"

TOTAL="$(psql "$DATABASE_URL" -X -t -A -c "
SELECT (SELECT count(*) FROM premium_packages       WHERE is_placeholder)
     + (SELECT count(*) FROM post_marriage_services WHERE is_placeholder)
     + (SELECT count(*) FROM service_partners       WHERE is_placeholder)
     + (SELECT count(*) FROM vendors                WHERE is_placeholder);
")"

echo
echo "Total placeholder rows: $TOTAL"

# Safety invariant: a placeholder row must never carry contact details that a
# member of the public could act on. Unreachable (.invalid) or absent is fine;
# anything else means someone could contact — or worse, be mistaken for — a
# real business.
REACHABLE="$(psql "$DATABASE_URL" -X -t -A -c "
SELECT (SELECT count(*) FROM vendors
          WHERE is_placeholder AND email IS NOT NULL AND email NOT LIKE '%.invalid')
     + (SELECT count(*) FROM service_partners
          WHERE is_placeholder AND contact_email IS NOT NULL
            AND contact_email NOT LIKE '%.invalid');
")"

if [[ "$REACHABLE" != "0" ]]; then
  echo
  echo "FAIL: $REACHABLE placeholder row(s) carry a reachable contact address." >&2
  echo "      Fictional supply must never be contactable. Fix before launch." >&2
  exit 1
fi
echo "Contact safety: OK (no placeholder row carries a reachable address)"

if [[ "$TOTAL" == "0" ]]; then
  echo
  echo "PASS: no placeholder supply. Safe for public launch."
  exit 0
fi

echo
echo "$TOTAL row(s) are fictional placeholder supply."
echo "Before PUBLIC launch each still needs:"
echo "  - licensed photography (seeds use in-house SVG placeholders)"
echo "  - real partner contact details"
echo "  - pricing re-based on an actual quote (seed numbers are plausible, not quoted)"
echo
echo "Onboarding a real partner is: UPDATE ... SET is_placeholder = false"
echo "from /admin/packages — no schema change, no re-keying."

if [[ "$GATE" == "1" ]]; then
  echo
  echo "GATE FAILED: placeholder supply is still exposed." >&2
  exit 1
fi

exit 0
