# Live Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** реализовать локальный single-judge режим Live Scoring (полноэкранный судейский интерфейс с таймером, событиями, 10-балльной системой и финализацией через `setResult`), по спеке `docs/superpowers/specs/2026-05-09-live-scoring-design.md`.

**Architecture:** один новый эндпоинт `GET /matches/:matchId` на существующем `MatchesController` для загрузки данных матча; новая страница `pages/live-scoring/` с reducer-pattern (чистая функция `liveScoringReducer` + хук `useLiveScoring` с `useReducer`/таймером/localStorage); 4 stateless под-компонента UI; финализация переиспользует существующий `setResult`. Никакой новой модели Prisma.

**Tech Stack:** NestJS 10 (бэк), React 19 + react-router 7 (фронт), jest 29 (для bracket-builder/schedule-builder; reducer.spec пишем, но не запускаем — фронт-jest не настроен), Playwright 1.59 с `page.clock` для имитации таймера.

**Repository state:** не git-репозиторий. Шаги «Commit» пропускаются.

**Сервисы для интеграционных тестов:**
- Postgres: `cd boxr-api && docker compose up -d` если ещё не работает.
- API: `cd boxr-api && npm run start:dev` (или `start:prod`).
- Фронт: `cd boxr && npm run dev` или `npm run build`.

---

## Task 1: matches.service — метод getMatchForScoring

**Files:**
- Modify: `boxr-api/src/matches/matches.service.ts`

- [ ] **Step 1: Описать интерфейс ответа**

В `boxr-api/src/matches/matches.service.ts` после существующих типов (`ResultsResponse`) добавить:

```ts
export interface MatchForScoringBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
  rank: string;
}

export interface MatchForScoringResponse {
  match: {
    id: string;
    round: number;
    position: number;
    status: 'PENDING' | 'READY' | 'COMPLETED';
    red: MatchForScoringBoxer | null;
    blue: MatchForScoringBoxer | null;
    ring: number | null;
    scheduledAt: string | null;
  };
  tournament: {
    id: string;
    name: string;
    rounds: number;
    roundDuration: number;
  };
}
```

- [ ] **Step 2: Метод сервиса**

В классе `MatchesService` после `getPublicResults` (или рядом с другими «getter»-методами) добавить:

```ts
async getMatchForScoring(userId: string, matchId: string): Promise<MatchForScoringResponse> {
  const match = await this.prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { id: true, name: true, rounds: true, roundDuration: true, organizerId: true } },
      redBoxer:  { select: { id: true, fullName: true, club: true, rank: true } },
      blueBoxer: { select: { id: true, fullName: true, club: true, rank: true } },
    },
  });
  if (!match) throw new NotFoundException('Матч не найден');
  if (match.tournament.organizerId !== userId) {
    throw new ForbiddenException('Доступ запрещён');
  }
  if (match.status !== MatchStatus.READY) {
    throw new UnprocessableEntityException('Матч недоступен для судейства');
  }
  return {
    match: {
      id: match.id,
      round: match.round,
      position: match.position,
      status: match.status,
      red: match.redBoxer && {
        boxerId: match.redBoxer.id,
        fullName: match.redBoxer.fullName,
        club: match.redBoxer.club,
        rank: match.redBoxer.rank,
      },
      blue: match.blueBoxer && {
        boxerId: match.blueBoxer.id,
        fullName: match.blueBoxer.fullName,
        club: match.blueBoxer.club,
        rank: match.blueBoxer.rank,
      },
      ring: match.ring,
      scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
    },
    tournament: {
      id: match.tournament.id,
      name: match.tournament.name,
      rounds: match.tournament.rounds,
      roundDuration: match.tournament.roundDuration,
    },
  };
}
```

- [ ] **Step 3: Сборка**

```bash
cd /Users/andreisidorcenko/diplom/boxr-api && npm run build
```

Expected: clean.

---

## Task 2: matches.controller — GET /matches/:matchId

**Files:**
- Modify: `boxr-api/src/matches/matches.controller.ts`

- [ ] **Step 1: Добавить эндпоинт**

В `boxr-api/src/matches/matches.controller.ts` в класс `MatchesController` (рядом с другими `Get`-эндпоинтами на матчах) добавить:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@Get('matches/:matchId')
getMatchForScoring(
  @CurrentUser() user: AuthUser,
  @Param('matchId', new ParseUUIDPipe()) matchId: string,
) {
  return this.service.getMatchForScoring(user.id, matchId);
}
```

Импорты `Get`, `UseGuards`, `Roles`, `JwtAuthGuard`, `RolesGuard`, `Role`, `CurrentUser`, `AuthUser`, `Param`, `ParseUUIDPipe` уже есть в файле — добавлять не нужно.

- [ ] **Step 2: Сборка**

```bash
cd /Users/andreisidorcenko/diplom/boxr-api && npm run build
```

Expected: clean. Локальная проверка маршрута через старт API + curl уже не требуется (smoke в Task 3 покроет).

---

## Task 3: bash smoke scripts/test-scoring-endpoint.sh

**Files:**
- Create: `boxr-api/scripts/test-scoring-endpoint.sh`

- [ ] **Step 1: Создать скрипт**

```bash
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
```

- [ ] **Step 2: Сделать исполняемым**

```bash
chmod +x /Users/andreisidorcenko/diplom/boxr-api/scripts/test-scoring-endpoint.sh
```

- [ ] **Step 3: Запустить smoke**

API должен работать. Запустить:

```bash
cd /Users/andreisidorcenko/diplom/boxr-api && ./scripts/test-scoring-endpoint.sh
```

Expected: `PASS=7 FAIL=0`, exit 0.

Если упадёт `PENDING_ID` (финал может оказаться по индексу не 2, а позже — зависит от порядка матчей в категории) — поправь индекс по логам или используй фильтр в python.

---

## Task 4: Frontend — типы и matchesApi.getMatchForScoring

**Files:**
- Modify: `boxr/src/shared/types/index.ts`
- Modify: `boxr/src/shared/api/matches.ts`

- [ ] **Step 1: Добавить типы**

В `boxr/src/shared/types/index.ts` дописать в конец:

```ts
export interface MatchForScoringBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
  rank: BoxerRank;
}

export interface MatchForScoring {
  match: {
    id: string;
    round: number;
    position: number;
    status: MatchStatus;
    red: MatchForScoringBoxer | null;
    blue: MatchForScoringBoxer | null;
    ring: number | null;
    scheduledAt: string | null;
  };
  tournament: {
    id: string;
    name: string;
    rounds: number;
    roundDuration: number;
  };
}
```

- [ ] **Step 2: Добавить метод в matchesApi**

В `boxr/src/shared/api/matches.ts` в импортах из `../types` добавить `MatchForScoring` (рядом с `Bracket, Results, ...`).

После существующих `Api*` интерфейсов добавить:

```ts
type ApiMatchForScoring = {
  match: {
    id: string;
    round: number;
    position: number;
    status: 'PENDING' | 'READY' | 'COMPLETED';
    red: { boxerId: string; fullName: string; club: string | null; rank: string } | null;
    blue: { boxerId: string; fullName: string; club: string | null; rank: string } | null;
    ring: number | null;
    scheduledAt: string | null;
  };
  tournament: { id: string; name: string; rounds: number; roundDuration: number };
};

const toMatchForScoring = (api: ApiMatchForScoring): MatchForScoring => ({
  match: {
    id: api.match.id,
    round: api.match.round,
    position: api.match.position,
    status: api.match.status.toLowerCase() as MatchForScoring['match']['status'],
    red: api.match.red && {
      boxerId: api.match.red.boxerId,
      fullName: api.match.red.fullName,
      club: api.match.red.club,
      rank: api.match.red.rank.toLowerCase() as MatchForScoringBoxer['rank'],
    },
    blue: api.match.blue && {
      boxerId: api.match.blue.boxerId,
      fullName: api.match.blue.fullName,
      club: api.match.blue.club,
      rank: api.match.blue.rank.toLowerCase() as MatchForScoringBoxer['rank'],
    },
    ring: api.match.ring,
    scheduledAt: api.match.scheduledAt,
  },
  tournament: api.tournament,
});
```

И в объект `matchesApi` добавить новый метод (рядом с `setSchedule`):

```ts
getMatchForScoring: (matchId: string) =>
  request<ApiMatchForScoring>(`/matches/${matchId}`).then(toMatchForScoring),
```

Импорт `MatchForScoringBoxer` в типы `matches.ts` — добавить рядом с `MatchForScoring` (`type {... MatchForScoringBoxer ...}`).

- [ ] **Step 3: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 5: live-scoring — model/types.ts + reducer.ts

**Files:**
- Create: `boxr/src/pages/live-scoring/model/types.ts`
- Create: `boxr/src/pages/live-scoring/model/reducer.ts`

- [ ] **Step 1: types.ts**

```ts
// boxr/src/pages/live-scoring/model/types.ts
export type FightState = 'prefight' | 'active' | 'break' | 'ended';

export type ScoringEventType = 'remark' | 'warning' | 'knockdown' | 'stop';
export type Corner = 'red' | 'blue';

export interface ScoringEvent {
  id: string;
  time: string;       // "MM:SS" от начала текущего раунда
  type: ScoringEventType;
  corner: Corner;
  round: number;
}

export interface LiveScoringState {
  fightState: FightState;
  round: number;
  time: number;       // секунд осталось в текущем раунде/перерыве
  isRunning: boolean;
  redScore: number;
  blueScore: number;
  events: ScoringEvent[];
}

export type LiveScoringAction =
  | { type: 'START_FIGHT' }
  | { type: 'TICK' }
  | { type: 'TOGGLE_TIMER' }
  | { type: 'START_ROUND' }
  | { type: 'ADD_EVENT'; eventType: ScoringEventType; corner: Corner }
  | { type: 'RESET' };

export interface ReducerParams {
  rounds: number;
  roundDurationSec: number;
  breakSec: number;     // 60
  startScore: number;   // 10
  minScore: number;     // 7
}

export function initialState(params: ReducerParams): LiveScoringState {
  return {
    fightState: 'prefight',
    round: 1,
    time: params.roundDurationSec,
    isRunning: false,
    redScore: params.startScore,
    blueScore: params.startScore,
    events: [],
  };
}

export const DEFAULT_PARAMS: Omit<ReducerParams, 'rounds' | 'roundDurationSec'> = {
  breakSec: 60,
  startScore: 10,
  minScore: 7,
};
```

- [ ] **Step 2: reducer.ts**

```ts
// boxr/src/pages/live-scoring/model/reducer.ts
import {
  initialState,
  type LiveScoringAction,
  type LiveScoringState,
  type ReducerParams,
  type ScoringEvent,
} from './types';

export function liveScoringReducer(
  state: LiveScoringState,
  action: LiveScoringAction,
  params: ReducerParams,
): LiveScoringState {
  switch (action.type) {
    case 'START_FIGHT':
      if (state.fightState !== 'prefight') return state;
      return { ...state, fightState: 'active', time: params.roundDurationSec, isRunning: true };

    case 'TOGGLE_TIMER':
      if (state.fightState === 'ended') return state;
      return { ...state, isRunning: !state.isRunning };

    case 'START_ROUND':
      if (state.fightState !== 'break') return state;
      return {
        ...state,
        fightState: 'active',
        round: state.round + 1,
        time: params.roundDurationSec,
        isRunning: true,
      };

    case 'TICK': {
      if (!state.isRunning || state.fightState === 'ended') return state;
      if (state.time > 1) {
        return { ...state, time: state.time - 1 };
      }
      // time достиг 0
      if (state.fightState === 'active') {
        if (state.round < params.rounds) {
          return { ...state, fightState: 'break', time: params.breakSec, isRunning: true };
        }
        return { ...state, fightState: 'ended', time: 0, isRunning: false };
      }
      if (state.fightState === 'break') {
        // конец перерыва — ждём ручного START_ROUND
        return { ...state, time: 0, isRunning: false };
      }
      return state;
    }

    case 'ADD_EVENT': {
      const elapsedSec = params.roundDurationSec - state.time;
      const minutes = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const seconds = String(elapsedSec % 60).padStart(2, '0');
      const event: ScoringEvent = {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: `${minutes}:${seconds}`,
        type: action.eventType,
        corner: action.corner,
        round: state.round,
      };
      let { redScore, blueScore } = state;
      if (action.eventType === 'warning' || action.eventType === 'knockdown') {
        if (action.corner === 'red') {
          redScore = Math.max(params.minScore, redScore - 1);
        } else {
          blueScore = Math.max(params.minScore, blueScore - 1);
        }
      }
      let next = { ...state, events: [event, ...state.events], redScore, blueScore };
      if (action.eventType === 'stop') {
        next = { ...next, fightState: 'ended', isRunning: false };
      }
      return next;
    }

    case 'RESET':
      return initialState(params);

    default:
      return state;
  }
}
```

- [ ] **Step 3: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 6: live-scoring — reducer.spec.ts (юнит-тесты, не запускаются в CI)

**Files:**
- Create: `boxr/src/pages/live-scoring/model/reducer.spec.ts`

Тесты пишем для будущей запускаемости, но в проекте фронт-jest сейчас не настроен — это явный техдолг. Файл не подключён к pipeline.

- [ ] **Step 1: spec файл**

```ts
// boxr/src/pages/live-scoring/model/reducer.spec.ts
import { liveScoringReducer } from './reducer';
import { initialState, type LiveScoringState, type ReducerParams } from './types';

const params: ReducerParams = {
  rounds: 3,
  roundDurationSec: 180,
  breakSec: 60,
  startScore: 10,
  minScore: 7,
};

describe('liveScoringReducer', () => {
  let s: LiveScoringState;
  beforeEach(() => { s = initialState(params); });

  it('START_FIGHT из prefight → active, время = roundDurationSec, таймер идёт', () => {
    const next = liveScoringReducer(s, { type: 'START_FIGHT' }, params);
    expect(next.fightState).toBe('active');
    expect(next.time).toBe(180);
    expect(next.isRunning).toBe(true);
  });

  it('TICK уменьшает время на 1', () => {
    s = { ...s, fightState: 'active', isRunning: true, time: 100 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.time).toBe(99);
  });

  it('TICK при времени 1 в active с round < rounds → break, time = breakSec', () => {
    s = { ...s, fightState: 'active', isRunning: true, round: 1, time: 1 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.fightState).toBe('break');
    expect(next.time).toBe(60);
    expect(next.isRunning).toBe(true);
  });

  it('TICK при времени 1 в active с последним раундом → ended', () => {
    s = { ...s, fightState: 'active', isRunning: true, round: 3, time: 1 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.fightState).toBe('ended');
    expect(next.isRunning).toBe(false);
  });

  it('TICK при времени 1 в break → останавливает таймер, ждёт START_ROUND', () => {
    s = { ...s, fightState: 'break', isRunning: true, time: 1 };
    const next = liveScoringReducer(s, { type: 'TICK' }, params);
    expect(next.fightState).toBe('break');
    expect(next.isRunning).toBe(false);
  });

  it('START_ROUND из break → active, round + 1, time = roundDurationSec', () => {
    s = { ...s, fightState: 'break', round: 1, time: 0, isRunning: false };
    const next = liveScoringReducer(s, { type: 'START_ROUND' }, params);
    expect(next.fightState).toBe('active');
    expect(next.round).toBe(2);
    expect(next.time).toBe(180);
    expect(next.isRunning).toBe(true);
  });

  it('TOGGLE_TIMER инвертирует isRunning', () => {
    s = { ...s, fightState: 'active', isRunning: true };
    const next = liveScoringReducer(s, { type: 'TOGGLE_TIMER' }, params);
    expect(next.isRunning).toBe(false);
    const back = liveScoringReducer(next, { type: 'TOGGLE_TIMER' }, params);
    expect(back.isRunning).toBe(true);
  });

  it('ADD_EVENT warning red уменьшает redScore на 1, добавляет event', () => {
    s = { ...s, fightState: 'active', time: 150 };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'warning', corner: 'red' }, params);
    expect(next.redScore).toBe(9);
    expect(next.events).toHaveLength(1);
    expect(next.events[0].type).toBe('warning');
    expect(next.events[0].corner).toBe('red');
    expect(next.events[0].time).toBe('00:30'); // 180 - 150 = 30 секунд
  });

  it('ADD_EVENT warning red 4 раза не уводит ниже minScore', () => {
    s = { ...s, fightState: 'active' };
    let cur = s;
    for (let i = 0; i < 4; i++) {
      cur = liveScoringReducer(cur, { type: 'ADD_EVENT', eventType: 'warning', corner: 'red' }, params);
    }
    expect(cur.redScore).toBe(7);
  });

  it('ADD_EVENT remark не меняет score', () => {
    s = { ...s, fightState: 'active' };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'remark', corner: 'red' }, params);
    expect(next.redScore).toBe(10);
    expect(next.events).toHaveLength(1);
  });

  it('ADD_EVENT stop → ended, isRunning=false', () => {
    s = { ...s, fightState: 'active', isRunning: true };
    const next = liveScoringReducer(s, { type: 'ADD_EVENT', eventType: 'stop', corner: 'red' }, params);
    expect(next.fightState).toBe('ended');
    expect(next.isRunning).toBe(false);
  });

  it('RESET возвращает в initialState', () => {
    s = { ...s, fightState: 'active', round: 2, time: 100, redScore: 8, events: [] };
    const next = liveScoringReducer(s, { type: 'RESET' }, params);
    expect(next).toEqual(initialState(params));
  });

  it('инвариант: scores ∈ [minScore, startScore] после любого ADD_EVENT', () => {
    let cur = { ...s, fightState: 'active' as const };
    for (let i = 0; i < 10; i++) {
      cur = liveScoringReducer(cur, { type: 'ADD_EVENT', eventType: 'warning', corner: 'red' }, params);
      cur = liveScoringReducer(cur, { type: 'ADD_EVENT', eventType: 'knockdown', corner: 'blue' }, params);
    }
    expect(cur.redScore).toBeGreaterThanOrEqual(7);
    expect(cur.redScore).toBeLessThanOrEqual(10);
    expect(cur.blueScore).toBeGreaterThanOrEqual(7);
    expect(cur.blueScore).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: tsc-проверка (компиляция как минимум)**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```

Тесты не запускаются (нет vitest/jest), но файл должен компилироваться. Если tsc ругается на `describe`/`it`/`expect` — это ожидаемо без `@types/jest`. В этом случае добавь в начало файла:

```ts
// @ts-nocheck — фронт-jest не настроен; файл готов к запуску при подключении vitest
```

Это явный техдолг, описанный в спеке.

---

## Task 7: live-scoring — use-live-scoring.ts (хук)

**Files:**
- Create: `boxr/src/pages/live-scoring/model/use-live-scoring.ts`

- [ ] **Step 1: Хук + helpers для localStorage**

```ts
// boxr/src/pages/live-scoring/model/use-live-scoring.ts
import { useEffect, useReducer } from 'react';
import { liveScoringReducer } from './reducer';
import {
  initialState,
  type LiveScoringAction,
  type LiveScoringState,
  type ReducerParams,
} from './types';

const storageKey = (matchId: string) => `boxr.scoring.${matchId}`;

function isValidState(value: unknown): value is LiveScoringState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.fightState === 'string' &&
    typeof s.round === 'number' &&
    typeof s.time === 'number' &&
    typeof s.isRunning === 'boolean' &&
    typeof s.redScore === 'number' &&
    typeof s.blueScore === 'number' &&
    Array.isArray(s.events)
  );
}

export function loadFromStorage(matchId: string): LiveScoringState | null {
  try {
    const raw = localStorage.getItem(storageKey(matchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveToStorage(matchId: string, state: LiveScoringState): void {
  try {
    localStorage.setItem(storageKey(matchId), JSON.stringify(state));
  } catch {
    /* quota exceeded — игнорируем */
  }
}

export function clearStorage(matchId: string): void {
  try {
    localStorage.removeItem(storageKey(matchId));
  } catch {
    /* пустим */
  }
}

export function useLiveScoring(matchId: string, params: ReducerParams) {
  const [state, dispatch] = useReducer<
    (s: LiveScoringState, a: LiveScoringAction) => LiveScoringState,
    null
  >(
    (s, a) => liveScoringReducer(s, a, params),
    null,
    () => loadFromStorage(matchId) ?? initialState(params),
  );

  useEffect(() => {
    saveToStorage(matchId, state);
  }, [matchId, state]);

  useEffect(() => {
    if (!state.isRunning || state.fightState === 'ended') return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.isRunning, state.fightState]);

  return { state, dispatch };
}
```

- [ ] **Step 2: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 8: live-scoring/ui — CornerPanel + CenterControls

**Files:**
- Create: `boxr/src/pages/live-scoring/ui/CornerPanel.tsx`
- Create: `boxr/src/pages/live-scoring/ui/CenterControls.tsx`

- [ ] **Step 1: CornerPanel.tsx**

```tsx
// boxr/src/pages/live-scoring/ui/CornerPanel.tsx
import type { Corner } from '../model/types';
import type { MatchForScoringBoxer } from '@/shared/types';

interface Props {
  side: Corner;
  boxer: MatchForScoringBoxer | null;
  score: number;
  startScore: number;
}

const COLORS = {
  red:  { stripe: 'rgba(178,58,47,0.6)', label: 'var(--ring-600)', mark: '●' },
  blue: { stripe: 'rgba(59,130,246,0.6)', label: '#3b82f6',          mark: '●' },
};

export const CornerPanel = ({ side, boxer, score, startScore }: Props) => {
  const c = COLORS[side];
  const align = side === 'red' ? 'flex-start' : 'flex-end';
  const textAlign = side === 'red' ? ('left' as const) : ('right' as const);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 32px',
        alignItems: align,
        ...(side === 'red'
          ? { borderRight: `4px solid ${c.stripe}` }
          : { borderLeft: `4px solid ${c.stripe}` }),
      }}
    >
      <div
        style={{
          color: c.label,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.15em',
          marginBottom: 8,
        }}
      >
        {side === 'red' ? `${c.mark} КРАСНЫЙ УГОЛ` : `СИНИЙ УГОЛ ${c.mark}`}
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3.5vw, 52px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: 6,
          textAlign,
        }}
      >
        {boxer?.fullName ?? '—'}
      </h2>
      <div
        style={{
          color: 'rgba(242,238,229,0.4)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          marginBottom: 32,
          textAlign,
        }}
      >
        {boxer ? `${boxer.club ?? '—'} · ${boxer.rank.toUpperCase()}` : '—'}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(80px, 12vw, 160px)',
          fontWeight: 300,
          lineHeight: 1,
          color: score < startScore ? 'var(--ring-600)' : 'var(--ink-dark-text)',
          letterSpacing: '-0.04em',
          textAlign,
        }}
      >
        {score}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: CenterControls.tsx**

```tsx
// boxr/src/pages/live-scoring/ui/CenterControls.tsx
import type { LiveScoringState, LiveScoringAction } from '../model/types';

interface Props {
  state: LiveScoringState;
  dispatch: (a: LiveScoringAction) => void;
  totalRounds: number;
}

const formatTime = (s: number): string => {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
};

export const CenterControls = ({ state, dispatch, totalRounds }: Props) => {
  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'var(--ink-dark-surface)',
        borderLeft: '1px solid rgba(242,238,229,0.08)',
        borderRight: '1px solid rgba(242,238,229,0.08)',
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(40px,6vw,72px)',
          fontWeight: 300,
          color: state.time < 30 ? 'var(--ring-600)' : 'var(--ink-dark-text)',
          letterSpacing: '-0.02em',
          transition: 'color 0.5s',
        }}
      >
        {formatTime(state.time)}
      </div>

      {state.fightState === 'prefight' && (
        <button
          onClick={() => dispatch({ type: 'START_FIGHT' })}
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'var(--ring-600)',
            border: 'none',
            cursor: 'pointer',
            color: 'white',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            letterSpacing: '0.08em',
          }}
        >
          СТАРТ
        </button>
      )}

      {state.fightState === 'active' && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_TIMER' })}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: state.isRunning ? 'rgba(242,238,229,0.1)' : 'var(--ring-600)',
            border: '1px solid rgba(242,238,229,0.08)',
            cursor: 'pointer',
            color: 'var(--ink-dark-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          {state.isRunning ? 'ПАУЗА' : 'СТАРТ'}
        </button>
      )}

      {state.fightState === 'break' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              color: 'rgba(242,238,229,0.4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}
          >
            ПЕРЕРЫВ
          </div>
          <button
            onClick={() => dispatch({ type: 'START_ROUND' })}
            style={{
              padding: '12px 24px',
              background: 'var(--ring-600)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            СЛЕД. РАУНД
          </button>
        </div>
      )}

      {state.fightState === 'ended' && (
        <div
          style={{
            color: 'rgba(242,238,229,0.4)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
          }}
        >
          БОЙ ОКОНЧЕН
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'rgba(242,238,229,0.4)',
          letterSpacing: '0.08em',
        }}
      >
        РАУНД {state.round} / {totalRounds}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 9: live-scoring/ui — EventActionsPanel

**Files:**
- Create: `boxr/src/pages/live-scoring/ui/EventActionsPanel.tsx`

- [ ] **Step 1: EventActionsPanel.tsx**

```tsx
// boxr/src/pages/live-scoring/ui/EventActionsPanel.tsx
import type { Corner, ScoringEvent, ScoringEventType, LiveScoringAction } from '../model/types';

interface Props {
  events: ScoringEvent[];
  dispatch: (a: LiveScoringAction) => void;
  disabled: boolean;     // блокировать в prefight/ended
}

const ACTIONS: Array<{ id: ScoringEventType; label: string; sub: string }> = [
  { id: 'remark',    label: 'Замечание',    sub: 'Малое нарушение' },
  { id: 'warning',   label: 'Предупреждение', sub: '−1 балл' },
  { id: 'knockdown', label: 'Нокдаун',      sub: '−1 балл' },
  { id: 'stop',      label: 'Стоп бой',     sub: 'RSC / TKO' },
];

const cornerStyles = {
  red:  { bg: 'rgba(178,58,47,0.15)', border: 'rgba(178,58,47,0.3)', mark: '🔴 КР' },
  blue: { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.2)', mark: '🔵 СИ' },
};

export const EventActionsPanel = ({ events, dispatch, disabled }: Props) => {
  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(242,238,229,0.08)',
        background: 'var(--ink-dark-surface)',
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {ACTIONS.map((action) => (
          <div key={action.id} style={{ display: 'flex', gap: 6 }}>
            {(['red', 'blue'] as const).map((corner) => {
              const cs = cornerStyles[corner];
              return (
                <button
                  key={corner}
                  disabled={disabled}
                  onClick={() => dispatch({ type: 'ADD_EVENT', eventType: action.id, corner })}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    background: cs.bg,
                    border: `1px solid ${cs.border}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    color: 'var(--ink-dark-text)',
                    textAlign: 'center',
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 500 }}>{action.label}</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'rgba(242,238,229,0.4)',
                      marginTop: 2,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {cs.mark}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', minHeight: 28 }}>
        {events.slice(0, 5).map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexShrink: 0,
              padding: '4px 12px',
              background: 'rgba(242,238,229,0.05)',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(242,238,229,0.4)' }}>
              Р{e.round} {e.time}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-dark-text)' }}>
              {labelForEvent(e.type)} — {e.corner === 'red' ? '🔴' : '🔵'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

function labelForEvent(t: ScoringEventType): string {
  switch (t) {
    case 'remark':    return 'Замечание';
    case 'warning':   return 'Предупреждение';
    case 'knockdown': return 'Нокдаун';
    case 'stop':      return 'Стоп бой';
  }
}
```

- [ ] **Step 2: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 10: live-scoring/ui — EndFightPanel

**Files:**
- Create: `boxr/src/pages/live-scoring/ui/EndFightPanel.tsx`

- [ ] **Step 1: EndFightPanel.tsx**

```tsx
// boxr/src/pages/live-scoring/ui/EndFightPanel.tsx
import { useState } from 'react';
import type { LiveScoringState } from '../model/types';
import type { MatchForScoring, MatchOutcome } from '@/shared/types';
import { matchesApi, ApiError } from '@/shared/api';

interface Props {
  state: LiveScoringState;
  match: MatchForScoring;
  onFinished: (tournamentId: string) => void;
}

const OUTCOMES: Array<{ value: MatchOutcome; label: string }> = [
  { value: 'wp',  label: 'WP — по очкам' },
  { value: 'ko',  label: 'KO — нокаут' },
  { value: 'rsc', label: 'RSC — рефери остановил' },
  { value: 'dsq', label: 'DSQ — дисквалификация' },
  { value: 'wo',  label: 'WO — неявка / отказ' },
];

const requiresEndRound = (o: MatchOutcome) => o === 'ko' || o === 'rsc';

export const EndFightPanel = ({ state, match, onFinished }: Props) => {
  const stoppedByEvent = state.events.some((e) => e.type === 'stop');
  const [outcome, setOutcome] = useState<MatchOutcome>(stoppedByEvent ? 'rsc' : 'wp');
  const [winner, setWinner] = useState<'red' | 'blue'>(
    state.redScore >= state.blueScore ? 'red' : 'blue',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tied = state.redScore === state.blueScore && outcome === 'wp';

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await matchesApi.setResult(match.match.id, {
        winner,
        outcome,
        ...(requiresEndRound(outcome) ? { endRound: state.round } : {}),
      });
      onFinished(match.tournament.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
      setSubmitting(false);
    }
  };

  const cornerBtn = (side: 'red' | 'blue', name: string) => (
    <button
      key={side}
      type="button"
      onClick={() => setWinner(side)}
      disabled={submitting}
      style={{
        flex: 1,
        padding: '14px 16px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${winner === side
          ? (side === 'red' ? 'var(--ring-600)' : '#3b82f6')
          : 'rgba(242,238,229,0.15)'}`,
        background:
          winner === side
            ? side === 'red'
              ? 'rgba(178,58,47,0.25)'
              : 'rgba(59,130,246,0.20)'
            : 'transparent',
        color: 'var(--ink-dark-text)',
        cursor: submitting ? 'not-allowed' : 'pointer',
        fontWeight: 600,
      }}
    >
      {side === 'red' ? '🔴' : '🔵'} {name}
    </button>
  );

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(242,238,229,0.08)',
        background: 'var(--ink-dark-surface)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            color: 'var(--ink-dark-text)',
            minWidth: 220,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(242,238,229,0.4)' }}>
            ИСХОД
          </span>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as MatchOutcome)}
            disabled={submitting}
            style={{
              padding: 8,
              background: 'rgba(242,238,229,0.05)',
              border: '1px solid rgba(242,238,229,0.15)',
              color: 'var(--ink-dark-text)',
            }}
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value} style={{ color: '#000' }}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 240 }}>
          {cornerBtn('red',  match.match.red?.fullName  ?? '—')}
          {cornerBtn('blue', match.match.blue?.fullName ?? '—')}
        </div>
      </div>

      {tied && (
        <div style={{ color: 'var(--warning)', fontSize: 13 }}>
          ⚠️ Очки равны — выберите победителя вручную
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          style={{
            padding: '12px 28px',
            background: 'var(--ring-600)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'white',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.08em',
          }}
        >
          {submitting ? 'СОХРАНЯЕМ…' : 'УТВЕРДИТЬ РЕЗУЛЬТАТ'}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 11: live-scoring/ui — LiveScoringPage + index.ts

**Files:**
- Create: `boxr/src/pages/live-scoring/ui/LiveScoringPage.tsx`
- Create: `boxr/src/pages/live-scoring/index.ts`

- [ ] **Step 1: LiveScoringPage.tsx**

```tsx
// boxr/src/pages/live-scoring/ui/LiveScoringPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { matchesApi, ApiError } from '@/shared/api';
import type { MatchForScoring } from '@/shared/types';
import { useLiveScoring, clearStorage } from '../model/use-live-scoring';
import { DEFAULT_PARAMS } from '../model/types';
import { CornerPanel } from './CornerPanel';
import { CenterControls } from './CenterControls';
import { EventActionsPanel } from './EventActionsPanel';
import { EndFightPanel } from './EndFightPanel';

export const LiveScoringPage = () => {
  const { matchId = '' } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchForScoring | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    matchesApi
      .getMatchForScoring(matchId)
      .then(setMatch)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  }, [matchId]);

  if (error) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--ink-dark-bg)',
          color: 'var(--ink-dark-text)',
          gap: 16,
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{error}</h1>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 24px',
            background: 'rgba(242,238,229,0.1)',
            border: '1px solid rgba(242,238,229,0.2)',
            color: 'var(--ink-dark-text)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          ← НАЗАД
        </button>
      </div>
    );
  }
  if (!match) return null;

  return (
    <ActiveLiveScoring
      match={match}
      onFinished={(tournamentId) => {
        clearStorage(matchId);
        navigate(`/tournaments/${tournamentId}`);
      }}
    />
  );
};

interface ActiveProps {
  match: MatchForScoring;
  onFinished: (tournamentId: string) => void;
}

const ActiveLiveScoring = ({ match, onFinished }: ActiveProps) => {
  const params = {
    rounds: match.tournament.rounds,
    roundDurationSec: match.tournament.roundDuration * 60,
    ...DEFAULT_PARAMS,
  };
  const { state, dispatch } = useLiveScoring(match.match.id, params);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ink-dark-bg)',
        color: 'var(--ink-dark-text)',
        fontFamily: 'var(--font-body)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid rgba(242,238,229,0.08)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(242,238,229,0.4)',
            letterSpacing: '0.1em',
          }}
        >
          {match.tournament.name.toUpperCase()}{match.match.ring ? ` · РИНГ ${match.match.ring}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: match.tournament.rounds }, (_, i) => i + 1).map((r) => (
            <div
              key={r}
              style={{
                width: 32,
                height: 6,
                borderRadius: 3,
                background:
                  r < state.round
                    ? 'var(--ring-600)'
                    : r === state.round
                      ? state.isRunning
                        ? 'var(--ring-600)'
                        : 'rgba(178,58,47,0.4)'
                      : 'rgba(242,238,229,0.08)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(242,238,229,0.4)',
            letterSpacing: '0.1em',
          }}
        >
          БОЙ {match.match.position + 1} · РАУНД {state.round}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <CornerPanel side="red"  boxer={match.match.red}  score={state.redScore}  startScore={params.startScore} />
        <CenterControls state={state} dispatch={dispatch} totalRounds={params.rounds} />
        <CornerPanel side="blue" boxer={match.match.blue} score={state.blueScore} startScore={params.startScore} />
      </div>

      {state.fightState === 'ended' ? (
        <EndFightPanel state={state} match={match} onFinished={onFinished} />
      ) : (
        <EventActionsPanel
          events={state.events}
          dispatch={dispatch}
          disabled={state.fightState === 'prefight'}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: index.ts**

```ts
// boxr/src/pages/live-scoring/index.ts
export { LiveScoringPage } from './ui/LiveScoringPage';
```

- [ ] **Step 3: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 12: AppRouter — маршрут /scoring/:matchId

**Files:**
- Modify: `boxr/src/app/router/AppRouter.tsx`

- [ ] **Step 1: Импорт + маршрут**

В `boxr/src/app/router/AppRouter.tsx` добавить импорт:

```ts
import { LiveScoringPage } from '@/pages/live-scoring';
```

В `<Routes>` (перед catch-all `*`) добавить:

```tsx
<Route
  path="/scoring/:matchId"
  element={
    <RequireRole role="organizer">
      <LiveScoringPage />
    </RequireRole>
  }
/>
```

- [ ] **Step 2: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 13: Точки входа — кнопка «Live» в BracketView и ScheduleView

**Files:**
- Modify: `boxr/src/widgets/bracket-view/ui/MatchCard.tsx`
- Modify: `boxr/src/widgets/schedule-view/ui/ScheduleView.tsx`

- [ ] **Step 1: BracketView — кнопка «Live» рядом с MatchCard**

Прочитать `boxr/src/widgets/bracket-view/ui/MatchCard.tsx`. Там карточка целиком — `<button>` с одним `onClick`. Добавить рядом маленькую кнопку-ссылку «Live» (показывается только для `READY` и не в readOnly).

В шапку добавить:
```ts
import { Link } from 'react-router-dom';
```

После основного `<button>` (или внутри обёртки, в зависимости от структуры) добавить условный рендер:

```tsx
{match.status === 'ready' && onClick && (
  <Link
    to={`/scoring/${match.id}`}
    onClick={(e) => e.stopPropagation()}
    style={{
      display: 'inline-block',
      marginTop: 6,
      padding: '4px 10px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.08em',
      background: 'var(--ring-600)',
      color: 'white',
      textDecoration: 'none',
      borderRadius: 'var(--radius-sm)',
    }}
  >
    LIVE →
  </Link>
)}
```

Главный `<button>` на самой карточке (открытие диалога фиксации) — оставляем. Маленькая ссылка «LIVE →» — это вторая точка входа.

Если в текущей структуре карточка уже обёрнута во что-то — добавь ссылку рядом так, чтобы весь блок «карточка + LIVE» оставался в той же flex-колонке `BracketView`.

- [ ] **Step 2: ScheduleView — ссылка «Live» в строке READY-матча**

В `boxr/src/widgets/schedule-view/ui/ScheduleView.tsx` сейчас в строке матча есть колонки: время, бой, ринг, красный, vs, синий, категория. Добавить в самый правый край (после категории) дополнительную ссылку «Live» для READY-матчей в приватном режиме.

В шапку файла добавить:
```ts
import { Link } from 'react-router-dom';
```

Изменить gridTemplateColumns с `'80px 80px 100px 1fr 30px 1fr 100px'` на `'80px 80px 100px 1fr 30px 1fr 100px 60px'` (добавить ещё одну колонку).

В конец каждой строки (после `<MonoLabel>{category} кг</MonoLabel>`) добавить:

```tsx
{!readOnly && match.status === 'ready' ? (
  <Link
    to={`/scoring/${match.id}`}
    style={{
      padding: '4px 10px',
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.08em',
      background: 'var(--ring-600)',
      color: 'white',
      textDecoration: 'none',
      borderRadius: 'var(--radius-sm)',
      textAlign: 'center',
    }}
  >
    LIVE
  </Link>
) : (
  <span />
)}
```

- [ ] **Step 3: tsc**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npx tsc -b --noEmit
```
Expected: clean.

---

## Task 14: Playwright e2e scoring.spec.ts

**Files:**
- Create: `boxr/e2e/scoring.spec.ts`

- [ ] **Step 1: spec файл**

```ts
// boxr/e2e/scoring.spec.ts
import { expect, test } from '@playwright/test';
import {
  approveApplicationViaApi,
  createBoxerViaApi,
  createTournamentViaApi,
  registerUser,
  seedTokens,
  submitApplicationViaApi,
} from './helpers';

test('организатор проводит бой через Live Scoring и фиксирует WP', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');

  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [60],
  });

  // 2 боксёра в категории 60 → 1 матч (финал)
  for (let i = 0; i < 2; i++) {
    const b = await createBoxerViaApi(request, trainer, { fullName: `LS ${i + 1}`, weight: 60 });
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 60);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  const apiPort = process.env.E2E_API_PORT ?? 3000;
  const headers = { Authorization: `Bearer ${organizer.accessToken}` };
  const r = await request.post(
    `http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/bracket`,
    { headers },
  );
  expect(r.ok()).toBeTruthy();
  const bracket = (await r.json()) as {
    categories: Array<{ matches: Array<{ id: string; status: string }> }>;
  };
  const readyMatch = bracket.categories[0].matches.find((m) => m.status === 'READY')!;

  await seedTokens(page, organizer);
  await page.clock.install({ time: new Date('2099-09-01T10:00:00.000Z') });
  await page.goto(`/scoring/${readyMatch.id}`);

  // Проверяем prefight UI
  await expect(page.getByText('LS 1')).toBeVisible();
  await expect(page.getByText('LS 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'СТАРТ' })).toBeVisible();

  // Запускаем бой
  await page.getByRole('button', { name: 'СТАРТ' }).click();

  // Промотать раунд (3 минуты × 3 раунда + 2 перерыва по 1 минуте = ~11 минут)
  await page.clock.fastForward('03:30');     // 1-й раунд + начало break
  // start round 2 руками (если интерфейс ждёт START_ROUND после break)
  const next1 = page.getByRole('button', { name: 'СЛЕД. РАУНД' });
  if (await next1.isVisible({ timeout: 2000 }).catch(() => false)) await next1.click();
  await page.clock.fastForward('03:30');
  const next2 = page.getByRole('button', { name: 'СЛЕД. РАУНД' });
  if (await next2.isVisible({ timeout: 2000 }).catch(() => false)) await next2.click();
  await page.clock.fastForward('03:30');

  // Должен показаться EndFightPanel
  await expect(page.getByRole('button', { name: 'УТВЕРДИТЬ РЕЗУЛЬТАТ' })).toBeVisible({ timeout: 5000 });

  // Утверждаем (по дефолту WP, winner = красный)
  await page.getByRole('button', { name: 'УТВЕРДИТЬ РЕЗУЛЬТАТ' }).click();

  // Редирект на страницу турнира
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournament.id}$`));
});

test('Live Scoring: state восстанавливается из localStorage после reload', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');

  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [60],
  });
  for (let i = 0; i < 2; i++) {
    const b = await createBoxerViaApi(request, trainer, { fullName: `LS-R ${i + 1}`, weight: 60 });
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 60);
    await approveApplicationViaApi(request, organizer, app.id);
  }
  const apiPort = process.env.E2E_API_PORT ?? 3000;
  const headers = { Authorization: `Bearer ${organizer.accessToken}` };
  const r = await request.post(
    `http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/bracket`,
    { headers },
  );
  const bracket = (await r.json()) as {
    categories: Array<{ matches: Array<{ id: string; status: string }> }>;
  };
  const readyMatch = bracket.categories[0].matches.find((m) => m.status === 'READY')!;

  await seedTokens(page, organizer);
  await page.goto(`/scoring/${readyMatch.id}`);
  await page.getByRole('button', { name: 'СТАРТ' }).click();

  // Дать 2 предупреждения красному → счёт 8-10
  // Кнопки имеют текст «Предупреждение» с подписью «🔴 КР» или «🔵 СИ»
  const redWarning = page.getByRole('button', { name: /Предупреждение/ }).filter({ hasText: 'КР' });
  await redWarning.click();
  await redWarning.click();

  await expect(page.getByText('8', { exact: true })).toBeVisible();

  // Перезагрузка страницы
  await page.reload();

  // После перезагрузки 8 должно остаться (восстановление из localStorage)
  await expect(page.getByText('8', { exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Запустить spec**

```bash
cd /Users/andreisidorcenko/diplom/boxr && npm run test:e2e -- scoring.spec.ts
```
Expected: 2/2 PASS.

Если первый тест падает на `СЛЕД. РАУНД` — значит реальный ход таймера через `page.clock.fastForward` не вызывает наши `setInterval`. В этом случае полагайся на то, что `page.clock` патчит `setInterval` (это его функция). Если не работает — переписать тест: вместо ожидания таймера после каждого раунда нажимать кнопку «СТОП БОЙ» красному (это сразу переведёт в `ended`, и `EndFightPanel` появится с дефолтом RSC).

---

## Self-review checklist

После всех 14 задач:

- [ ] `cd boxr-api && npm run build` — clean.
- [ ] `cd boxr-api && ./scripts/test-bracket.sh` — старый smoke не сломан.
- [ ] `cd boxr-api && ./scripts/test-schedule.sh` — старый smoke не сломан.
- [ ] `cd boxr-api && ./scripts/test-scoring-endpoint.sh` — `PASS=7 FAIL=0`.
- [ ] `cd boxr && npx tsc -b --noEmit` — clean.
- [ ] `cd boxr && npm run test:e2e -- bracket.spec.ts schedule.spec.ts scoring.spec.ts` — все тесты PASS.
