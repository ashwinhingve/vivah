#!/usr/bin/env bash
# Unit 8.1 — authenticated HTTP E2E against a running API.
# Exercises the destination-leg lifecycle plus the multi-tenant negative matrix.
# Fixtures are created and deleted; nothing is left behind.
#
# Usage: API=http://localhost:4000 bash e2e-destinations.sh

set -uo pipefail
API="${API:-http://localhost:4000}"
WED="0ada0009-0000-4000-8000-000000000001"   # QA Test Wedding, owner qa-ind-01
OWNER_PHONE="+917000000001"                   # qa-ind-01 (OWNER)
OTHER_PHONE="+917000000002"                   # qa-ind-02 (no access to WED)
OTP="123456"

pass=0; fail=0
ck_owner=/tmp/ck_owner.txt; ck_other=/tmp/ck_other.txt

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
# check <label> <expected-status> <actual-status> [extra]
ck() {
  if [ "$2" = "$3" ]; then printf '  ok   %-52s [%s]\n' "$1" "$3"; pass=$((pass+1));
  else printf '  FAIL %-52s expected %s got %s %s\n' "$1" "$2" "$3" "${4:-}"; fail=$((fail+1)); fi
}

login() { # <phone> <cookiejar>
  curl -s -c "$2" -X POST "$API/api/auth/phone-number/send-otp" \
    -H 'Content-Type: application/json' -d "{\"phoneNumber\":\"$1\"}" >/dev/null
  curl -s -b "$2" -c "$2" -X POST "$API/api/auth/phone-number/verify" \
    -H 'Content-Type: application/json' \
    -d "{\"phoneNumber\":\"$1\",\"code\":\"$OTP\"}" >/dev/null
}

# status-only request:  st <cookiejar|-> <method> <path> [body]
st() {
  local jar="$1" m="$2" p="$3" b="${4:-}"
  if [ "$jar" = "-" ]; then
    curl -s -o /tmp/body.json -w '%{http_code}' -X "$m" "$API$p" \
      -H 'Content-Type: application/json' ${b:+-d "$b"}
  else
    curl -s -b "$jar" -o /tmp/body.json -w '%{http_code}' -X "$m" "$API$p" \
      -H 'Content-Type: application/json' ${b:+-d "$b"}
  fi
}

say "0. Login"
login "$OWNER_PHONE" "$ck_owner"
login "$OTHER_PHONE" "$ck_other"
code=$(st "$ck_owner" GET "/api/v1/weddings/$WED")
ck "owner can read the wedding (login works)" 200 "$code"

BASE="/api/v1/weddings/$WED/destinations"

say "1. Negative matrix FIRST (before any data exists)"
code=$(st - GET "$BASE");            ck "unauthenticated list -> 401" 401 "$code"
code=$(st "$ck_other" GET "$BASE");  ck "non-member list -> 404 (no existence leak)" 404 "$code"
code=$(st "$ck_other" POST "$BASE" '{"city":"Hack","arriveOn":"2026-12-01","departOn":"2026-12-02"}')
ck "non-member create -> 404" 404 "$code"

say "2. Create legs"
code=$(st "$ck_owner" POST "$BASE" '{"city":"Delhi","arriveOn":"2026-12-01","departOn":"2026-12-03","isPrimary":true,"sortOrder":0}')
ck "create primary leg Delhi -> 201" 201 "$code"
D1=$(python3 -c "import json,sys;d=json.load(open('/tmp/body.json'));print(d.get('data',{}).get('destination',{}).get('id') or d.get('data',{}).get('id',''))" 2>/dev/null)
echo "     Delhi id: ${D1:-<none>}"

code=$(st "$ck_owner" POST "$BASE" '{"city":"Udaipur","arriveOn":"2026-12-04","departOn":"2026-12-07","sortOrder":1}')
ck "create second leg Udaipur -> 201" 201 "$code"
D2=$(python3 -c "import json,sys;d=json.load(open('/tmp/body.json'));print(d.get('data',{}).get('destination',{}).get('id') or d.get('data',{}).get('id',''))" 2>/dev/null)
echo "     Udaipur id: ${D2:-<none>}"

say "3. Validation + DB-enforced invariants"
code=$(st "$ck_owner" POST "$BASE" '{"city":"Backwards","arriveOn":"2026-12-10","departOn":"2026-12-01"}')
ck "reversed date window -> 400" 400 "$code"
code=$(st "$ck_owner" POST "$BASE" '{"city":"Impossible","arriveOn":"2026-02-31","departOn":"2026-03-01"}')
ck "impossible date 2026-02-31 -> 400" 400 "$code"
code=$(st "$ck_owner" POST "$BASE" '{"city":"Nowhere","ianaTimezone":"Mars/Olympus","arriveOn":"2026-12-01","departOn":"2026-12-02"}')
ck "bogus timezone -> 400" 400 "$code"
code=$(st "$ck_owner" POST "$BASE" '{"city":"SecondPrimary","arriveOn":"2026-12-08","departOn":"2026-12-09","isPrimary":true}')
ck "second primary leg rejected (409/400, not 500)" 409 "$code"

say "4. Read"
code=$(st "$ck_owner" GET "$BASE"); ck "list legs -> 200" 200 "$code"
python3 -c "
import json;d=json.load(open('/tmp/body.json'))
rows=d.get('data',{}).get('destinations') or d.get('data') or []
print('     legs:', [(r.get('city'), r.get('isPrimary'), r.get('ceremonyCount'), r.get('travellerCount')) for r in rows])
" 2>/dev/null
code=$(st "$ck_owner" GET "$BASE/$D2"); ck "leg detail -> 200" 200 "$code"
code=$(st "$ck_other" GET "$BASE/$D2"); ck "non-member leg detail -> 404" 404 "$code"

say "5. Mutations"
code=$(st "$ck_owner" PUT "$BASE/$D2" '{"notes":"Palace side, lake view"}'); ck "update leg -> 200" 200 "$code"
code=$(st "$ck_owner" POST "$BASE/$D2/set-primary" '{}');                    ck "set-primary moves the flag -> 200" 200 "$code"
code=$(st "$ck_owner" POST "$BASE/reorder" "{\"order\":[{\"id\":\"$D2\",\"sortOrder\":0},{\"id\":\"$D1\",\"sortOrder\":1}]}")
ck "reorder -> 200" 200 "$code"
code=$(st "$ck_owner" POST "$BASE/reorder" "{\"order\":[{\"id\":\"00000000-0000-4000-8000-000000000000\",\"sortOrder\":0}]}")
ck "reorder with foreign id -> 404 (nothing applied)" 404 "$code"

say "6. Guest travel (tenancy)"
code=$(st "$ck_owner" PUT "$BASE/$D2/travel" '{"guestId":"00000000-0000-4000-8000-0000000000ff","arrivalDate":"2026-12-04"}')
ck "travel upsert with foreign guestId -> 404" 404 "$code"
code=$(st "$ck_owner" GET "$BASE/$D2/travel"); ck "list travel -> 200" 200 "$code"

say "7. Delete detaches, does not destroy"
code=$(st "$ck_owner" DELETE "$BASE/$D1"); ck "delete leg -> 200" 200 "$code"
cat /tmp/body.json | head -c 200; echo
code=$(st "$ck_owner" GET "$BASE/$D1"); ck "deleted leg now 404" 404 "$code"

say "CLEANUP"
st "$ck_owner" DELETE "$BASE/$D2" >/dev/null
echo "  removed remaining fixture legs"

printf '\n\033[1mRESULT: %d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
