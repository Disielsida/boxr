# Расписание боёв — дизайн v1

**Дата:** 2026-05-08
**Контекст:** пятая итерация BOXR. Сетка матчей и фиксация результатов уже работают (см. `2026-05-07-matches-bracket-design.md`). Сейчас закрываем недостающее звено — раскладку матчей по дням, рингам и времени, чтобы из «бои на бумаге» получить практическое расписание турнира.

В мокапе `index.html` (секция `ScheduleTab`, строки 2841-2902) показана таблица боёв на день: переключатель дней, колонки «время / № боя / ринг / красный / vs / синий / категория или статус», параллельные бои на разных рингах. Мы делаем минимально работающую версию этого: автогенерация + ручные правки + публичный экран. **Назначение судей и Live Scoring — отдельные циклы**.

## Решения, утверждённые в брейнсторминге

| Вопрос | Решение |
|---|---|
| Скоуп цикла | Автогенерация + ручные правки + публичная вкладка. Назначение судей и Live Scoring — отдельные циклы |
| Метаданные турнира | Новые поля у `Tournament`: `ringCount`, `dayStartTime`, `slotMinutes`, `minRestMinutes` (все с дефолтами) |
| Алгоритм | Все матчи раунда N ставятся раньше матчей N+1; отдых боксёра ≥ `minRestMinutes`; раунды размазываются по дням турнира; bye-матчи в расписание не попадают; не помещается → 422 |
| Жизненный цикл | Точечные правки только для `READY/PENDING`. Авто-перегенерация запрещена после первого зафиксированного не-bye результата. Все 3 инварианта (слот не занят, порядок раундов, отдых) проверяются на каждой ручной правке |
| Хранение | Поля `scheduledAt: DateTime?`, `ring: Int?` у `Match`. Никакой отдельной таблицы расписания |
| Длительность матча | Считается на лету: `tournament.rounds × tournament.roundDuration + (tournament.rounds - 1) × 1` (минута перерыва между раундами) |
| Окончание дня | Фиксировано 22:00 в коде. Что не помещается до 22:00 — переносится на следующий день |
| Публичность | Расписание — часть `BracketResponse`, видна на `/public/tournaments/:id` рядом с сеткой и пьедесталом |

## Non-goals

- **Drag-n-drop** правка матчей по таблице. Только через диалог.
- **Назначение судей** на ринг или матч (отдельный цикл).
- **Live Scoring** (отдельный цикл).
- **Тонкая настройка** перерывов между раундами руками — берём фиксированную 1 минуту.
- **Заданное окончание дня** в настройках турнира — 22:00 в коде.
- **Realtime / WebSocket** — фронт перечитывает сетку после мутаций.
- **Раздельные планировщики для категорий** — один глобальный.
- **Учёт «обеда»**, перерывов на церемонии — не моделируем.

## Архитектура

Расширение **существующих** компонентов, новых модулей не появляется:

- В `boxr-api`: расширяем модели `Tournament` и `Match`, добавляем чистую функцию `boxr-api/src/matches/schedule-builder.ts` (по аналогии с уже существующим `bracket-builder.ts`), три новых эндпоинта на `MatchesController`, методы в `MatchesService`.
- В `boxr`: новый виджет `widgets/schedule-view/`, расширение `TournamentManagePage` (новая вкладка), расширение `PublicTournamentPage` (новая секция), три новых метода в `matchesApi`.

```
boxr-api/src/matches/
├── (existing)
├── schedule-builder.ts          ← новый: чистый алгоритм планировщика
└── schedule-builder.spec.ts     ← новый: jest unit-тесты алгоритма

boxr-api/src/matches/dto/
├── (existing set-result.dto.ts)
└── set-schedule.dto.ts          ← новый

boxr-api/src/tournaments/dto/
├── create-tournament.dto.ts     ← дополнить 4 опциональными полями
└── update-tournament.dto.ts     ← дополнить теми же

boxr/src/
├── shared/api/matches.ts        ← дополнить (3 новых метода)
├── widgets/
│   └── schedule-view/           ← новая директория
│       ├── index.ts
│       └── ui/
│           ├── ScheduleView.tsx
│           └── MatchScheduleDialog.tsx
└── pages/
    ├── tournament-manage/ui/TournamentManagePage.tsx ← +вкладка `schedule`
    └── public-tournament/ui/PublicTournamentPage.tsx ← +секция «Расписание»
```

## Модель данных (Prisma)

### Расширение существующих моделей

```prisma
model Tournament {
  // ... существующие поля
  ringCount       Int     @default(1)
  dayStartTime    String  @default("10:00")    // формат HH:MM
  slotMinutes     Int     @default(30)
  minRestMinutes  Int     @default(60)
}

model Match {
  // ... существующие поля
  scheduledAt   DateTime?
  ring          Int?
}
```

Все четыре поля турнира с дефолтами — миграция не ломает существующие записи. `Match.scheduledAt`/`ring` опциональны: до автогенерации (или после `DELETE /schedule`) у всех матчей `null`.

### Инварианты, поддерживаемые сервисом

1. У зафиксированного (`COMPLETED` не-bye) матча `scheduledAt`/`ring` нельзя изменить.
2. У bye-матча (`outcome === WO && один из слотов null`) `scheduledAt`/`ring` всегда `null` — он виртуальный.
3. После автогенерации никакие два матча с непустым `scheduledAt` не делят один и тот же `(scheduledAt, ring)` для одного турнира.
4. Если матч A — предшественник матча B (через `nextMatchId`), и оба имеют расписание, то `A.scheduledAt + matchDuration ≤ B.scheduledAt`.
5. Если у боксёра X есть два матча M1, M2 с расписанием, то `M1.end + minRestMinutes ≤ M2.scheduledAt`. Для матчей раунда ≥ 2 ограничение применяется к **обоим** боксёрам **обоих** предшественников (т.е. ко всем потенциальным участникам).

### Длительность матча

```ts
function matchDuration(t: Tournament): number {
  return t.rounds * t.roundDuration + (t.rounds - 1) * 1; // минут
}
```

В БД не хранится — считается на лету в сервисе и в алгоритме.

## Алгоритм автогенерации

Чистая функция `planSchedule(matches, params): Schedule | { error: string }`. На вход идут только non-bye матчи (фильтр в сервисе), отсортированные по `(round asc, category asc, position asc)`.

```
planSchedule(matches, params):
  // params: { dateStart, dateEnd, ringCount, dayStartMinutes, dayEndMinutes (= 22*60), slotMinutes, minRestMinutes, matchDuration }
  
  ringCursor[ring] = { day: 0, slot: dayStartMinutes }   // следующее свободное время на ринге
  matchEndById = {}                                       // когда матч закончится (по id, для предшественников)
  boxerLastFinish = {}                                    // когда боксёр последний раз заканчивал
  
  result = []
  
  for match in matches:
    candidate = findEarliestSlot(match, ...)
    if candidate is null:
      return { error: 'не помещается' }
    result.push({ matchId: match.id, day: candidate.day, slot: candidate.slot, ring: candidate.ring })
    matchEnd = candidate.absoluteMinutes + matchDuration
    matchEndById[match.id] = matchEnd
    for boxerId in potentialBoxerIds(match):
      boxerLastFinish[boxerId] = max(boxerLastFinish[boxerId] ?? -Inf, matchEnd)
    ringCursor[candidate.ring] = next slot after candidate on candidate.day
  
  return { result }

findEarliestSlot(match, ...):
  // potentialBoxerIds: для match раунда 1 = [redBoxerId, blueBoxerId];
  //   для match раунда ≥ 2 = объединение potentialBoxerIds(prevMatchА) ∪ potentialBoxerIds(prevMatchB)
  // predecessors: матчи, у которых nextMatchId === match.id
  
  for day in 0..(dateEnd - dateStart) days:
    for slotMin in dayStartMinutes..dayEndMinutes step slotMinutes:
      absMin = dayMinutes(day) + slotMin
      // 1) Ринг свободен
      // 2) Все predecessors закончились ≤ absMin
      // 3) Все potential boxers отдохнули ≥ minRestMinutes
      for ring in 1..ringCount:
        if any match already at (day, slot, ring): skip
        if any predecessor of match has matchEnd > absMin: skip
        if any potential boxer's boxerLastFinish + minRestMinutes > absMin: skip
        return { day, slot: slotMin, ring, absoluteMinutes: absMin }
  return null
```

Где `absoluteMinutes` — счётчик минут от единой reference-точки (например, начало `dateStart`), нужный для сравнения времён через дни (отдых боксёра, end предшественника). На уровне реализации это будет либо JS timestamp в ms / 60_000, либо число минут от полуночи `dateStart`. Конкретное представление — деталь реализации, фиксируется в плане.

`potentialBoxerIds(match)`:
- Если оба слота заполнены (раунд 1 не-bye, или матч раунда 2 уже подкормлен победителями) — `[redBoxerId, blueBoxerId]`.
- Иначе — рекурсивно объединяем потенциальных участников из `prevMatchA` и `prevMatchB`. На практике: для матча раунда N это все участники соответствующего поддерева.

**Сортировка матчей на входе** гарантирует, что мы планируем их в порядке `round asc`. Это значит к моменту планирования матча раунда N все его предшественники в раундах < N уже размещены и есть `matchEndById[predecessor.id]`.

**Тривиальные случаи:**
- 1 ринг, 4 матча, minRest=60: ставит на 10:00, 10:30, 11:00, 11:30… но финал 4-местной сетки требует, чтобы оба полуфинала закончились + отдых, то есть финал уезжает на ~12:00 как минимум.
- 2 ринга, 4 матча: оба 1/4 параллельно (10:00 на rings 1 и 2), полуфиналы после отдыха.
- 1 ринг, дней мало → 422.

**Граничные случаи (на тестах):**
- 2 матча в одной категории (всего 1 матч 1 раунда + один полуфинал = ой нет, 2 участника = 1 матч-финал). Алгоритм ставит этот один матч на 10:00 ring 1.
- 7 матчей в одной категории (8-местная сетка с одним bye в первом раунде): bye пропускается, остаётся 6 матчей; алгоритм размазывает их по 2 дням при 1 ринге.
- Турнир на 1 день с количеством матчей > вместимости → 422 «не помещается».

## API

Все маршруты добавляются на **существующий** `MatchesController`.

```
POST   /tournaments/:id/schedule           JwtAuthGuard + RolesGuard@ORGANIZER
DELETE /tournaments/:id/schedule           JwtAuthGuard + RolesGuard@ORGANIZER
PATCH  /matches/:matchId/schedule          JwtAuthGuard + RolesGuard@ORGANIZER
```

### `POST /tournaments/:id/schedule`

- Тело пустое.
- Сервисный метод `MatchesService.generateSchedule(userId, tournamentId)`:
  1. Загружает турнир, проверяет ownership и `status === IN_PROGRESS`.
  2. Проверяет отсутствие не-bye `COMPLETED` матча (через существующий `nonByeCompletedFilter`).
  3. Загружает все non-bye матчи турнира с `prevMatches` для определения predecessor'ов.
  4. Вызывает `planSchedule(matches, params)`.
  5. Если `error` — 422 с сообщением.
  6. Иначе в транзакции апдейтит `scheduledAt`/`ring` всех матчей по результату.
  7. Возвращает свежий `BracketResponse` (через существующий `buildBracketResponse`).
- 200 + `BracketResponse`.
- Возможные 422: `status !== IN_PROGRESS`; есть не-bye `COMPLETED`; нет ни одного non-bye матча; «не помещается».

### `DELETE /tournaments/:id/schedule`

- Сбрасывает `scheduledAt = null`, `ring = null` всем матчам турнира.
- 422: `status !== IN_PROGRESS`; есть не-bye `COMPLETED` (по аналогии с регенерацией сетки).
- 200 + `BracketResponse`.

### `PATCH /matches/:matchId/schedule`

DTO:
```ts
class SetMatchScheduleDto {
  @IsISO8601() scheduledAt!: string;
  @IsInt() @Min(1) ring!: number;
}
```

Поток:
1. Загружаем match с tournament. 404 если нет, 403 если не владелец.
2. 422 если `match.status === COMPLETED` («Зафиксированный матч не редактируется»).
3. 422 если `ring > tournament.ringCount` («Ринг {n} не существует»).
4. Парсим `scheduledAt`. Проверяем диапазон: `>= tournament.dateStart` и `< tournament.dateEnd + 1 day` (включая 22:00 последнего дня).
5. Проверяем, что слот `(scheduledAt, ring)` не занят другим матчем в этом турнире (`findFirst({tournamentId, scheduledAt, ring, NOT: {id: matchId}})`).
6. Проверяем порядок раундов: для всех predecessor'ов с не-null `scheduledAt` должно быть `predecessor.scheduledAt + matchDuration ≤ new scheduledAt`.
7. Проверяем отдых: для всех potential boxers матча, у которых есть другой scheduled матч `M`, должно быть `M.end + minRestMinutes ≤ new scheduledAt` (если `M` раньше) или `new scheduledAt + matchDuration + minRestMinutes ≤ M.scheduledAt` (если `M` позже).
8. Апдейтим scheduledAt/ring.
9. Возвращаем `BracketResponse`.

### Расширение `BracketResponseMatch`

```ts
{
  ...existing fields,
  scheduledAt: string | null;
  ring: number | null;
}
```

Это автоматически покрывает приватный (`getBracketForOwner`) и публичный (`getPublicBracket`) эндпоинты.

### Расширение `Tournament` API

В `CreateTournamentDto` и `UpdateTournamentDto` добавить:
```ts
@IsOptional() @IsInt() @Min(1) ringCount?: number;
@IsOptional() @Matches(/^\d{2}:\d{2}$/) dayStartTime?: string;
@IsOptional() @IsInt() @Min(5) slotMinutes?: number;
@IsOptional() @IsInt() @Min(0) minRestMinutes?: number;
```

Поля возвращаются в ответе турнира — нужно расширить mapping в `tournaments.service.ts` (`PublicTournament` тоже включает их).

Ограничение: можно править эти поля только в статусах `DRAFT/PUBLISHED` (в `IN_PROGRESS/FINISHED` — игнорируем, существующее правило `update`).

## Фронт

### Расширение типов `boxr/src/shared/types/index.ts`

```ts
export interface Tournament {
  // ... existing fields
  ringCount: number;
  dayStartTime: string;
  slotMinutes: number;
  minRestMinutes: number;
}

export interface BracketMatch {
  // ... existing fields
  scheduledAt: string | null;     // ISO 8601
  ring: number | null;
}
```

### Расширение `matchesApi`

```ts
export const matchesApi = {
  // ... existing methods
  generateSchedule: (tournamentId): Promise<Bracket>
  clearSchedule: (tournamentId): Promise<Bracket>
  setSchedule: (matchId, {scheduledAt, ring}): Promise<Bracket>
}
```

Возвращают `Bracket` через те же мапперы `toBracket`/`toMatch` (нужно расширить `toMatch` чтобы перекинуть `scheduledAt`/`ring`).

### Виджет `widgets/schedule-view/`

`ScheduleView` принимает `bracket: Bracket` + опциональный `tournament: Tournament` (для slotMinutes/dayStartTime — нужны, чтобы построить выбор слотов в диалоге) + `readOnly?: boolean`.

Логика:
1. Собирает все матчи всех категорий в один массив, фильтрует `scheduledAt !== null`.
2. Группирует по дню (`scheduledAt.toISOString().slice(0, 10)`).
3. Сортирует группы по дате, внутри — по `(scheduledAt, ring)`.
4. Глобальный «номер боя» = индекс матча в общем отсортированном массиве + 1.
5. Рендер:
   - Переключатель дней (вкладки по датам в формате «14 июня»).
   - Внутри активного дня — таблица с колонками `время / Бой N / Ринг N / 🔴 Боксёр / vs / 🔵 Боксёр / Pill категории/статуса`.
   - Если `match.red === null` или `blue === null` (раунд ≥ 2 без определённых победителей) → текст «Победитель боя M» (находим predecessor.bout-номер по `nextMatchId`).
6. В приватном режиме (не readOnly) клик по строке открывает `MatchScheduleDialog`.

`MatchScheduleDialog`:
- Поля: дата (select из `[dateStart..dateEnd]`), время (select слотов = `dayStartTime + N * slotMinutes`, до 22:00), ринг (`1..ringCount`).
- Submit → `matchesApi.setSchedule(matchId, {scheduledAt, ring})`.
- Ошибки бэка inline.

Если матч `COMPLETED` — диалог вообще не открывается (только просмотр).

### Расширение `TournamentManagePage`

Tab расширяется до `'info' | 'participants' | 'bracket' | 'schedule' | 'results'`.

Новый внутренний компонент `ScheduleTab`:
- Если `tournament.status !== 'in_progress' && tournament.status !== 'finished'` → баннер «Сначала сгенерируйте сетку».
- Если расписание пустое (все матчи имеют `scheduledAt = null`) → пустое состояние с кнопкой **«Авто-расставить»**.
- Если расписание есть → `ScheduleView` + кнопки «Перерасставить» (при `IN_PROGRESS` без зафиксированных результатов) и «Очистить расписание».

В форму редактирования турнира (вкладка «Информация», уже существующая) добавить 4 поля (ringCount, dayStartTime, slotMinutes, minRestMinutes). Опционально, с дефолтами.

### Расширение `PublicTournamentPage`

Между секциями «Сетка» и «Результаты» добавляется:

```tsx
{bracket && hasAnySchedule(bracket) && (
  <section style={{ marginBottom: 32 }}>
    <h2>Расписание</h2>
    <ScheduleView bracket={bracket} readOnly />
  </section>
)}
```

`hasAnySchedule(bracket)` — простая утилита: `bracket.categories.some(c => c.matches.some(m => m.scheduledAt !== null))`.

### Что **не** делаем во фронте

- Drag-n-drop по таблице.
- Предпросмотр перед автогенерацией.
- Анимации/индикатор прогресса генерации.
- Адаптив для мобильных — оставляем horizontal scroll.

## Тестирование

### Бэк — Jest unit (`schedule-builder.spec.ts`)

Алгоритм `planSchedule` тестируется отдельно от Prisma. Стиль аналогичен существующему `bracket-builder.spec.ts`.

- 2 матча 1 ринг 1 день: подряд по slotMinutes (с учётом minRest=60 для финала после полуфинала).
- 4 матча 2 ринга 1 день: 1/4 параллельно (10:00 ring 1 + 10:00 ring 2), полуфиналы и финал после отдыха.
- 7 матчей (8-местная сетка минус bye), 1 ринг, 3 дня → размазывание.
- 6 матчей бракета на 6, 1 ринг, 1 день → 422 «не помещается».
- Bye-матчи в input не передаются; алгоритм работает только с полученным non-bye набором.
- Инвариант slot-conflict: ни одна пара матчей в результате не делит `(day, slot, ring)`.
- Инвариант predecessor-order: для каждой связи `prevMatch → match` end раньше start.
- Инвариант boxer-rest: если у двух матчей один и тот же реальный боксёр в первом раунде — между ними ≥ minRestMinutes.

### Бэк — bash smoke (`scripts/test-schedule.sh`)

End-to-end по образцу `test-bracket.sh`:
- Создаёт турнир (3 дня, 2 ринга, 1 категория из 4 боксёров).
- Генерирует сетку, потом расписание → 200, проверка что 3 матча получили `scheduledAt + ring`.
- `PATCH /matches/:id/schedule` с конфликтующим временем → 422.
- `PATCH /matches/:id/schedule` с временем до окончания предшественника → 422.
- Фиксирует один матч → попытка `POST /tournaments/:id/schedule` → 422.
- `DELETE /tournaments/:id/schedule` после фиксации → 422.

### Фронт — Playwright e2e (`schedule.spec.ts`)

- Орг создаёт турнир (3 дня, 2 ринга), доходит до сетки на 4 матча → жмёт «Авто-расставить» → видит таблицу с матчами по дням.
- Перенос матча через диалог («Изменить → ринг 2, время 12:00») → таблица обновилась.
- Публичный посетитель открывает `/public/tournaments/:id` → видит секцию «Расписание».

### Что не покрываем тестами

- Производительность алгоритма на >32 матчах (не нужно для дипломных размеров).
- Конкурентные правки расписания двумя организаторами (это эджекейс, который никогда не возникнет в этом продукте).

## Миграция данных

Существующих записей в `Match` есть (после Tasks 1-18 предыдущего цикла). Миграция — `prisma migrate dev --name match_schedule`:
- ALTER TABLE Match ADD COLUMN scheduledAt timestamp NULL.
- ALTER TABLE Match ADD COLUMN ring integer NULL.
- ALTER TABLE Tournament ADD COLUMN ringCount integer NOT NULL DEFAULT 1.
- ALTER TABLE Tournament ADD COLUMN dayStartTime text NOT NULL DEFAULT '10:00'.
- ALTER TABLE Tournament ADD COLUMN slotMinutes integer NOT NULL DEFAULT 30.
- ALTER TABLE Tournament ADD COLUMN minRestMinutes integer NOT NULL DEFAULT 60.

Все ALTER аддитивные, существующие данные не теряются.
