# Турниры (CRUD) — дизайн v1

**Дата:** 2026-05-06
**Контекст:** вторая итерация бэкенда BOXR. Первая (auth + roles) прошла все 29 тестов. Теперь добавляем сущность `Tournament` с базовым CRUD-флоу для роли `ORGANIZER`.

## Решения, утверждённые в брейншторминге

| Вопрос | Решение |
|---|---|
| Scope | Только CRUD турнира. Без участников/жеребьёвки/расписания/результатов |
| Жизненный цикл | `DRAFT → PUBLISHED → CANCELLED`. Фактическая фаза (`OPEN/ACTIVE/FINISHED`) **вычисляется** на бэке по `dateStart/dateEnd`, не хранится |
| Публичный список | Виден всем, без авторизации (`GET /tournaments/public`) |
| Владение | Один владелец = создатель. Соавторов в v1 нет |
| Удаление | `DRAFT` → hard delete. `PUBLISHED` → soft delete через `cancel` |

## Архитектура

Расширение существующего `boxr-api`. Новый модуль `TournamentsModule` + одна таблица. Никаких новых зависимостей.

```
boxr-api/src/tournaments/
├── tournaments.module.ts
├── tournaments.controller.ts
├── tournaments.service.ts
└── dto/
    ├── create-tournament.dto.ts
    ├── update-tournament.dto.ts
    └── list-tournaments.dto.ts
```

## Модель данных (Prisma)

```prisma
enum TournamentType       { REGIONAL NATIONAL INTERNATIONAL }
enum TournamentLevel      { AMATEUR PROFESSIONAL MIXED }
enum TournamentStatus     { DRAFT PUBLISHED CANCELLED }

model Tournament {
  id            String           @id @default(uuid())
  name          String
  type          TournamentType
  level         TournamentLevel
  status        TournamentStatus @default(DRAFT)
  dateStart     DateTime         @db.Date
  dateEnd       DateTime         @db.Date
  city          String
  address       String?
  categories    Float[]
  rounds        Int
  roundDuration Int
  helmets       Boolean          @default(false)
  organizerId   String
  organizer     User             @relation(fields: [organizerId], references: [id], onDelete: Restrict)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  publishedAt   DateTime?

  @@index([status, dateStart])
  @@index([organizerId])
}
```

В `User` добавляется `tournaments Tournament[]`.

**Ключевые решения:**
- `Float[]` для категорий — нужна 63.5 кг (полусредний вес)
- `@db.Date` — храним только дату, без времени
- `onDelete: Restrict` — нельзя удалить организатора, у которого есть турниры
- Имя НЕ уникально

## API endpoints (`/api/v1`)

| Метод | Путь | Auth | Роль | Тело / Query | Ответ |
|---|---|---|---|---|---|
| `GET` | `/tournaments/public` | — | — | `?city&from&to&page&limit` | `{ items, total, page, limit }` |
| `GET` | `/tournaments/public/:id` | — | — | — | `Tournament` (только `PUBLISHED`) |
| `GET` | `/tournaments/mine` | access | ORGANIZER | `?status&page&limit` | `{ items, total, page, limit }` |
| `GET` | `/tournaments/:id` | access | ORGANIZER | — | `Tournament` (только свой) |
| `POST` | `/tournaments` | access | ORGANIZER | `CreateTournamentDto` | `201 Tournament` (DRAFT) |
| `PATCH` | `/tournaments/:id` | access | ORGANIZER | `UpdateTournamentDto` | `200 Tournament` |
| `POST` | `/tournaments/:id/publish` | access | ORGANIZER | — | `200 Tournament` (PUBLISHED) |
| `POST` | `/tournaments/:id/cancel` | access | ORGANIZER | — | `200 Tournament` (CANCELLED) |
| `DELETE` | `/tournaments/:id` | access | ORGANIZER | — | `204` (только DRAFT, иначе 409) |

**Правила:**
- `GET /public` — фильтр по городу и периоду, пагинация, отдаёт вычисленную `phase: OPEN/ACTIVE/FINISHED`
- `GET /mine` — по умолчанию исключает `CANCELLED`
- `POST` — всегда `DRAFT`
- `PATCH` — запрещён для `CANCELLED`; для `PUBLISHED` запрещён после `dateStart`
- `publish` — проверяет обязательные поля; ставит `publishedAt = now()`
- `cancel` — `PUBLISHED → CANCELLED`. Для `DRAFT` использовать `DELETE`
- `DELETE` — только `DRAFT`; для остальных → `409` с подсказкой

**Валидация (CreateTournamentDto):**
- `name` — string, 3..200
- `type`, `level` — enum
- `dateStart`, `dateEnd` — date string; в сервисе проверка `dateEnd >= dateStart`
- `city` — string, 2..120
- `address` — optional, string ≤200
- `categories` — number[], min 1
- `rounds` — int, 1..12
- `roundDuration` — int, 1..5
- `helmets` — bool

`UpdateTournamentDto = PartialType(CreateTournamentDto)`

**Ошибки:**
- `404` для отсутствующего id ИЛИ чужого турнира (не разделяем — не утекает существование)
- `403` — не та роль
- `409` — невалидный переход статуса

## Авторизация

- Все приватные эндпоинты: `JwtAuthGuard + RolesGuard + @Roles(ORGANIZER)`
- Доступ к `:id` — проверка `tournament.organizerId === user.id` в сервисе, иначе `404`
- Тренеры/судьи в v1 турниры через эти эндпоинты не видят. Их доступ — следующие итерации (заявки, назначения).

## Изменения на фронте

**Создаются (новые файлы):**
- `shared/api/tournaments.ts` — API-клиент с маппингом enum
- `entities/tournament/model/types.ts` — доменные типы, `computePhase(t, now)`
- `entities/tournament/model/categories.ts` — константа `WEIGHT_CATEGORIES`
- `entities/tournament/ui/TournamentCard.tsx` — карточка
- `entities/tournament/ui/StatusPill.tsx` — бейдж
- `features/tournament-create/ui/CreateTournamentWizard.tsx` — 5-шаговый мастер по прототипу (line 2185 в `index.html`)
- `features/tournament-create/model/useCreateTournament.ts`
- `pages/create-tournament/ui/CreateTournamentPage.tsx`
- `pages/create-tournament/index.ts`
- `pages/tournament-manage/ui/TournamentManagePage.tsx` — детали + кнопки `Редактировать/Опубликовать/Отменить/Удалить`
- `pages/tournament-manage/index.ts`

**Меняются:**
- `shared/types/index.ts` — добавить enum-ы и обновить `Tournament`
- `shared/api/index.ts` — реэкспорт `tournamentsApi`
- `pages/dashboard/ui/DashboardPage.tsx` — заменить плейсхолдер «hello world» секцией «Мои турниры» + кнопка «Создать»
- `pages/public-tournaments/ui/PublicTournamentsPage.tsx` — подключение к API через `tournamentsApi.listPublic`
- `app/router/AppRouter.tsx` — роуты `/tournaments/new`, `/tournaments/:id`

**НЕ трогаем:** topbar, sidebar, ai-assistant, entities/match, features/draw-generation, pages/live-scoring, features/auth, entities/user.

**Состояние:** локальный `useState` + `useEffect`. React Query/Zustand не вводим в этой итерации.

## Что НЕ входит в v1

- Участники, заявки, статусы заявок
- Жеребьёвка, сетка, матчи
- Расписание боёв
- Результаты, протоколы
- Импорт CSV/Excel
- AI-помощник
- Метрики дашборда (требуют боксёров/бои)
- Фид активности
- Сохранение черновика мастера
- Загрузка картинки турнира
- Соавторы, передача владения
- Email-уведомления

## Верификация

**Бэкенд (curl):**
1. Создание под organizer → `201`, `DRAFT`, `publishedAt: null`
2. `GET /mine` — черновик виден
3. `GET /public` — черновик НЕ виден
4. Чужой organizer на `GET /:id` → `404`
5. `PATCH` чужого → `404`
6. `publish` без обязательных полей → `409`
7. `publish` валидного → `200`, `publishedAt` заполнен
8. `GET /public` — опубликованный виден с правильной `phase`
9. `GET /public` без токена → `200`
10. Trainer пытается `POST` → `403`
11. `cancel` → `CANCELLED`, в `/public` нет
12. `DELETE` `DRAFT` → `204`; `DELETE` `PUBLISHED` → `409`
13. Валидация: `dateEnd < dateStart` → `400`; пустые `categories` → `400`; `rounds: 0` → `400`

**Фронт (UI):**
1. Логин как organizer → дашборд → секция «Мои турниры»
2. «Создать турнир» → мастер 5 шагов → создание → редирект на детали
3. «Опубликовать» → бейдж меняется на `OPEN`/`ACTIVE`/`FINISHED` по датам
4. «Редактировать» → форма, изменения сохраняются
5. Логаут → `/tournaments` (публичный) — турнир в списке
6. Trainer на `/tournaments/new` → редирект на `/` (RequireRole)
7. Чужой organizer на `/tournaments/<чужой-id>` → редирект/404
8. «Отменить» → пропадает из публичного списка
