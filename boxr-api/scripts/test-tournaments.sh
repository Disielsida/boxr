#!/usr/bin/env bash
# Интеграционный smoke по спеке docs/superpowers/specs/2026-05-06-tournaments-crud-design.md
# Требует запущенный API на http://localhost:3000/api/v1.
#
# Использует уникальные email-адреса (по timestamp+pid), не зависит от состояния БД,
# выводит итоговую таблицу OK/FAIL и завершает работу с ненулевым кодом при провале.

set -u

API="${API:-http://localhost:3000/api/v1}"
STAMP=$(date +%s%N)$$

PASS=0
FAIL=0
RESULTS=()

record() {
  local name="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    PASS=$((PASS + 1))
    RESULTS+=("OK   $name (got=$got)")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL $name (want=$want got=$got)")
  fi
}

post() { # method url token body → "<status>\n<body>"
  local m="$1" u="$2" t="${3:-}" b="${4:-}"
  local args=(-s -o /tmp/boxr-body.json -w "%{http_code}" -X "$m" "$API$u")
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  [ -n "$b" ] && args+=(-H "Content-Type: application/json" -d "$b")
  curl "${args[@]}"
}

json() { python3 -c "import sys,json;d=json.load(open('/tmp/boxr-body.json'));print(d$1)"; }

# ─── 0. Регистрация пользователей ─────────────────────────────────────────────
ORG1_EMAIL="org1-$STAMP@boxr.test"
ORG2_EMAIL="org2-$STAMP@boxr.test"
TR_EMAIL="tr-$STAMP@boxr.test"

post POST /auth/register "" "{\"email\":\"$ORG1_EMAIL\",\"password\":\"Strong1pw\",\"fullName\":\"Org 1\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG1_TOKEN=$(json '["accessToken"]')
ORG1_ID=$(json '["user"]["id"]')

post POST /auth/register "" "{\"email\":\"$ORG2_EMAIL\",\"password\":\"Strong1pw\",\"fullName\":\"Org 2\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG2_TOKEN=$(json '["accessToken"]')

post POST /auth/register "" "{\"email\":\"$TR_EMAIL\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR_TOKEN=$(json '["accessToken"]')

VALID_BODY="{
  \"name\":\"Тест-турнир $STAMP\",
  \"type\":\"REGIONAL\",\"level\":\"AMATEUR\",
  \"dateStart\":\"2099-06-14\",\"dateEnd\":\"2099-06-16\",
  \"city\":\"Тест-Город-$STAMP\",
  \"categories\":[60,67,75],
  \"rounds\":3,\"roundDuration\":3,\"helmets\":false
}"

# ─── 1. Создание под organizer → 201, DRAFT, publishedAt: null ───────────────
CODE=$(post POST /tournaments "$ORG1_TOKEN" "$VALID_BODY")
record "01 POST /tournaments organizer → 201" "$CODE" "201"
TID=$(json '["id"]')
record "01 status DRAFT" "$(json '["status"]')" "DRAFT"
record "01 publishedAt is null" "$(json '["publishedAt"]')" "None"

# ─── 2. GET /mine — черновик виден ───────────────────────────────────────────
post GET /tournaments/mine "$ORG1_TOKEN" >/dev/null
SEEN_IN_MINE=$(json "['items'][0]['id'] if d['items'] else ''")
record "02 GET /mine содержит DRAFT" "$SEEN_IN_MINE" "$TID"

# ─── 3. GET /public/:id — черновик НЕ виден (404) ────────────────────────────
CODE=$(post GET "/tournaments/public/$TID" "")
record "03 GET /public/:id DRAFT → 404" "$CODE" "404"

# ─── 4. Чужой organizer на GET /:id → 404 ────────────────────────────────────
CODE=$(post GET "/tournaments/$TID" "$ORG2_TOKEN")
record "04 чужой GET /:id → 404" "$CODE" "404"

# ─── 5. PATCH чужого → 404 ───────────────────────────────────────────────────
CODE=$(post PATCH "/tournaments/$TID" "$ORG2_TOKEN" '{"name":"hijack"}')
record "05 чужой PATCH → 404" "$CODE" "404"

# ─── 6. publish без обязательных полей → 409 ────────────────────────────────
# Создание уже валидирует поля; мы создаём DRAFT с пустыми категориями через
# сервисный путь невозможно (DTO требует ArrayMinSize=1). Поэтому смоделируем
# через PATCH одного поля (categories[]) → DTO позволит; затем publish ждёт
# непустой массив. Но валидатор массива тоже сработает в PATCH. Альтернатива:
# проверим, что create с categories=[] действительно даёт 400 (это покрывает
# идею «обязательное поле»). Реальный 409 publish-проверки покрывается, если
# вручную сделать невалидное состояние; в текущей схеме оно недостижимо.
CODE=$(post POST /tournaments "$ORG1_TOKEN" "{\"name\":\"X\",\"type\":\"REGIONAL\",\"level\":\"AMATEUR\",\"dateStart\":\"2099-09-10\",\"dateEnd\":\"2099-09-11\",\"city\":\"Сочи\",\"categories\":[],\"rounds\":3,\"roundDuration\":3,\"helmets\":false}")
record "06 create с пустыми categories → 400" "$CODE" "400"

# ─── 7. publish валидного → 200, publishedAt заполнен ────────────────────────
CODE=$(post POST "/tournaments/$TID/publish" "$ORG1_TOKEN")
record "07 publish → 200" "$CODE" "200"
record "07 status PUBLISHED" "$(json '["status"]')" "PUBLISHED"
PUBAT=$(json '["publishedAt"]')
[ "$PUBAT" = "None" ] || [ -z "$PUBAT" ] && PUBAT_OK="empty" || PUBAT_OK="set"
record "07 publishedAt заполнен" "$PUBAT_OK" "set"

# ─── 8. GET /public/:id — опубликованный виден с правильной phase ───────────
CODE=$(post GET "/tournaments/public/$TID" "")
record "08 GET /public/:id PUBLISHED → 200" "$CODE" "200"
record "08 phase=OPEN (старт в 2099)" "$(json '["phase"]')" "OPEN"

# ─── 9. GET /public без токена → 200 ─────────────────────────────────────────
CODE=$(post GET /tournaments/public "")
record "09 /public без токена → 200" "$CODE" "200"

# ─── 10. Trainer пытается POST → 403 ─────────────────────────────────────────
CODE=$(post POST /tournaments "$TR_TOKEN" "$VALID_BODY")
record "10 trainer POST → 403" "$CODE" "403"

# ─── 11. cancel → CANCELLED, в /public нет ───────────────────────────────────
CODE=$(post POST "/tournaments/$TID/cancel" "$ORG1_TOKEN")
record "11 cancel → 200" "$CODE" "200"
record "11 status CANCELLED" "$(json '["status"]')" "CANCELLED"
CODE=$(post GET "/tournaments/public/$TID" "")
record "11 GET /public/:id после cancel → 404" "$CODE" "404"

# ─── 12. DELETE DRAFT → 204; DELETE PUBLISHED → 409 ──────────────────────────
# Создаём ещё один DRAFT, удаляем
post POST /tournaments "$ORG1_TOKEN" "$VALID_BODY" >/dev/null
TID2=$(json '["id"]')
CODE=$(post DELETE "/tournaments/$TID2" "$ORG1_TOKEN")
record "12 DELETE DRAFT → 204" "$CODE" "204"

# Опубликуем третий и попробуем удалить
post POST /tournaments "$ORG1_TOKEN" "$VALID_BODY" >/dev/null
TID3=$(json '["id"]')
post POST "/tournaments/$TID3/publish" "$ORG1_TOKEN" >/dev/null
CODE=$(post DELETE "/tournaments/$TID3" "$ORG1_TOKEN")
record "12 DELETE PUBLISHED → 409" "$CODE" "409"
post POST "/tournaments/$TID3/cancel" "$ORG1_TOKEN" >/dev/null  # cleanup в CANCELLED

# ─── 13. Валидация ──────────────────────────────────────────────────────────
BAD_DATES="{\"name\":\"X\",\"type\":\"REGIONAL\",\"level\":\"AMATEUR\",\"dateStart\":\"2099-09-10\",\"dateEnd\":\"2099-09-01\",\"city\":\"Сочи\",\"categories\":[60],\"rounds\":3,\"roundDuration\":3,\"helmets\":false}"
CODE=$(post POST /tournaments "$ORG1_TOKEN" "$BAD_DATES")
record "13a dateEnd<dateStart → 400" "$CODE" "400"

BAD_ROUNDS="{\"name\":\"X\",\"type\":\"REGIONAL\",\"level\":\"AMATEUR\",\"dateStart\":\"2099-09-10\",\"dateEnd\":\"2099-09-11\",\"city\":\"Сочи\",\"categories\":[60],\"rounds\":0,\"roundDuration\":3,\"helmets\":false}"
CODE=$(post POST /tournaments "$ORG1_TOKEN" "$BAD_ROUNDS")
record "13b rounds:0 → 400" "$CODE" "400"

# ─── Итог ────────────────────────────────────────────────────────────────────
echo
printf '%s\n' "${RESULTS[@]}"
echo
echo "PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
