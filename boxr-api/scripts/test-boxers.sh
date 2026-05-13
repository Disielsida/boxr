#!/usr/bin/env bash
# Интеграционный smoke по разделу «Boxers» спеки
# 2026-05-06-boxers-applications-design.md.
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

# Регистрируем 1 тренера и 1 организатора
post POST /auth/register "" "{\"email\":\"tr-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR_TOKEN=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG_TOKEN=$(json '["accessToken"]')

VALID="{\"fullName\":\"Иванов И.И.\",\"dob\":\"2000-01-15\",\"gender\":\"MALE\",\"weight\":71}"

# 1. TRAINER POST → 201
CODE=$(post POST /boxers "$TR_TOKEN" "$VALID")
record "01 TRAINER POST → 201" "$CODE" "201"
BID=$(json '["id"]')

# 2. ORGANIZER POST → 403
CODE=$(post POST /boxers "$ORG_TOKEN" "$VALID")
record "02 ORGANIZER POST → 403" "$CODE" "403"

# 3. GET /boxers видит свой
post GET /boxers "$TR_TOKEN" >/dev/null
record "03 GET /boxers содержит свой" "$(json "['items'][0]['id'] if d['items'] else ''")" "$BID"

# 4. Чужой GET — регистрируем второго тренера
post POST /auth/register "" "{\"email\":\"tr2-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr2\",\"role\":\"TRAINER\"}" >/dev/null
TR2_TOKEN=$(json '["accessToken"]')
CODE=$(post GET "/boxers/$BID" "$TR2_TOKEN")
record "04 чужой GET → 404" "$CODE" "404"

# 5. PATCH чужого → 404
CODE=$(post PATCH "/boxers/$BID" "$TR2_TOKEN" '{"club":"hijack"}')
record "05 чужой PATCH → 404" "$CODE" "404"

# 6. DELETE без активных заявок → 204
CODE=$(post DELETE "/boxers/$BID" "$TR_TOKEN")
record "06 DELETE без заявок → 204" "$CODE" "204"

# 7. Создаём ещё одного боксёра, турнир, заявку, потом DELETE → 409
post POST /boxers "$TR_TOKEN" "$VALID" >/dev/null
BID2=$(json '["id"]')
TBODY="{\"name\":\"T-$STAMP\",\"type\":\"REGIONAL\",\"level\":\"AMATEUR\",\"dateStart\":\"2099-09-10\",\"dateEnd\":\"2099-09-11\",\"city\":\"Москва\",\"categories\":[60,67,75],\"rounds\":3,\"roundDuration\":3,\"helmets\":false}"
post POST /tournaments "$ORG_TOKEN" "$TBODY" >/dev/null
TID=$(json '["id"]')
post POST "/tournaments/$TID/publish" "$ORG_TOKEN" >/dev/null
post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$BID2\"}]}" >/dev/null
CODE=$(post DELETE "/boxers/$BID2" "$TR_TOKEN")
record "07 DELETE с PENDING заявкой → 409" "$CODE" "409"

# 8. Валидация: weight=-1 → 400, dob в будущем → 400
CODE=$(post POST /boxers "$TR_TOKEN" '{"fullName":"Тест Тестов","dob":"2000-01-15","gender":"MALE","weight":-1}')
record "08a weight=-1 → 400" "$CODE" "400"
CODE=$(post POST /boxers "$TR_TOKEN" '{"fullName":"Тест Тестов","dob":"2999-01-01","gender":"MALE","weight":70}')
record "08b dob future → 400" "$CODE" "400"

echo
printf '%s\n' "${RESULTS[@]}"
echo
echo "PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
