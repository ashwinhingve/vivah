#!/usr/bin/env bash
# Unit 8.1 — the two paths the stateless E2E cannot reach: a real guest travelling
# to a leg, and a real ceremony DETACHING (not being deleted) when its leg goes.
# Seeds fixtures, exercises them over authenticated HTTP, then removes everything.

set -uo pipefail
API="${API:-http://localhost:4010}"
WED="0ada0009-0000-4000-8000-000000000001"
PHONE="+917000000001"
OTP="123456"
JAR=/tmp/ck_data.txt
PSQL="env PGPASSWORD=vivah psql -h localhost -p 5433 -U vivah -d smart_shaadi -tAc"

pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then printf '  ok   %-50s [%s]\n' "$1" "$3"; pass=$((pass+1));
       else printf '  FAIL %-50s expected %s got %s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi; }
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

st() { local m="$1" p="$2" b="${3:-}"
  curl -s -b "$JAR" -o /tmp/body.json -w '%{http_code}' -X "$m" "$API$p" \
    -H 'Content-Type: application/json' ${b:+-d "$b"}; }

say '0. Login + seed fixtures'
curl -s -c "$JAR" -X POST "$API/api/auth/phone-number/send-otp" \
  -H 'Content-Type: application/json' -d "{\"phoneNumber\":\"$PHONE\"}" >/dev/null
curl -s -b "$JAR" -c "$JAR" -X POST "$API/api/auth/phone-number/verify" \
  -H 'Content-Type: application/json' -d "{\"phoneNumber\":\"$PHONE\",\"code\":\"$OTP\"}" >/dev/null

# clear any residue from prior runs
$PSQL "DELETE FROM wedding_destinations WHERE wedding_id='$WED'" >/dev/null
$PSQL "DELETE FROM ceremonies WHERE wedding_id='$WED' AND custom_type_name='E2E_FIXTURE'" >/dev/null

# one guest list + guest for this wedding
$PSQL "INSERT INTO guest_lists (wedding_id, created_by) VALUES ('$WED','qa-ind-01') ON CONFLICT (wedding_id) DO NOTHING" >/dev/null
# head -1: psql -tAc prints the RETURNING value AND the command tag ("INSERT 0 1"),
# and capturing both produced a malformed uuid the API correctly rejected with 400.
$PSQL "INSERT INTO guests (guest_list_id, name, side) SELECT id,'E2E Traveller','BRIDE' FROM guest_lists WHERE wedding_id='$WED'" >/dev/null
GUEST=$($PSQL "SELECT g.id FROM guests g JOIN guest_lists gl ON gl.id=g.guest_list_id WHERE gl.wedding_id='$WED' AND g.name='E2E Traveller' LIMIT 1" | head -1 | tr -d '\r')
echo "     guest: $GUEST"

say '1. Create a leg, then attach a real ceremony to it'
code=$(st POST "/api/v1/weddings/$WED/destinations" '{"city":"Udaipur","arriveOn":"2026-12-04","departOn":"2026-12-07"}')
ck 'create leg' 201 "$code"
LEG=$(python3 -c "import json;print(json.load(open('/tmp/body.json'))['data']['destination']['id'])")
echo "     leg: $LEG"

# a ceremony INSIDE the window, and one OUTSIDE it, both attached to the leg
$PSQL "INSERT INTO ceremonies (wedding_id, type, custom_type_name, date, destination_id) VALUES ('$WED','HALDI','E2E_FIXTURE','2026-12-05','$LEG')" >/dev/null
$PSQL "INSERT INTO ceremonies (wedding_id, type, custom_type_name, date, destination_id) VALUES ('$WED','SANGEET','E2E_FIXTURE','2026-12-20','$LEG')" >/dev/null
echo "     attached 2 ceremonies (one inside the window, one outside)"

say '2. Guest travel SUCCESS path (not just the 404)'
code=$(st PUT "/api/v1/weddings/$WED/destinations/$LEG/travel" \
  "{\"guestId\":\"$GUEST\",\"arrivalDate\":\"2026-12-04\",\"arrivalTime\":\"14:30\",\"travelNotes\":\"Flying from Mumbai\"}")
ck 'upsert travel for a real guest' 200 "$code"
python3 -c "
import json;t=json.load(open('/tmp/body.json'))['data']['travel']
print('     stored:', t['guestName'], t['arrivalDate'], t['arrivalTime'])
print('     phone/email absent from payload:', 'phone' not in t and 'email' not in t)
"

say '3. Upsert again — must UPDATE, not duplicate'
code=$(st PUT "/api/v1/weddings/$WED/destinations/$LEG/travel" \
  "{\"guestId\":\"$GUEST\",\"arrivalDate\":\"2026-12-05\",\"arrivalTime\":\"09:15\"}")
ck 'second upsert same guest' 200 "$code"
n=$($PSQL "SELECT count(*) FROM guest_travel_legs WHERE destination_id='$LEG'")
ck 'still exactly ONE travel row' 1 "$n"
$PSQL "SELECT '     now: '||arrival_date||' '||arrival_time FROM guest_travel_legs WHERE destination_id='$LEG'"

say '4. Counts + outsideWindow flag surface correctly'
code=$(st GET "/api/v1/weddings/$WED/destinations"); ck 'list' 200 "$code"
python3 -c "
import json;r=json.load(open('/tmp/body.json'))['data']['destinations'][0]
print('     ceremonyCount:', r['ceremonyCount'], ' travellerCount:', r['travellerCount'])
assert r['ceremonyCount']==2, 'ceremonyCount wrong (cartesian join would say 4)'
assert r['travellerCount']==1, 'travellerCount wrong'
print('     counts are independent, not multiplied')
"
code=$(st GET "/api/v1/weddings/$WED/destinations/$LEG"); ck 'detail' 200 "$code"
python3 -c "
import json;d=json.load(open('/tmp/body.json'))['data']
for c in d['ceremonies']:
    print('     ceremony', c['type'], c['date'], 'outsideWindow=', c['outsideWindow'])
inside=[c for c in d['ceremonies'] if not c['outsideWindow']]
outside=[c for c in d['ceremonies'] if c['outsideWindow']]
assert len(inside)==1 and len(outside)==1, 'outsideWindow flag wrong'
print('     soft flag correct: 1 inside, 1 outside')
"

say '5. Delete the leg — ceremonies DETACH, travel cascades'
code=$(st DELETE "/api/v1/weddings/$WED/destinations/$LEG"); ck 'delete leg' 200 "$code"
python3 -c "
import json;print('     reported detachedCeremonies:', json.load(open('/tmp/body.json'))['data']['detachedCeremonies'])
"
alive=$($PSQL "SELECT count(*) FROM ceremonies WHERE wedding_id='$WED' AND custom_type_name='E2E_FIXTURE'")
ck 'both ceremonies SURVIVED the leg delete' 2 "$alive"
orphan=$($PSQL "SELECT count(*) FROM ceremonies WHERE custom_type_name='E2E_FIXTURE' AND destination_id IS NOT NULL")
ck 'and are now detached (destination_id NULL)' 0 "$orphan"
travel=$($PSQL "SELECT count(*) FROM guest_travel_legs WHERE guest_id='$GUEST'")
ck 'travel rows cascaded away' 0 "$travel"

say 'CLEANUP'
$PSQL "DELETE FROM ceremonies WHERE wedding_id='$WED' AND custom_type_name='E2E_FIXTURE'" >/dev/null
$PSQL "DELETE FROM guests WHERE id='$GUEST'" >/dev/null
$PSQL "DELETE FROM guest_lists WHERE wedding_id='$WED'" >/dev/null
$PSQL "DELETE FROM wedding_destinations WHERE wedding_id='$WED'" >/dev/null
echo "     ceremonies left: $($PSQL "SELECT count(*) FROM ceremonies WHERE wedding_id='$WED'")"
echo "     destinations left: $($PSQL "SELECT count(*) FROM wedding_destinations")"
echo "     guests left: $($PSQL "SELECT count(*) FROM guests")"

printf '\n\033[1mRESULT: %d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
