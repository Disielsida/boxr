# Live Scoring — дизайн v1

**Дата:** 2026-05-09
**Контекст:** шестая итерация BOXR. Сетка матчей, фиксация результатов и расписание уже работают. Сейчас закрываем последнее звено основного сценария — полноэкранный судейский режим, в котором организатор ведёт бой в реальном времени: запускает таймер, фиксирует события (предупреждения, нокдауны), считает 10-балльную систему, и в финале одним кликом передаёт исход в существующий `setResult`.

В мокапе `index.html` (секция `LiveScoringScreen`, строки 3690-4033) показан полноэкранный тёмный режим с большими цифрами очков, центральным таймером, нижней панелью событий и опциональным AI-оверлеем. Делаем минимальную работающую версию: один судья, локальное состояние, защита от случайной перезагрузки через localStorage. **Multi-judge, AI-судья, голосовой ввод и WebSocket-трансляция — отдельные циклы**.

## Решения, утверждённые в брейнсторминге

| Вопрос | Решение |
|---|---|
| Скоуп цикла | Локальный single-judge режим. Без новой модели в БД, без AI/голоса/realtime/multi-judge |
| Точки входа | Кнопки в `ScheduleView` (приватный режим) и в `BracketView` (на READY-карточке). Маршрут `/scoring/:matchId`, fullscreen, владелец турнира |
| Параметры | Из турнира: `tournament.rounds × tournament.roundDuration` (сек). Перерыв 60 сек (зашит). 10-point must: warning −1, knockdown −1, минимум 7 |
| Завершение боя | Панель «Завершить бой» с выбором `outcome` (WP/KO/RSC/DSQ/WO) → прямой `matchesApi.setResult` → редирект на `/tournaments/:id` (вкладка «Жеребьёвка»). При ничье в WP — выбор winner вручную |
| Recovery | localStorage snapshot ключом `boxr.scoring.${matchId}`, очистка после успешного `setResult` |
| Архитектура | Reducer-pattern: чистая функция `liveScoringReducer(state, action, params)` (jest unit-тесты), хук-обёртка `useLiveScoring(matchId, params)` (useReducer + useEffect для tick + persist), 4 stateless под-компонента UI |

## Non-goals

- **Серверное хранение** пораундовых баллов и событий — отдельный цикл «Протокол боя».
- **WebSocket-трансляция** счёта зрителям.
- **Multi-judge**: несколько судей одновременно.
- **AI-судья**: подсказки во время боя — часть цикла «AI-помощник».
- **Голосовой ввод** событий через Web Speech API.
- **Mobile-адаптив**: режим рассчитан на планшет/десктоп в landscape.
- **Установка таймера руками** перед боем: параметры строго из турнира.
- **Откат отдельных событий** внутри боя: судья может либо `RESET` (полный сброс), либо просто продолжать.
- **vitest на фронте**: остаётся техдолгом, jest-тесты reducer пишем, но в CI не прогоняем.

## Архитектура

Расширение существующих модулей: один новый эндпоинт у `MatchesController` (`GET /matches/:matchId` — отдаёт минимальный набор данных для запуска Live Scoring), новый метод в `matchesApi`, новая страница `pages/live-scoring/`.

**Никакой новой модели Prisma не появляется.** Используем существующую `Match` и существующий `setResult`.

```
boxr-api/src/matches/
├── matches.service.ts          ← + getMatchForScoring
├── matches.controller.ts       ← + GET /matches/:matchId
└── (existing files)

boxr-api/scripts/
└── test-scoring-endpoint.sh    ← новый smoke

boxr/src/
├── shared/
│   ├── api/matches.ts          ← + getMatchForScoring
│   └── types/index.ts          ← + MatchForScoring и подтипы
├── pages/
│   └── live-scoring/           ← новая директория
│       ├── index.ts
│       ├── model/
│       │   ├── types.ts        (FightState, LiveScoringState, ScoringEvent, LiveScoringAction, ReducerParams)
│       │   ├── reducer.ts      (liveScoringReducer — pure function)
│       │   ├── reducer.spec.ts (jest unit-тесты — пишем, но не запускаем в CI)
│       │   └── use-live-scoring.ts  (useReducer + tick + localStorage)
│       └── ui/
│           ├── LiveScoringPage.tsx
│           ├── CornerPanel.tsx
│           ├── CenterControls.tsx
│           ├── EventActionsPanel.tsx
│           └── EndFightPanel.tsx
├── widgets/
│   ├── bracket-view/ui/MatchCard.tsx   ← + кнопка «Live» рядом с «Утвердить»
│   └── schedule-view/ui/ScheduleView.tsx ← + ссылка «Live» в строке READY-матча
├── app/router/AppRouter.tsx    ← + Route /scoring/:matchId
└── e2e/scoring.spec.ts         ← новый
```

## API

### Новый эндпоинт `GET /matches/:matchId`

Минимальный набор данных для Live Scoring. Никакого списка событий, никакой сетки, ничего лишнего — только то, что нужно странице судейства.

```
GET /matches/:matchId      JwtAuthGuard + RolesGuard@ORGANIZER
```

Сервисный метод:

```ts
async getMatchForScoring(userId: string, matchId: string): Promise<MatchForScoringResponse> {
  const match = await this.prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { id: true, name: true, rounds: true, roundDuration: true, organizerId: true } },
      redBoxer:   { select: { id: true, fullName: true, club: true, rank: true } },
      blueBoxer:  { select: { id: true, fullName: true, club: true, rank: true } },
    },
  });
  if (!match) throw new NotFoundException('Матч не найден');
  if (match.tournament.organizerId !== userId) throw new ForbiddenException('Доступ запрещён');
  if (match.status !== MatchStatus.READY) {
    throw new UnprocessableEntityException('Матч недоступен для судейства');
  }
  return {
    match: {
      id: match.id,
      round: match.round,
      position: match.position,
      status: match.status,
      red:  match.redBoxer  ? { boxerId, fullName, club, rank } : null,
      blue: match.blueBoxer ? {...} : null,
      ring: match.ring,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
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

Контроллер:
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

Ошибки:

| Условие | Код | Сообщение |
|---|---|---|
| Матч не найден | 404 | «Матч не найден» |
| Не владелец турнира матча | 403 | стандартный NestJS |
| `status !== READY` | 422 | «Матч недоступен для судейства» |

### Финализация — без новых эндпоинтов

`EndFightPanel` вызывает существующий `matchesApi.setResult(matchId, {winner, outcome, endRound?})`. Все 422-валидации (KO/RSC требует endRound, и т.д.) уже реализованы — переиспользуются как есть.

## Frontend — типы и клиент

### Новые типы в `shared/types/index.ts`

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
    status: 'pending' | 'ready' | 'completed';
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

### Новый метод в `matchesApi`

```ts
getMatchForScoring(matchId: string): Promise<MatchForScoring>
```

С маппером uppercase→lowercase для `match.status` и `boxer.rank`.

## Frontend — страница и логика

### Маршрут

В `boxr/src/app/router/AppRouter.tsx` добавить:
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

`RequireRole` уже есть. Точная проверка ownership делается на сервере при `getMatchForScoring`.

### Reducer и состояние

Файл `model/types.ts`:

```ts
export type FightState = 'prefight' | 'active' | 'break' | 'ended';

export interface ScoringEvent {
  id: string;        // crypto.randomUUID()
  time: string;      // "MM:SS" от начала текущего раунда
  type: 'remark' | 'warning' | 'knockdown' | 'stop';
  corner: 'red' | 'blue';
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
  | { type: 'ADD_EVENT'; eventType: 'remark' | 'warning' | 'knockdown' | 'stop'; corner: 'red' | 'blue' }
  | { type: 'RESET' };

export interface ReducerParams {
  rounds: number;
  roundDurationSec: number;
  breakSec: number;        // 60
  startScore: number;      // 10
  minScore: number;        // 7
}
```

Файл `model/reducer.ts` — чистая функция `liveScoringReducer(state, action, params)`. Поведение на каждый action — описано в брейнсторминге, повторяется в коде дословно.

### Хук `use-live-scoring.ts`

```ts
export function useLiveScoring(matchId: string, params: ReducerParams) {
  const [state, dispatch] = useReducer(
    (s, a) => liveScoringReducer(s, a, params),
    null,
    () => loadFromStorage(matchId, params) ?? initialState(params),
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

const storageKey = (matchId: string) => `boxr.scoring.${matchId}`;
export function loadFromStorage(matchId: string, params: ReducerParams): LiveScoringState | null;
export function saveToStorage(matchId: string, state: LiveScoringState): void;
export function clearStorage(matchId: string): void;
```

### Страница `LiveScoringPage`

Грузит матч через `getMatchForScoring`, показывает `LoadingScreen` или `ErrorScreen`. При успехе монтирует `ActiveLiveScoring` — внутренний компонент, который вызывает `useLiveScoring(matchId, params)` и рендерит layout по мокапу.

Layout:
- **Top bar** (52px): «{tournament.name} · РИНГ {match.ring}» / индикатор раундов / «БОЙ {position+1} · РАУНД {round}».
- **Main area**: 3 flex-колонки — `<CornerPanel side="red" />`, `<CenterControls />`, `<CornerPanel side="blue" />`. Между колонками — узкие красная/синяя бордер-полоски.
- **Bottom panel** (или EndFightPanel при `fightState === 'ended'`): `<EventActionsPanel />` или `<EndFightPanel />`.

Тёмная тема — из мокапа: `dark.bg = 'var(--ink-dark-bg)'`, `dark.surface = 'var(--ink-dark-surface)'`, и т.д. (CSS-переменные уже определены в проекте).

При успешном `setResult` в `EndFightPanel`:
1. `clearStorage(matchId)`.
2. `navigate('/tournaments/' + tournamentId)`. Активная вкладка — `bracket` (по умолчанию открывается info, но фронт `TournamentManagePage` уже умеет читать `?tab=bracket`; если ещё не умеет — добавим параметр `state` или query, фокус на этом не критичен — орг увидит страницу и переключится сам).

### Под-компоненты

Все четыре stateless, принимают `state` + `dispatch`/обработчики:

- **`CornerPanel`** — имя боксёра, метаданные (вес/разряд/клуб), большая цифра очков. Принимает `side: 'red' | 'blue'` и `boxer: MatchForScoringBoxer | null`. Если `boxer === null` — показывает «BYE» (хотя для READY-матча оба слота не должны быть null).
- **`CenterControls`** — таймер (большая моно-цифра MM:SS), кнопка СТАРТ/Пауза/СЛЕД.РАУНД (зависит от `fightState`). Без AI-toggle и voice-toggle (они в non-goals).
- **`EventActionsPanel`** — 4 типа событий × 2 угла (8 кнопок), event log внизу (5 последних). Не показывается при `fightState === 'ended'`.
- **`EndFightPanel`** — показывается при `fightState === 'ended'`. Содержит select для `outcome` (5 опций), две кнопки 🔴/🔵 для winner (с дефолтом по очкам), сообщение «Очки равны» при ничье в WP, кнопку «Утвердить результат». Обрабатывает submit через `matchesApi.setResult`, ловит `ApiError` и показывает inline.

### Точки входа в `Match`-карточки

#### `widgets/bracket-view/ui/MatchCard.tsx`

Сейчас карточка целиком — `<button>` с одним `onClick`. Меняем: для `READY`-матчей карточка получает рядом с собой две маленькие кнопки-иконки: «Утвердить» (открывает существующий диалог через `onClick`) и «Live» (`<Link to={'/scoring/' + match.id}>`). Для других статусов — без кнопок.

#### `widgets/schedule-view/ui/ScheduleView.tsx`

В строке `READY`-матча в правом крае рядом с pill категории — иконка-кнопка «Live» (`<Link>`). Только в `!readOnly` режиме.

## Тесты

### Бэк — bash smoke `scripts/test-scoring-endpoint.sh`

Покрывает новый эндпоинт `GET /matches/:matchId`:
- Регистрация organizer + trainer, создание турнира с 4 одобренными заявками, генерация сетки → 3 матча (2 полуфинала READY + 1 финал PENDING).
- `GET /matches/<readyId>` от owner → 200, проверка структуры (есть `match.red.fullName`, `tournament.rounds`).
- `GET /matches/<readyId>` без токена → 401.
- `GET /matches/<pendingId>` (финал, ещё не подкормлен) → 422 «Матч недоступен».
- Зафиксировать READY-матч → `GET` на него → 422 «Матч недоступен».
- (Опционально) Регистрация второго organizer, попытка `GET /matches/<readyId>` от него → 403.

### Фронт — Jest unit-тесты для reducer

Файл `boxr/src/pages/live-scoring/model/reducer.spec.ts`. Пишем, но **в CI не прогоняем** (фронт-jest не настроен; настройка vitest — отдельный цикл).

Покрытие:
- `START_FIGHT` из `prefight` → `active`, `time = roundDurationSec`, `isRunning = true`.
- `TICK` уменьшает `time`. На `0` в `active` (раунд < rounds) → `break + breakSec`, в `active` (раунд == rounds) → `ended + isRunning=false`, в `break` → `ended` НЕТ, ждёт `START_ROUND`.
- `START_ROUND` из `break` → `round += 1, time = roundDurationSec, fightState = active`.
- `TOGGLE_TIMER` → инвертирует `isRunning`.
- `ADD_EVENT warning red` → `redScore -= 1`, добавляет в `events[]`.
- `ADD_EVENT warning red` ×4 → score доходит до 7 и не идёт ниже.
- `ADD_EVENT remark` → events добавляется, score не меняется.
- `ADD_EVENT stop` → `fightState = ended, isRunning = false`.
- `RESET` → возврат в `initialState(params)`.
- Инварианты: после любого action `redScore`, `blueScore` ∈ `[minScore, startScore]`; `round` ∈ `[1, rounds]`; `time ≥ 0`.

### Фронт — Playwright e2e (`scoring.spec.ts`)

Два сценария:

1. **Полный цикл WP**:
   - Орг создаёт турнир из 2 боксёров (1 матч), генерирует сетку.
   - Идёт по `/scoring/<matchId>`, видит prefight UI с обоими боксёрами и счётом 10-10.
   - Нажимает «СТАРТ», использует `page.clock.fastForward('3:00')` для ускорения раунда.
   - После окончания раунда → `break`. Снова `fastForward('1:00')` → `ended`.
   - Видит `EndFightPanel` с дефолтом WP. Нажимает «Утвердить».
   - Редирект на `/tournaments/:id`. Проверяет что матч `COMPLETED` (открывает вкладку «Жеребьёвка», видит pill «WP» в карточке матча).

2. **Recovery из localStorage**:
   - Создать матч, открыть `/scoring/:id`.
   - Нажать «СТАРТ», нажать «Предупреждение» красному дважды → счёт 8-10.
   - `page.reload()`.
   - Проверить что счёт 8-10 восстановился, raund актуальный, events отображаются в логе.

`page.clock` — стандартный Playwright API для имитации `setInterval`/`Date.now`.

### Что не покрываем тестами

- Mobile-адаптив (вне скоупа).
- AI-overlay (вне скоупа).
- Голос (вне скоупа).
- Multi-judge (вне скоупа).
- Тесты ре-рендера производительности.

## Миграция данных

**Никакой миграции Prisma не требуется.** Все используемые поля уже есть в схеме (`Match.status`, `tournament.rounds`, `tournament.roundDuration`, и т.д.). Для существующих турниров и матчей Live Scoring заработает сразу после деплоя.
