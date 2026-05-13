#!/usr/bin/env bash
# boxr-api/scripts/test-bracket.sh
# Интеграционный smoke по спеке docs/superpowers/specs/2026-05-07-matches-bracket-design.md.
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
# Save copy of /tmp/boxr-body.json under a stable name; we use it to read bracket state
# without losing it on subsequent calls.
snap() { cp /tmp/boxr-body.json /tmp/boxr-snap.json; }
jsnap() { python3 -c "import sys,json;d=json.load(open('/tmp/boxr-snap.json'));print(d$1)"; }

# 1) Регистрация
post POST /auth/register "" "{\"email\":\"tr-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG=$(json '["accessToken"]')

# 2) Создание турнира с 1 категорией
status=$(post POST /tournaments "$ORG" '{"name":"BracketTest","type":"REGIONAL","level":"AMATEUR","dateStart":"2099-06-14","dateEnd":"2099-06-16","city":"Москва","categories":[75],"rounds":3,"roundDuration":3,"helmets":false}')
record "create tournament" "$status" "201"
T_ID=$(json '["id"]')
post POST "/tournaments/$T_ID/publish" "$ORG" >/dev/null

# 3) Создаём 6 боксёров под тренером
declare -a BOXERS
for i in 1 2 3 4 5 6; do
  post POST /boxers "$TR" "{\"fullName\":\"Боксёр $i $STAMP\",\"dob\":\"2000-01-15\",\"gender\":\"MALE\",\"weight\":75}" >/dev/null
  BOXERS+=("$(json '["id"]')")
done

# 4) Подаём 6 заявок и одобряем
declare -a APPS
for B in "${BOXERS[@]}"; do
  post POST /applications "$TR" "{\"tournamentId\":\"$T_ID\",\"items\":[{\"boxerId\":\"$B\",\"category\":75}]}" >/dev/null
  APPS+=("$(json '["items"][0]["id"]')")
done
for A in "${APPS[@]}"; do
  post POST "/applications/$A/approve" "$ORG" >/dev/null
done

# 5) Генерируем сетку
status=$(post POST "/tournaments/$T_ID/bracket" "$ORG")
record "generate bracket" "$status" "200"
snap
NUM_MATCHES=$(jsnap '["categories"][0]["matches"].__len__()')
record "matches count" "$NUM_MATCHES" "7"  # 4 матча 1/4 (2 из них bye-WO) + 2 полуфинала + финал
TOURN_STATUS=$(jsnap '["tournament"]["status"]')
record "tournament status" "$TOURN_STATUS" "IN_PROGRESS"

# 6) Фиксируем все READY-матчи 1-го раунда (с 6 боксёрами их 2; ещё 2 bye уже COMPLETED).
READY_R1_IDS=$(python3 -c "
import json
d=json.load(open('/tmp/boxr-snap.json'))
ms=d['categories'][0]['matches']
ids=[m['id'] for m in ms if m['round']==1 and m['status']=='READY']
print(' '.join(ids))
")
i=0
for MID in $READY_R1_IDS; do
  status=$(post PATCH "/matches/$MID" "$ORG" '{"winner":"RED","outcome":"WP"}')
  record "fix 1/4 #$i" "$status" "200"
  snap
  i=$((i+1))
done

# 7) Полуфиналы (round=2) — берём свежие matches из последнего ответа PATCH
SEMI_IDS=$(python3 -c "
import json
d=json.load(open('/tmp/boxr-snap.json'))
ms=d['categories'][0]['matches']
ids=[m['id'] for m in ms if m['round']==2]
print(' '.join(ids))
")
read -r SEMI_0 SEMI_1 <<< "$SEMI_IDS"

status=$(post PATCH "/matches/$SEMI_0" "$ORG" '{"winner":"RED","outcome":"KO","endRound":2}')
record "fix semi 0" "$status" "200"
snap
status=$(post PATCH "/matches/$SEMI_1" "$ORG" '{"winner":"BLUE","outcome":"WP"}')
record "fix semi 1" "$status" "200"
snap

# 8) Финал (round=3)
FINAL=$(python3 -c "
import json
d=json.load(open('/tmp/boxr-snap.json'))
ms=d['categories'][0]['matches']
print([m['id'] for m in ms if m['round']==3][0])
")
status=$(post PATCH "/matches/$FINAL" "$ORG" '{"winner":"RED","outcome":"WP"}')
record "fix final" "$status" "200"
snap
TOURN_STATUS=$(jsnap '["tournament"]["status"]')
record "tournament FINISHED" "$TOURN_STATUS" "FINISHED"

# 9) Публичные результаты
status=$(post GET "/tournaments/public/$T_ID/results")
record "public results" "$status" "200"
GOLD=$(json '["categories"][0]["podium"]["gold"]')
[ "$GOLD" != "None" ] && record "podium has gold" "yes" "yes" || record "podium has gold" "no" "yes"

# 10) Откат финала возвращает турнир в IN_PROGRESS
status=$(post DELETE "/matches/$FINAL/result" "$ORG")
record "clear final" "$status" "200"
snap
TOURN_STATUS=$(jsnap '["tournament"]["status"]')
record "back to IN_PROGRESS" "$TOURN_STATUS" "IN_PROGRESS"

# 11) Фиксируем финал заново и пробуем откатить полуфинал → 422 (нельзя откатывать внутренний матч,
# пока его потомок зафиксирован).
post PATCH "/matches/$FINAL" "$ORG" '{"winner":"RED","outcome":"WP"}' >/dev/null
status=$(post DELETE "/matches/$SEMI_0/result" "$ORG")
record "blocked clear of inner" "$status" "422"

# Итог
echo
for r in "${RESULTS[@]}"; do echo "$r"; done
echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
