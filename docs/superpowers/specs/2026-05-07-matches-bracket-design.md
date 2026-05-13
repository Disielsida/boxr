# Сетка матчей и фиксация результатов — дизайн v1

**Дата:** 2026-05-07
**Контекст:** четвёртая итерация BOXR. Auth, турниры, боксёры и заявки уже работают. Сейчас закрываем недостающее звено основного сценария: после публикации турнира организатор должен сгенерировать сетку из одобренных заявок, провести бои на бумаге и получить пьедестал.

В мокапе `index.html` показаны четыре вкладки в управлении турниром (Участники, Жеребьёвка, Расписание, Результаты) и отдельный полноэкранный режим Live Scoring. В этом цикле делаем **только Жеребьёвку и Результаты**. Расписание и Live Scoring — отдельными циклами потом.

## Решения, утверждённые в брейншторминге

| Вопрос | Решение |
|---|---|
| Скоуп цикла | Сетка + Результаты. Расписание и Live Scoring — отдельные циклы |
| Алгоритм жеребьёвки | Чистый рандом в пределах категории + bye при нечётном числе. Сидинг по разряду и развод по клубу — будущие итерации |
| Связь со статусом турнира | Генерация сетки → новый статус `IN_PROGRESS`. Заявки замораживаются. Перегенерация разрешена пока нет ни одного зафиксированного не-bye матча |
| Структура дерева | Явная: каждый матч хранит `nextMatchId` + `nextSlot`. Все матчи всех раундов создаются заранее с пустыми боксёрами в поздних раундах |
| Исход боя | `outcome ∈ {KO, WP, RSC, DSQ, WO}`. `endRound` обязателен только для `KO/RSC` |
| Порядок фиксации | Строгий: матч можно фиксировать только в `READY` (оба слота заполнены). Откат — только последнего матча в цепочке |
| Завершение турнира | `IN_PROGRESS → FINISHED` автоматически, когда все финалы во всех категориях `COMPLETED` |
| Доступ | Только организатор-владелец турнира. Привязка судей — отдельная фича |
| Edge cases категорий | 0 участников — категория молча пропускается. 1 участник — `WO`-золото без боя. Полностью пустой турнир — 422 |
| Публичность | Сетка и результаты публичны для турниров `PUBLISHED/IN_PROGRESS/FINISHED` |
| Структура модуля API | Один новый `MatchesModule`, маршруты в стиле `ApplicationsController` (микс nested и плоских) |

## Non-goals

Вне скоупа этого цикла:

- **Расписание боёв** (распределение по дням/времени/рингам) — отдельный цикл.
- **Live Scoring** (пораундовые баллы, таймер, события warning/knockdown, голосовой ввод) — отдельный цикл.
- **AI-помощник**: «AI-объяснение жеребьёвки», умный сидинг по клубу/рангу, AI-судья.
- **Сидинг по разряду** и **развод по клубу** в жеребьёвке.
- **Назначение судей на турнир**: фиксацию делает только организатор.
- **Ничьи** и **бои за 3-е место**: в любительском боксе их нет.
- **Ручная жеребьёвка** (drag-n-drop пар): только автогенерация.
- **Изменение зафиксированных результатов кроме отмены последнего в цепочке**.
- **Live-обновления через WebSocket**: фронт перечитывает сетку после мутаций.
- **Анимация «AI генерирует»** из мокапа — это декоративный фейк, не воспроизводим.

## Архитектура

Расширение `boxr-api`: один новый модуль `MatchesModule`, одна новая таблица `Match`, расширение `TournamentStatus`. На фронте — два новых виджета (`bracket-view`, `results-view`), две новые вкладки в `TournamentManagePage`, новая публичная страница деталей турнира.

```
boxr-api/src/matches/
├── matches.module.ts
├── matches.controller.ts
├── matches.service.ts
├── bracket-builder.ts            (генерация сетки — чистая функция, тестируется отдельно)
└── dto/
    ├── set-result.dto.ts
    └── (response-types)

boxr/src/
├── shared/api/matches.ts         (новый клиент)
├── widgets/
│   ├── bracket-view/             (новый виджет, переиспользуется в управлении и публике)
│   │   ├── index.ts
│   │   └── ui/
│   │       ├── BracketView.tsx
│   │       ├── MatchCard.tsx
│   │       └── MatchResultDialog.tsx
│   └── results-view/             (новый виджет)
│       ├── index.ts
│       └── ui/ResultsView.tsx
├── pages/
│   ├── tournament-manage/        (расширение: 2 новые вкладки + кнопки на info)
│   └── public-tournament/        (новая страница)
│       ├── index.ts
│       └── ui/PublicTournamentPage.tsx
└── app/router/AppRouter.tsx      (новый маршрут /public/tournaments/:id)
```

## Модель данных (Prisma)

### Расширения существующих моделей

```prisma
enum TournamentStatus {
  DRAFT
  PUBLISHED
  IN_PROGRESS    // ← новое
  FINISHED       // ← новое
  CANCELLED
}

model Tournament {
  // ... существующие поля
  matches      Match[]
}

model Boxer {
  // ... существующие поля
  redMatches   Match[]  @relation("redMatches")
  blueMatches  Match[]  @relation("blueMatches")
  wonMatches   Match[]  @relation("wonMatches")
}
```

### Новая модель

```prisma
enum MatchOutcome { KO  WP  RSC  DSQ  WO }
enum MatchSlot    { RED  BLUE }
enum MatchStatus  { PENDING  READY  COMPLETED }

model Match {
  id            String        @id @default(uuid())
  tournamentId  String
  tournament    Tournament    @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  category      Float         // одна из tournament.categories
  round         Int           // 1 = первый раунд, последний = финал
  position      Int           // позиция матча внутри раунда, начиная с 0
  redBoxerId    String?
  redBoxer      Boxer?        @relation("redMatches", fields: [redBoxerId], references: [id], onDelete: Restrict)
  blueBoxerId   String?
  blueBoxer     Boxer?        @relation("blueMatches", fields: [blueBoxerId], references: [id], onDelete: Restrict)
  nextMatchId   String?
  nextMatch     Match?        @relation("MatchProgression", fields: [nextMatchId], references: [id], onDelete: SetNull)
  prevMatches   Match[]       @relation("MatchProgression")
  nextSlot      MatchSlot?
  status        MatchStatus   @default(PENDING)
  winnerId      String?
  winner        Boxer?        @relation("wonMatches", fields: [winnerId], references: [id], onDelete: Restrict)
  outcome       MatchOutcome?
  endRound      Int?          // обязателен только для KO/RSC
  decidedAt     DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@unique([tournamentId, category, round, position])
  @@index([tournamentId, status])
  @@index([nextMatchId])
}
```

### Семантика статусов матча

- `PENDING` — есть пустой слот; зафиксировать результат нельзя.
- `READY` — оба слота заполнены; организатор может фиксировать результат.
- `COMPLETED` — есть `winnerId` и `outcome`; матч закрыт.

`bye`-матч создаётся сразу с одним заполненным слотом, `winnerId = boxerId`, `outcome = WO`, `status = COMPLETED`, и победитель тут же продвигается в `nextMatch`.

### Инварианты

1. Для любого `match.nextMatchId` существует ровно один `nextMatch`, и `match.nextSlot ∈ {RED, BLUE}`.
2. На один `nextMatch` ссылаются не более двух матчей предыдущего раунда, и они занимают разные слоты.
3. Финал категории — единственный матч с `nextMatchId === null` в этой категории.
4. У `COMPLETED`-матча всегда есть `winnerId`, `outcome`, `decidedAt`. У `KO/RSC` — обязательно `endRound`. У остальных — `endRound === null`.
5. У `READY`-матча оба слота заполнены, `winnerId === null`.
6. У `PENDING`-матча хотя бы один слот пуст и `winnerId === null`.

## Алгоритм генерации сетки

Идемпотентная транзакция: либо вся сетка пересоздаётся, либо ничего не меняется.

```
generateBracket(userId, tournamentId):
  tournament = findById(tournamentId)
  assert tournament.organizerId === userId            // 403
  assert tournament.status in {PUBLISHED, IN_PROGRESS} // 422
  if tournament.status === IN_PROGRESS:
    assert no Match where status=COMPLETED && не-bye   // 422
    deleteMany matches where tournamentId=...

  approvedByCategory = group(applications WHERE status=APPROVED, by category)
  assert exists category with len ≥ 1                  // 422 «нет участников вообще»

  for category in tournament.categories:
    boxers = approvedByCategory[category] ?? []
    if len(boxers) === 0: continue
    buildCategoryBracket(tournamentId, category, shuffle(boxers))

  tournament.status = IN_PROGRESS
```

`buildCategoryBracket(tournamentId, category, boxers)`:

```
n = len(boxers)
if n === 1:
  // одиночный финал, золото через WO
  create one match: round=1, position=0, redBoxerId=boxers[0],
                    winnerId=boxers[0], outcome=WO,
                    status=COMPLETED, nextMatchId=null
  return

bracketSize = nextPow2(n)            // 2→2, 3→4, 5→8, 6→8, 8→8, ...
byes        = bracketSize - n
rounds      = log2(bracketSize)

// Создаём пустые матчи всех раундов, связываем next
for r in 1..rounds:
  matchesInRound = bracketSize / 2^r
  for p in 0..matchesInRound - 1:
    matches[r][p] = createMatch(round=r, position=p, status=PENDING)

for r in 1..rounds-1:
  for p in 0..(matches[r].length - 1):
    matches[r][p].nextMatchId = matches[r+1][floor(p/2)].id
    matches[r][p].nextSlot    = (p % 2 === 0) ? RED : BLUE

// Распределяем bye-слоты по сетке. Минимальное требование:
// два bye не оказываются в одной паре первого раунда (иначе слот
// потрачен впустую). Конкретный алгоритм arrangeWithByes — деталь
// реализации, фиксируется в плане. Для n > bracketSize/2 это всегда
// возможно: byes < bracketSize/2 по построению.
seats = arrangeWithByes(boxers, bracketSize)
       // длина = bracketSize, null = bye-слот

for p in 0..(bracketSize/2 - 1):
  m = matches[1][p]
  m.redBoxerId  = seats[2p]
  m.blueBoxerId = seats[2p + 1]
  if m.redBoxerId && m.blueBoxerId:
    m.status = READY
  else if m.redBoxerId || m.blueBoxerId:
    sole = m.redBoxerId ?? m.blueBoxerId
    m.winnerId   = sole
    m.outcome    = WO
    m.status     = COMPLETED
    m.decidedAt  = now()
    propagateWinner(m)
  // else: оба null — невозможно по построению (n ≥ 2 ⇒ byes < bracketSize)
```

### `propagateWinner(match)` — общая для генерации и для `setResult`

```
if match.nextMatchId is null: return  // финал, продвигать некуда
next = findById(match.nextMatchId)
if match.nextSlot === RED:  next.redBoxerId  = match.winnerId
else:                       next.blueBoxerId = match.winnerId
if next.redBoxerId && next.blueBoxerId: next.status = READY
```

`bye` всегда только в первом раунде по построению, поэтому `propagateWinner` никогда не запускает каскадный `WO` в более позднем раунде.

### Граничные случаи (на тестах)

- 1 участник → один `COMPLETED`-матч-финал с `WO`.
- 2 участника → один матч-финал, оба слота, `READY`.
- 3 участника → 4-местная сетка: 1 матч 1/2 + 1 bye-матч + 1 финал.
- 5 участников → 8-местная: 3 bye-матча в первом раунде + 4 матча в полуфинале (один из которых получает двух bye-победителей и сразу `READY`).
- Категория с 0 участников → ни одного матча в этой категории.

## API

`MatchesModule` импортируется в `app.module.ts` рядом с `ApplicationsModule`. Глобальный префикс `api/v1` остаётся.

```
POST   /tournaments/:id/bracket           JwtAuthGuard + RolesGuard@ORGANIZER
GET    /tournaments/:id/bracket           JwtAuthGuard + RolesGuard@ORGANIZER
GET    /tournaments/public/:id/bracket    публично
GET    /tournaments/public/:id/results    публично
PATCH  /matches/:matchId                  JwtAuthGuard + RolesGuard@ORGANIZER
DELETE /matches/:matchId/result           JwtAuthGuard + RolesGuard@ORGANIZER
```

Все UUID-параметры через `ParseUUIDPipe`. Ownership на mutate-эндпоинтах проверяется в сервисе через `tournament.organizerId === user.id`, иначе 403 (паттерн из `tournaments.service`).

### `POST /tournaments/:id/bracket`

- Тело пустое.
- 200 OK + `BracketResponse` (см. ниже).
- 422: статус не `{PUBLISHED, IN_PROGRESS}` / перегенерация при наличии не-bye `COMPLETED` матчей / нет ни одной непустой категории.
- При успехе: `tournament.status = IN_PROGRESS`, старые матчи удалены, новые созданы.

### `GET /tournaments/:id/bracket` и `GET /tournaments/public/:id/bracket`

Возвращают одинаковое DTO. Отличия только в guard и в проверке статуса для публичного варианта.

```ts
type BracketResponse = {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: Array<{
    weight: number;
    rounds: number;
    matches: Array<{
      id: string;
      round: number;
      position: number;
      status: 'PENDING' | 'READY' | 'COMPLETED';
      red:  { boxerId: string; fullName: string; club: string | null; rank: BoxerRank } | null;
      blue: { boxerId: string; fullName: string; club: string | null; rank: BoxerRank } | null;
      nextMatchId: string | null;
      nextSlot: 'RED' | 'BLUE' | null;
      result: null | {
        winnerId: string;
        outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
        endRound: number | null;
        decidedAt: string;
      };
    }>;
  }>;
};
```

Публичный 404, если турнир не найден или находится в `DRAFT/CANCELLED` (по аналогии с существующим `findPublic`). Приватный 404, если турнир не принадлежит юзеру.

### `PATCH /matches/:matchId`

DTO `SetMatchResultDto`:

```ts
class SetMatchResultDto {
  @IsIn(['RED', 'BLUE'])
  winner: 'RED' | 'BLUE';

  @IsIn(['KO', 'WP', 'RSC', 'DSQ', 'WO'])
  outcome: MatchOutcome;

  @IsInt() @Min(1) @IsOptional()
  endRound?: number;
}
```

Кросс-валидация (проверяется в сервисе после `class-validator`):
- `outcome ∈ {KO, RSC}` ⇒ `endRound` обязателен и `≤ tournament.rounds`.
- `outcome ∈ {WP, DSQ, WO}` ⇒ `endRound` должен отсутствовать.

Поток:
1. `match = findUnique(matchId, include: { tournament })`. 404 если нет.
2. Ownership-check.
3. `tournament.status === IN_PROGRESS` иначе 422.
4. `match.status === READY` иначе 422.
5. `winnerId = winner === 'RED' ? redBoxerId : blueBoxerId`.
6. В транзакции: апдейт текущего матча → `propagateWinner(match)` → если все финалы во всех категориях `COMPLETED` → `tournament.status = FINISHED`.
7. 200 OK + актуальный `BracketResponse`.

### `DELETE /matches/:matchId/result`

Откат «последнего в цепочке»:

1. Ownership-check.
2. `match.status === COMPLETED` иначе 422.
3. **Никакой `nextMatch`, который зависит от этого матча, не должен быть `COMPLETED`** — иначе 422.
4. Запрещён откат `bye`-матчей (один пустой слот + `outcome = WO`) — 422 «перегенерируйте сетку».
5. В транзакции: чистим у текущего матча `winnerId/outcome/endRound/decidedAt`, переводим в `READY`; в `nextMatch` сбрасываем соответствующий слот по `nextSlot`, переводим его в `PENDING` (если был `READY`).
6. Если `tournament.status === FINISHED` — возвращаем в `IN_PROGRESS`.
7. 200 OK + `BracketResponse`.

### `GET /tournaments/public/:id/results`

```ts
type ResultsResponse = {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: Array<{
    weight: number;
    finished: boolean;            // финал зафиксирован
    podium: {
      gold:    { boxerId: string; fullName: string; club: string | null } | null;
      silver:  { boxerId: string; fullName: string; club: string | null } | null;
      bronze:  Array<{ boxerId: string; fullName: string; club: string | null }>;  // 0, 1 или 2 элемента
    };
    finals: Array<{
      round: number;
      winner: { boxerId, fullName };
      loser:  { boxerId, fullName };
      outcome: MatchOutcome;
      endRound: number | null;
    }>;
  }>;
};
```

**Бронза** — оба проигравших в матчах последнего полураунда (round = rounds−1), без боя за 3-е место. Категория с 1 участником — только `gold`. Категория с 2 участниками — `gold` и `silver`, без `bronze`.

Возвращается и для `IN_PROGRESS` (тогда `finished: false` для незакрытых категорий и `gold/silver` могут быть `null`), и для `FINISHED`.

## Ошибки и инварианты транзакций

Все мутации идут через `prisma.$transaction`. Стартуем на дефолтном уровне изоляции (read-committed). Если в тестах поймаем гонку между двумя одновременными фиксациями финалов в разных категориях на переходе `IN_PROGRESS → FINISHED` — поднимем уровень или возьмём pessimistic-lock через `SELECT FOR UPDATE` на турнире. Это деталь реализации, фиксируется в плане.

Сводка 422:

| Действие | Условие | Сообщение |
|---|---|---|
| `POST /bracket` | `status ∉ {PUBLISHED, IN_PROGRESS}` | «Сетку можно генерировать только у опубликованного турнира» |
| | перегенерация при наличии не-bye `COMPLETED` | «Нельзя перегенерировать сетку: уже есть зафиксированные результаты» |
| | нет ни одной категории с APPROVED-заявками | «Нет одобрённых участников ни в одной категории» |
| `PATCH /matches/:id` | `tournament.status !== IN_PROGRESS` | «Турнир не в активной фазе» |
| | `match.status !== READY` | «Матч ещё не готов к фиксации» / «Результат уже зафиксирован» |
| | `endRound > tournament.rounds` | «endRound не может превышать количество раундов» |
| `DELETE /matches/:id/result` | `match.status !== COMPLETED` | «Матч не зафиксирован» |
| | `nextMatch.status === COMPLETED` | «Сначала отмените результат следующего боя» |
| | bye-матч | «Bye-матч не редактируется, перегенерируйте сетку» |

400 от `class-validator` — стандартные сообщения NestJS:
- `KO/RSC` без `endRound` → 400.
- `WP/DSQ/WO` с `endRound` → 400.

## Фронт

### Расширение `boxr/src/shared/types/index.ts`

Добавляются: `MatchOutcome`, `MatchSlot`, `MatchStatus`, `MatchBoxer`, `MatchResult`, `BracketMatch`, `BracketCategory`, `BracketResponse`, `Podium`, `CategoryResults`, `ResultsResponse`. Имена в lowercase (`'ko'|'wp'|'rsc'|'dsq'|'wo'` и т.д.) — конвертация uppercase ↔ lowercase в API-клиенте, как сейчас сделано для `Role` и `BoxerRank`.

### Новый клиент — `boxr/src/shared/api/matches.ts`

```ts
export const matchesApi = {
  generateBracket(tournamentId): Promise<BracketResponse>
  getBracket(tournamentId): Promise<BracketResponse>            // auth
  getPublicBracket(tournamentId): Promise<BracketResponse>      // auth: false
  getPublicResults(tournamentId): Promise<ResultsResponse>      // auth: false
  setResult(matchId, dto: SetResultInput): Promise<BracketResponse>
  clearResult(matchId): Promise<BracketResponse>
}
```

Экспортируется из `shared/api/index.ts`.

### Виджет `bracket-view`

Принимает `BracketResponse` и проп `readOnly?: boolean`.

- `BracketView` — рендер всех категорий аккордеоном; внутри — колонки раундов с заголовками («1/4 финала», «Полуфинал», «Финал»). Карточки матчей — в стиле мокапа (красный/синий слот, `BYE`-стиль для пустого слота, `Pill` со статусом).
- `MatchCard` — клик по `READY`-матчу открывает `MatchResultDialog` (только если `!readOnly`). Для `COMPLETED` — показ имени победителя, типа исхода и `endRound`. У последнего в цепочке `COMPLETED` — кнопка «Откатить» (определяется по `nextMatchId === null || все nextMatches.status !== COMPLETED` — фронт может вычислить локально по полученному `BracketResponse`, но окончательную проверку делает бэк).
- `MatchResultDialog` — радио RED/BLUE, селект outcome (5 значений), поле `endRound` показывается только при `KO/RSC`. Submit вызывает `matchesApi.setResult`. Ошибки бэка показываются inline (`ApiError.message`).

### Виджет `results-view`

Принимает `ResultsResponse`. Для каждой категории показывает пьедестал (gold/silver/bronze в стиле мокапа `ResultsTab`) и список финалов/полуфиналов.

### `TournamentManagePage` — расширение

- Вкладки: `info | participants | bracket | results` (было `info | participants`).
- Вкладка `bracket`:
  - Если `status === PUBLISHED` и сетки нет — пустое состояние с кнопкой «Сгенерировать сетку».
  - Если `status === IN_PROGRESS` или `FINISHED` — `BracketView` с интерактивным режимом + (для `IN_PROGRESS` без `COMPLETED` не-bye) кнопкой «Перегенерировать».
  - Если `status === DRAFT/CANCELLED` — баннер «Сетка недоступна для этого статуса».
- Вкладка `results` — `ResultsView`.
- На вкладке `info` добавляются кнопки в зависимости от статуса (см. таблицу в дизайне).

### Новая публичная страница

Маршрут `/public/tournaments/:id` (префикс `/public`, чтобы не конфликтовать с организаторским `/tournaments/:id`). Layout без sidebar/topbar — как у `LandingPage`, `LoginPage` и `PublicTournamentsPage`.

- Шапка турнира (имя, даты, город, статус).
- Если есть сетка — `BracketView` с `readOnly`.
- Если есть результаты — `ResultsView`.
- 404 → «Турнир не найден или ещё не опубликован».

В `PublicTournamentsPage` имена турниров делаются ссылками на `/public/tournaments/:id`.

### Что **не** делаем во фронте

- Анимация «AI генерирует» — фейк из мокапа.
- Сайд-панель «Почему такая сетка?» — будет вместе с AI.
- Переключатель «Сетка / Список боёв» — список боёв относится к расписанию.
- Ручная жеребьёвка drag-n-drop.
- Кэширование/optimistic updates — каждая мутация возвращает свежий `BracketResponse`, фронт просто заменяет state.

## Тестирование

### Бэк — Jest

`boxr-api/src/matches/bracket-builder.spec.ts` (чистая функция):
- размеры 1, 2, 3, 4, 5, 6, 8, 16: правильное `bracketSize`, число матчей по раундам, корректность `nextMatchId/nextSlot`, инварианты 1–6.
- одиночка → один финал с `WO`, без `nextMatch`.
- bye-матчи продвигают победителя в первый раунд `nextMatch`.

`boxr-api/src/matches/matches.service.spec.ts`:
- `generateBracket` для смешанного турнира (3 категории, в одной 0 участников, в одной 1, в одной 5).
- 422 при пустом турнире.
- 422 при перегенерации с зафиксированным не-bye матчем.
- `generateBracket` стирает старую сетку и переводит `PUBLISHED → IN_PROGRESS`.
- `setResult` `KO` без `endRound` → 400.
- `setResult` `WP` с `endRound` → 400.
- `setResult` корректно продвигает победителя и переводит `nextMatch` в `READY`.
- `setResult` для последнего финала переводит турнир в `FINISHED`.
- `clearResult` для матча с `nextMatch.status === COMPLETED` → 422.
- `clearResult` для последнего финала возвращает `FINISHED → IN_PROGRESS`.

Решение «mock Prisma vs реальная тестовая БД» примем на этапе плана — посмотрим, как живут существующие `*.service.spec.ts`. Предпочтение — реальная БД, потому что генерация и продвижение по сетке сильно завязаны на каскадные UPDATE в одной транзакции.

### Бэк — bash smoke

`boxr-api/scripts/test-bracket.sh` — end-to-end в духе существующих:
1. Регистрация тренера и организатора.
2. Создание турнира с 1 категорией и 6 одобренными заявками.
3. `POST /tournaments/:id/bracket` → 200, проверка shape по `GET /bracket`.
4. Фиксация всех матчей в порядке полуфиналы → финал → проверка `FINISHED` и пьедестала.

### Фронт — Playwright

`boxr/e2e/bracket.spec.ts`:
- Орг создаёт турнир, одобряет 4 заявки, публикует, генерирует сетку, видит дерево.
- Орг фиксирует 2 полуфинала + финал, видит пьедестал.
- Незалогиненный посетитель открывает `/public/tournaments/:id`, видит ту же сетку и пьедестал.
- Орг жмёт «Перегенерировать» сразу после генерации — успех. После фиксации первого результата кнопка не работает (или скрыта).

## Миграция данных

Существующих записей в `Match` нет (модель новая), миграция чистая `prisma migrate dev --name matches`. На существующие турниры (если они есть в dev-базе) дополнительный `IN_PROGRESS/FINISHED` не повлияет — они остаются в текущем статусе.
