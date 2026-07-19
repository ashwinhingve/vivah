#!/usr/bin/env bash
# Phase 8 — Units 8.1 (premium package supply) + 8.2 (post-marriage services).
# Exercises both features over authenticated HTTP against the real server.
#
# The check this script exists for is section 4: the placeholder guard must
# REFUSE a booking on placeholder supply AND ALLOW it on real supply. Testing
# only the refusal cannot distinguish "the guard works" from "the guard is
# missing and something else returns an error" — the exact failure Sprint G's
# process note describes, where negative-only tests stayed green with the
# feature entirely absent. So we flip a package to real, prove it succeeds,
# and flip it back.
#
# Usage:  API=http://localhost:4100 ./e2e-phase8-supply.sh

set -uo pipefail
API="${API:-http://localhost:4100}"
# NOTE: in this QA dataset +917000000001 is the ADMIN account and ...009 is the
# INDIVIDUAL one — the opposite of what the numbering suggests. Section 0 prints
# both resolved roles so an inversion shows up immediately rather than as a wall
# of confusing 403s.
IND_PHONE="${IND_PHONE:-+917000000009}"   # INDIVIDUAL role
ADMIN_PHONE="${ADMIN_PHONE:-+917000000001}"
OTP="123456"
JAR_IND=/tmp/ck_p8_ind.txt
JAR_ADM=/tmp/ck_p8_adm.txt
JAR_ANON=/tmp/ck_p8_anon.txt
PSQL="env PGPASSWORD=vivah psql -h localhost -p 5433 -U vivah -d smart_shaadi -tAc"

pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then printf '  ok   %-56s [%s]\n' "$1" "$3"; pass=$((pass+1));
       else printf '  FAIL %-56s expected %s got %s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi; }
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
body() { python3 -c "import json,sys;print(json.load(open('/tmp/p8body.json'))$1)" 2>/dev/null || echo "PARSE_ERR"; }

st() { local jar="$1" m="$2" p="$3" b="${4:-}"
  curl -s -b "$jar" -o /tmp/p8body.json -w '%{http_code}' -X "$m" "$API$p" \
    -H 'Content-Type: application/json' ${b:+-d "$b"}; }

login() { local jar="$1" phone="$2"
  rm -f "$jar"
  curl -s -c "$jar" -X POST "$API/api/auth/phone-number/send-otp" \
    -H 'Content-Type: application/json' -d "{\"phoneNumber\":\"$phone\"}" >/dev/null
  curl -s -b "$jar" -c "$jar" -X POST "$API/api/auth/phone-number/verify" \
    -H 'Content-Type: application/json' -d "{\"phoneNumber\":\"$phone\",\"code\":\"$OTP\"}" >/dev/null
}

say '0. Login'
login "$JAR_IND" "$IND_PHONE"
login "$JAR_ADM" "$ADMIN_PHONE"
rm -f "$JAR_ANON"; touch "$JAR_ANON"
IND_ROLE=$($PSQL "SELECT role FROM \"user\" WHERE phone_number='$IND_PHONE'" | head -1 | tr -d '\r')
ADM_ROLE=$($PSQL "SELECT role FROM \"user\" WHERE phone_number='$ADMIN_PHONE'" | head -1 | tr -d '\r')
echo "     individual role: ${IND_ROLE:-<none>} · admin role: ${ADM_ROLE:-<none>}"

# ── 8.1 public browse ────────────────────────────────────────────────────────
say '1. 8.1 — public browse (no auth required)'
ck 'browse packages'            200 "$(st "$JAR_ANON" GET '/api/v1/packages?limit=5')"
TOTAL=$(body "['data']['total']")
echo "     total active packages: $TOTAL"
ck 'browse returns seeded rows' true "$([ "${TOTAL:-0}" -ge 24 ] && echo true || echo false)"

ck 'facets'                     200 "$(st "$JAR_ANON" GET '/api/v1/packages/facets')"
CITY_COUNT=$(body "['data']['cities'].__len__()")
FIRST_CITY=$(body "['data']['cities'][0]['name']")
echo "     facet cities: $CITY_COUNT, first: $FIRST_CITY"

ck 'filter by city'             200 "$(st "$JAR_ANON" GET '/api/v1/packages?city=Udaipur')"
UDAIPUR=$(body "['data']['total']")
echo "     Udaipur packages: $UDAIPUR"
ck 'city filter narrows'        true "$([ "${UDAIPUR:-0}" -lt "${TOTAL:-0}" ] && echo true || echo false)"

ck 'filter by tier=LUXE'        200 "$(st "$JAR_ANON" GET '/api/v1/packages?tier=LUXE')"
LUXE=$(body "['data']['total']")
echo "     LUXE packages: $LUXE"

# Capacity 250 must match packages whose min<=250<=max, and nothing else.
ck 'capacity filter'            200 "$(st "$JAR_ANON" GET '/api/v1/packages?capacity=250')"
CAP=$(body "['data']['total']")
echo "     packages seating 250: $CAP"

ck 'invalid tier rejected'      400 "$(st "$JAR_ANON" GET '/api/v1/packages?tier=PLATINUM')"
ck 'priceMax<priceMin rejected' 400 "$(st "$JAR_ANON" GET '/api/v1/packages?priceMin=900000&priceMax=1000')"

say '2. 8.1 — detail'
ck 'detail by slug'             200 "$(st "$JAR_ANON" GET '/api/v1/packages/amrit-haveli-lakeside-essential')"
INCL=$(body "['data']['inclusions'].__len__()")
EXCL=$(body "['data']['exclusions'].__len__()")
PLACEHOLDER=$(body "['data']['isPlaceholder']")
VENDOR=$(body "['data']['vendorName']")
echo "     $VENDOR — $INCL inclusions, $EXCL exclusions, isPlaceholder=$PLACEHOLDER"
ck 'inclusions present'         true "$([ "${INCL:-0}" -gt 0 ] && echo true || echo false)"
ck 'exclusions present'         true "$([ "${EXCL:-0}" -gt 0 ] && echo true || echo false)"
ck 'unknown slug 404'           404 "$(st "$JAR_ANON" GET '/api/v1/packages/no-such-package')"

# The literal segments must not be swallowed by /:slug.
ck 'facets not matched as slug' 200 "$(st "$JAR_ANON" GET '/api/v1/packages/facets')"

say '3. 8.1 — enquiries (auth boundary)'
ck 'enquiry unauth 401'         401 "$(st "$JAR_ANON" POST '/api/v1/packages/d0000002-0000-4000-8000-000000000001/enquiries' '{"message":"We are interested in this package for December."}')"
ck 'mine unauth 401'            401 "$(st "$JAR_ANON" GET '/api/v1/packages/enquiries/mine')"
ck 'enquiry too short 400'      400 "$(st "$JAR_IND" POST '/api/v1/packages/d0000002-0000-4000-8000-000000000001/enquiries' '{"message":"hi"}')"
ck 'enquiry on placeholder 201' 201 "$(st "$JAR_IND" POST '/api/v1/packages/d0000002-0000-4000-8000-000000000001/enquiries' '{"message":"We are interested in this package for December 2026.","guestCount":120}')"
ENQ_ID=$(body "['data']['id']")
ck 'enquiry linked to package'  'd0000002-0000-4000-8000-000000000001' "$(body "['data']['packageId']")"
ck 'my enquiries'               200 "$(st "$JAR_IND" GET '/api/v1/packages/enquiries/mine')"
MINE=$(body "['data']['total']")
echo "     my package enquiries: $MINE"
ck 'enquiry appears in mine'    true "$([ "${MINE:-0}" -ge 1 ] && echo true || echo false)"

# The row really landed in vendor_inquiries with package_id set — proving reuse
# of the existing table rather than a silent second write path.
DB_ENQ=$($PSQL "SELECT count(*) FROM vendor_inquiries WHERE package_id='d0000002-0000-4000-8000-000000000001'" | head -1 | tr -d '\r')
ck 'row in vendor_inquiries'    true "$([ "${DB_ENQ:-0}" -ge 1 ] && echo true || echo false)"

say '4. 8.1 — THE PLACEHOLDER GUARD (both directions)'
PKG='d0000002-0000-4000-8000-000000000001'
# 4a. Placeholder supply must refuse a booking.
ck 'booking-check on placeholder 409' 409 "$(st "$JAR_IND" POST "/api/v1/packages/$PKG/booking-check")"
ck 'error code is PLACEHOLDER_SUPPLY' 'PLACEHOLDER_SUPPLY' "$(body "['error']['code']")"

# 4b. Flip the SAME package to real supply. If the guard were absent or inert,
#     4a would have to have failed for some other reason and this would not
#     change the outcome. It must now succeed.
$PSQL "UPDATE premium_packages SET is_placeholder=false WHERE id='$PKG'" >/dev/null
ck 'booking-check on real supply 200' 200 "$(st "$JAR_IND" POST "/api/v1/packages/$PKG/booking-check")"
ck 'reports bookable'                 'True' "$(body "['data']['bookable']")"

# 4c. Restore, and confirm the refusal comes back — proves the flag is what
#     decided it, not some incidental state that changed in between.
$PSQL "UPDATE premium_packages SET is_placeholder=true WHERE id='$PKG'" >/dev/null
ck 'restored to placeholder 409'      409 "$(st "$JAR_IND" POST "/api/v1/packages/$PKG/booking-check")"

# 4d. The flag must NOT affect visibility — a placeholder package still browses.
ck 'placeholder still in browse'      200 "$(st "$JAR_ANON" GET '/api/v1/packages?city=Udaipur')"
STILL=$(body "['data']['total']")
ck 'browse count unchanged by flag'   "$UDAIPUR" "$STILL"

say '5. 8.1 — admin CRUD + role boundary'
ck 'admin list as INDIVIDUAL 403' 403 "$(st "$JAR_IND" GET '/api/v1/packages/admin')"
ck 'admin list unauth 401'        401 "$(st "$JAR_ANON" GET '/api/v1/packages/admin')"
ck 'admin list as ADMIN 200'      200 "$(st "$JAR_ADM" GET '/api/v1/packages/admin')"
ck 'admin create as INDIVIDUAL 403' 403 "$(st "$JAR_IND" POST '/api/v1/packages/admin' '{"vendorId":"d0000001-0000-4000-8000-000000000001","slug":"e2e-x","title":"E2E","destinationCity":"Udaipur","priceFrom":"100000.00","guestCapacityMax":100}')"

ck 'admin create 201' 201 "$(st "$JAR_ADM" POST '/api/v1/packages/admin' '{"vendorId":"d0000001-0000-4000-8000-000000000001","slug":"e2e-probe-package","title":"E2E Probe Package","destinationCity":"Udaipur","priceFrom":"123456.00","guestCapacityMin":10,"guestCapacityMax":100,"inclusions":[{"label":"Probe inclusion","kind":"INCLUSION","sortOrder":0}]}')"
NEW_ID=$(body "['data']['id']")
# City must have been resolved to the registry automatically.
ck 'city auto-linked to registry' 'd0000000-0000-4000-8000-000000000001' "$(body "['data']['cityId']")"
ck 'duplicate slug 409'           409 "$(st "$JAR_ADM" POST '/api/v1/packages/admin' '{"vendorId":"d0000001-0000-4000-8000-000000000001","slug":"e2e-probe-package","title":"Dup","destinationCity":"Goa","priceFrom":"1.00","guestCapacityMax":10}')"
ck 'inverted capacity 400'        400 "$(st "$JAR_ADM" POST '/api/v1/packages/admin' '{"vendorId":"d0000001-0000-4000-8000-000000000001","slug":"e2e-bad-cap","title":"Bad","destinationCity":"Goa","priceFrom":"1.00","guestCapacityMin":500,"guestCapacityMax":10}')"
ck 'uppercase slug rejected 400'  400 "$(st "$JAR_ADM" POST '/api/v1/packages/admin' '{"vendorId":"d0000001-0000-4000-8000-000000000001","slug":"E2E-Upper","title":"Bad","destinationCity":"Goa","priceFrom":"1.00","guestCapacityMax":10}')"

ck 'admin update 200'             200 "$(st "$JAR_ADM" PATCH "/api/v1/packages/admin/$NEW_ID" '{"title":"E2E Probe Renamed","destinationCity":"Goa"}')"
ck 'city relink on rename'        'd0000000-0000-4000-8000-000000000003' "$(body "['data']['cityId']")"
ck 'admin deactivate 200'         200 "$(st "$JAR_ADM" DELETE "/api/v1/packages/admin/$NEW_ID")"
ck 'deactivated hidden from public' 404 "$(st "$JAR_ANON" GET '/api/v1/packages/e2e-probe-package')"

# ── 8.2 ──────────────────────────────────────────────────────────────────────
say '6. 8.2 — categories + browse'
ck 'categories'                 200 "$(st "$JAR_ANON" GET '/api/v1/post-marriage/categories')"
CATS=$(body "['data']['categories'].__len__()")
echo "     categories: $CATS"
ck '8 categories seeded'        8 "$CATS"

ck 'browse services'            200 "$(st "$JAR_ANON" GET '/api/v1/post-marriage/services?limit=5')"
SVC_TOTAL=$(body "['data']['total']")
echo "     total services: $SVC_TOTAL"
ck 'services seeded'            true "$([ "${SVC_TOTAL:-0}" -ge 28 ] && echo true || echo false)"

ck 'filter by category'         200 "$(st "$JAR_ANON" GET '/api/v1/post-marriage/services?category=honeymoon-planning')"
HONEY=$(body "['data']['total']")
echo "     honeymoon services: $HONEY"
ck 'category filter narrows'    true "$([ "${HONEY:-0}" -lt "${SVC_TOTAL:-0}" ] && echo true || echo false)"

ck 'cities list'                200 "$(st "$JAR_ANON" GET '/api/v1/post-marriage/services/cities')"
ck 'cities not matched as slug' true "$(python3 -c "import json;d=json.load(open('/tmp/p8body.json'));print(str('cities' in d.get('data',{})).lower())")"

# A QUOTE-priced service has price_from NULL; PRICE_ASC must not lead with it.
ck 'sort PRICE_ASC'             200 "$(st "$JAR_ANON" GET '/api/v1/post-marriage/services?sort=PRICE_ASC&limit=1')"
FIRST_PRICE=$(body "['data']['services'][0]['priceFrom']")
ck 'nulls sort last, not first' true "$([ "$FIRST_PRICE" != "None" ] && echo true || echo false)"

say '7. 8.2 — detail + enquiry'
ck 'service detail'             200 "$(st "$JAR_ANON" GET '/api/v1/post-marriage/services/maldives-honeymoon-6-nights')"
PARTNER=$(body "['data']['partnerName']")
RELATED=$(body "['data']['relatedServices'].__len__()")
echo "     partner: $PARTNER, related: $RELATED"
ck 'related excludes self'      true "$(python3 -c "
import json;d=json.load(open('/tmp/p8body.json'))['data']
print(str(all(s['id']!=d['id'] for s in d['relatedServices'])).lower())")"
ck 'unknown service 404'        404 "$(st "$JAR_ANON" GET '/api/v1/post-marriage/services/nope')"

ck 'enquiry unauth 401'         401 "$(st "$JAR_ANON" POST '/api/v1/post-marriage/services/e0000002-0000-4000-8000-000000000001/enquiries' '{"message":"Interested in the Maldives package please."}')"
ck 'enquiry 201'                201 "$(st "$JAR_IND" POST '/api/v1/post-marriage/services/e0000002-0000-4000-8000-000000000001/enquiries' '{"message":"Interested in the Maldives package for March please.","preferredContact":"EMAIL"}')"
SVC_ENQ=$(body "['data']['id']")
ck 'status OPEN'                'OPEN' "$(body "['data']['status']")"
ck 'my service enquiries'       200 "$(st "$JAR_IND" GET '/api/v1/post-marriage/enquiries/mine')"

say '8. 8.2 — admin triage + atomic reply'
ck 'triage as INDIVIDUAL 403'   403 "$(st "$JAR_IND" GET '/api/v1/post-marriage/admin/enquiries')"
ck 'triage as ADMIN 200'        200 "$(st "$JAR_ADM" GET '/api/v1/post-marriage/admin/enquiries')"
ck 'reply 200'                  200 "$(st "$JAR_ADM" POST "/api/v1/post-marriage/admin/enquiries/$SVC_ENQ/reply" '{"partnerReply":"Thanks — our team will confirm availability and revert within 24 hours.","status":"CONTACTED"}')"
ck 'status now CONTACTED'       'CONTACTED' "$(body "['data']['status']")"
# The conditional UPDATE is guarded on status='OPEN', so a second reply must
# lose rather than silently overwrite the first.
ck 'second reply 409 (no TOCTOU)' 409 "$(st "$JAR_ADM" POST "/api/v1/post-marriage/admin/enquiries/$SVC_ENQ/reply" '{"partnerReply":"Duplicate reply attempt."}')"
ck 'reply to unknown 404'       404 "$(st "$JAR_ADM" POST '/api/v1/post-marriage/admin/enquiries/00000000-0000-4000-8000-000000000000/reply' '{"partnerReply":"x"}')"

say '9. Cleanup'
$PSQL "DELETE FROM service_enquiries WHERE id='$SVC_ENQ'" >/dev/null
$PSQL "DELETE FROM vendor_inquiries WHERE id='$ENQ_ID'" >/dev/null
# Delete by SLUG PREFIX, not by the id captured this run. An earlier run that
# died before cleanup leaves a row the captured id cannot reach, and the
# leftover then fails the assertion below on every subsequent run.
$PSQL "DELETE FROM premium_package_inclusions WHERE package_id IN (SELECT id FROM premium_packages WHERE slug LIKE 'e2e-%')" >/dev/null
$PSQL "DELETE FROM vendor_inquiries WHERE package_id IN (SELECT id FROM premium_packages WHERE slug LIKE 'e2e-%')" >/dev/null
$PSQL "DELETE FROM premium_packages WHERE slug LIKE 'e2e-%'" >/dev/null
LEFT_PKG=$($PSQL "SELECT count(*) FROM premium_packages WHERE slug LIKE 'e2e-%'" | head -1 | tr -d '\r')
LEFT_ENQ=$($PSQL "SELECT count(*) FROM service_enquiries" | head -1 | tr -d '\r')
ck 'no e2e packages left'  0 "$LEFT_PKG"
ck 'no enquiries left'     0 "$LEFT_ENQ"
# The guard flag must be back where it started.
FLAG=$($PSQL "SELECT is_placeholder FROM premium_packages WHERE id='$PKG'" | head -1 | tr -d '\r')
ck 'placeholder flag restored' 't' "$FLAG"

printf '\n\033[1mPASS %d · FAIL %d\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
