#!/usr/bin/env bash
# Интеграционный smoke по разделу «Applications» спеки.
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

# Setup: тренер, организатор, 4 боксёра, опубликованный турнир (cats 60,67,75,86,92)
post POST /auth/register "" "{\"email\":\"tr-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR_TOKEN=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG_TOKEN=$(json '["accessToken"]')

post POST /boxers "$TR_TOKEN" '{"fullName":"Альфа Альфа","dob":"2000-01-15","gender":"MALE","weight":59}' >/dev/null
B1=$(json '["id"]')
post POST /boxers "$TR_TOKEN" '{"fullName":"Бета Бета","dob":"2000-01-15","gender":"MALE","weight":71}' >/dev/null
B2=$(json '["id"]')
post POST /boxers "$TR_TOKEN" '{"fullName":"Гамма Гамма","dob":"2000-01-15","gender":"MALE","weight":80}' >/dev/null
B3=$(json '["id"]')
post POST /boxers "$TR_TOKEN" '{"fullName":"Дельта Дельта","dob":"2000-01-15","gender":"MALE","weight":95}' >/dev/null
B4=$(json '["id"]')

TBODY="{\"name\":\"T-$STAMP\",\"type\":\"REGIONAL\",\"level\":\"AMATEUR\",\"dateStart\":\"2099-09-10\",\"dateEnd\":\"2099-09-11\",\"city\":\"Москва\",\"categories\":[60,67,75,86,92],\"rounds\":3,\"roundDuration\":3,\"helmets\":false}"
post POST /tournaments "$ORG_TOKEN" "$TBODY" >/dev/null
TID=$(json '["id"]')
post POST "/tournaments/$TID/publish" "$ORG_TOKEN" >/dev/null

# 1. Подача пакетом 3-х боксёров (B1,B2,B3) → 201
BODY="{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B1\"},{\"boxerId\":\"$B2\"},{\"boxerId\":\"$B3\"}]}"
CODE=$(post POST /applications "$TR_TOKEN" "$BODY")
record "01 пакет 3-х → 201" "$CODE" "201"
record "01 все PENDING" "$(json "['items'][0]['status']+'/'+d['items'][1]['status']+'/'+d['items'][2]['status']")" "PENDING/PENDING/PENDING"

# 2. Авто-категория: B2 (71) → 75
record "02 авто 71→75" "$(python3 -c "import json;print(float(json.load(open('/tmp/boxr-body.json'))['items'][1]['category']))")" "75.0"

# A1 = id первой созданной (B1, авто 60)
A1=$(json "['items'][0]['id']")

# 3. Override category=86 при weight=80 — сначала отзываем и удаляем заявку B3
A3=$(json "['items'][2]['id']")
post POST "/applications/$A3/withdraw" "$TR_TOKEN" >/dev/null
post DELETE "/applications/$A3" "$TR_TOKEN" >/dev/null
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B3\",\"category\":86}]}")
record "03 override 80→86 → 201" "$CODE" "201"

# 4. Override на категорию вне турнира → 400 CATEGORY_NOT_IN_TOURNAMENT
post POST /boxers "$TR_TOKEN" '{"fullName":"Эпсилон Эпсилон","dob":"2000-01-15","gender":"MALE","weight":71}' >/dev/null
B5=$(json '["id"]')
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B5\",\"category\":63.5}]}")
record "04 категория не в турнире → 400" "$CODE" "400"
record "04 code" "$(json "['errors'][0]['code']")" "CATEGORY_NOT_IN_TOURNAMENT"

# 5. Override на меньшую (вес 80, категория 75) → WEIGHT_EXCEEDS_CATEGORY
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B5\",\"category\":67}]}")
record "05 weight>category → 400" "$CODE" "400"

# 6. Boxer overweight (B4: 95, max=92)
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B4\"}]}")
record "06 overweight → 400" "$CODE" "400"
record "06 code" "$(json "['errors'][0]['code']")" "BOXER_OVERWEIGHT"

# 7. Дубль: B1 уже подан
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B1\"}]}")
record "07 дубль → 400 DUPLICATE" "$(json "['errors'][0]['code']")" "DUPLICATE"

# 8. Approve PENDING → APPROVED
CODE=$(post POST "/applications/$A1/approve" "$ORG_TOKEN")
record "08 approve → 200" "$CODE" "200"
record "08 status APPROVED" "$(json '["status"]')" "APPROVED"

# 9. Reject с reason
post GET "/tournaments/$TID/applications?status=PENDING" "$ORG_TOKEN" >/dev/null
A_PENDING=$(json "['items'][0]['id']")
post POST "/applications/$A_PENDING/reject" "$ORG_TOKEN" '{"reason":"некомплект документов"}' >/dev/null
record "09 reject → REJECTED" "$(json '["status"]')" "REJECTED"
record "09 reason" "$(json '["rejectReason"]')" "некомплект документов"

# 10. Approve уже APPROVED → 409
CODE=$(post POST "/applications/$A1/approve" "$ORG_TOKEN")
record "10 approve уже APPROVED → 409" "$CODE" "409"

# 11. Withdraw APPROVED → WITHDRAWN
CODE=$(post POST "/applications/$A1/withdraw" "$TR_TOKEN")
record "11 withdraw APPROVED → 200" "$CODE" "200"
record "11 status WITHDRAWN" "$(json '["status"]')" "WITHDRAWN"

# 12. DELETE WITHDRAWN → 204
CODE=$(post DELETE "/applications/$A1" "$TR_TOKEN")
record "12 DELETE WITHDRAWN → 204" "$CODE" "204"

# 13. После cancel турнира: submit → 409
post POST "/tournaments/$TID/cancel" "$ORG_TOKEN" >/dev/null
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B5\"}]}")
record "13 submit на CANCELLED → 409" "$CODE" "409"

echo
printf '%s\n' "${RESULTS[@]}"
echo
echo "PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
