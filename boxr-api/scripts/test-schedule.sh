#!/usr/bin/env bash
# boxr-api/scripts/test-schedule.sh
# Интеграционный smoke по спеке docs/superpowers/specs/2026-05-08-schedule-design.md.
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

# 1) Setup: 3 дня, 2 ринга, 4 боксёра в категории 71
post POST /auth/register "" "{\"email\":\"tr-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG=$(json '["accessToken"]')

post POST /tournaments "$ORG" '{"name":"ScheduleTest","type":"REGIONAL","level":"AMATEUR","dateStart":"2099-06-14","dateEnd":"2099-06-16","city":"Москва","categories":[71],"rounds":3,"roundDuration":3,"helmets":false,"ringCount":2}' >/dev/null
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

# 2) Генерируем расписание
status=$(post POST "/tournaments/$T_ID/schedule" "$ORG")
record "generate schedule" "$status" "200"
snap
NUM=$(jsnap '["categories"][0]["matches"].__len__()')
record "matches count" "$NUM" "3"
HAS_RING=$(jsnap '["categories"][0]["matches"][0]["ring"]')
[ "$HAS_RING" != "None" ] && record "first match has ring" "yes" "yes" || record "first match has ring" "no" "yes"

# 3) Конфликт по слоту: ставим M1 в тот же слот что M0 → 422
M0=$(jsnap "['categories'][0]['matches'][0]['id']")
M1=$(jsnap "['categories'][0]['matches'][1]['id']")
TIME0=$(jsnap "['categories'][0]['matches'][0]['scheduledAt']")
RING0=$(jsnap "['categories'][0]['matches'][0]['ring']")
status=$(post PATCH "/matches/$M1/schedule" "$ORG" "{\"scheduledAt\":\"$TIME0\",\"ring\":$RING0}")
record "conflict slot 422" "$status" "422"

# 4) Фиксируем M0 (он должен быть READY)
post PATCH "/matches/$M0" "$ORG" '{"winner":"RED","outcome":"WP"}' >/dev/null

# 5) Перегенерация после фиксации → 422
status=$(post POST "/tournaments/$T_ID/schedule" "$ORG")
record "regen blocked" "$status" "422"

# 6) Clear после фиксации → 422
status=$(post DELETE "/tournaments/$T_ID/schedule" "$ORG")
record "clear blocked" "$status" "422"

echo
for r in "${RESULTS[@]}"; do echo "$r"; done
echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
