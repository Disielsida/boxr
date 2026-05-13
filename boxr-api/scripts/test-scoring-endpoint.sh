#!/usr/bin/env bash
# boxr-api/scripts/test-scoring-endpoint.sh
# Smoke по эндпоинту GET /matches/:matchId (для Live Scoring).
# Требует запущенный API на http://localhost:3000/api/v1.

set -u
API="${API:-http://localhost:3000/api/v1}"
STAMP=$(date +%s%N)$$
PASS=0; FAIL=0; RESULTS=()

record() {
  local name="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); RESULTS+=("OK   $name (got=$got)")
  else FAIL=$((FAIL+1)); RESULTS+=("FAIL $name (want=$want got=$got)"); fi
}
post() {
  local m="$1" u="$2" t="${3:-}" b="${4:-}"
  local args=(-s -o /tmp/boxr-body.json -w "%{http_code}" -X "$m" "$API$u")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  [ -n "$b" ] && args+=(-H "Content-Type: application/json" -d "$b")
  curl "${args[@]}"
}
json() { python3 -c "import sys,json;d=json.load(open('/tmp/boxr-body.json'));print(d$1)"; }
snap() { cp /tmp/boxr-body.json /tmp/boxr-snap.json; }
jsnap() { python3 -c "import sys,json;d=json.load(open('/tmp/boxr-snap.json'));print(d$1)"; }

# 1) Setup: organizer + trainer, 4 boxers, bracket
post POST /auth/register "" "{\"email\":\"tr-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org2-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org2\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG2=$(json '["accessToken"]')

post POST /tournaments "$ORG" '{"name":"ScoringTest","type":"REGIONAL","level":"AMATEUR","dateStart":"2099-06-14","dateEnd":"2099-06-16","city":"Москва","categories":[71],"rounds":3,"roundDuration":3,"helmets":false}' >/dev/null
T_ID=$(json '["id"]')
post POST "/tournaments/$T_ID/publish" "$ORG" >/dev/null

declare -a BOXERS
for i in 1 2 3 4; do
  post POST /boxers "$TR" "{\"fullName\":\"Боксёр $i $STAMP\",\"dob\":\"2000-01-15\",\"gender\":\"MALE\",\"weight\":71}" >/dev/null
  BOXERS+=("$(json '["id"]')")
done
declare -a APPS
for B in "${BOXERS[@]}"; do
  post POST /applications "$TR" "{\"tournamentId\":\"$T_ID\",\"items\":[{\"boxerId\":\"$B\",\"category\":71}]}" >/dev/null
  APPS+=("$(json '["items"][0]["id"]')")
done
for A in "${APPS[@]}"; do
  post POST "/applications/$A/approve" "$ORG" >/dev/null
done
post POST "/tournaments/$T_ID/bracket" "$ORG" >/dev/null
snap

READY_ID=$(jsnap "['categories'][0]['matches'][0]['id']")
PENDING_ID=$(jsnap "['categories'][0]['matches'][2]['id']")  # финал — PENDING

# 2) Owner получает READY матч → 200
status=$(post GET "/matches/$READY_ID" "$ORG")
record "owner gets READY 200" "$status" "200"
HAS_RED=$(json '["match"]["red"]["fullName"]')
[ -n "$HAS_RED" ] && record "match has red boxer" "yes" "yes" || record "match has red boxer" "no" "yes"
ROUNDS=$(json '["tournament"]["rounds"]')
record "tournament rounds" "$ROUNDS" "3"

# 3) Without token → 401
status=$(post GET "/matches/$READY_ID" "")
record "no token 401" "$status" "401"

# 4) Other organizer → 403
status=$(post GET "/matches/$READY_ID" "$ORG2")
record "other org 403" "$status" "403"

# 5) PENDING (finals) → 422
status=$(post GET "/matches/$PENDING_ID" "$ORG")
record "PENDING 422" "$status" "422"

# 6) Зафиксировать READY → 422
post PATCH "/matches/$READY_ID" "$ORG" '{"winner":"RED","outcome":"WP"}' >/dev/null
status=$(post GET "/matches/$READY_ID" "$ORG")
record "COMPLETED 422" "$status" "422"

echo
for r in "${RESULTS[@]}"; do echo "$r"; done
echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
