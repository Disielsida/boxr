# Боксёры и заявки на турнир — дизайн v1

**Дата:** 2026-05-06
**Контекст:** третья итерация BOXR. Auth (29 тестов), турниры (22 backend + 8 UI). Теперь добавляем боксёров под тренером и пакетные заявки на турнир с аппрувом организатора.

## Решения, утверждённые в брейншторминге

| Вопрос | Решение |
|---|---|
| OCR | НЕ делаем. Тренер вводит данные руками. OCR — отдельная итерация |
| Подача заявки | Пакетом: тренер чекает несколько своих боксёров → один POST → N записей |
| Поля боксёра | Минимум: ФИО, дата рождения, пол, вес. Клуб и разряд — опциональны |
| Жизненный цикл заявки | `PENDING → APPROVED|REJECTED|WITHDRAWN`; `APPROVED → WITHDRAWN`; всё — только до `dateStart` |
| Категория в заявке | Авто-подбор из `tournament.categories` + ручной override |

## Архитектура

Расширение `boxr-api`: два новых модуля (`BoxersModule`, `ApplicationsModule`) и две таблицы (`Boxer`, `Application`). Без новых внешних зависимостей.

```
boxr-api/src/boxers/
├── boxers.module.ts
├── boxers.controller.ts
├── boxers.service.ts
└── dto/
    ├── create-boxer.dto.ts
    ├── update-boxer.dto.ts
    └── list-boxers.dto.ts

boxr-api/src/applications/
├── applications.module.ts
├── applications.controller.ts
├── applications.service.ts
└── dto/
    ├── submit-applications.dto.ts
    ├── reject-application.dto.ts
    └── list-applications.dto.ts
```

На фронте (FSD):
- `entities/boxer/` — типы, лейблы рангов и пола, `BoxerCard`, `BoxerRow`.
- `entities/application/` — типы, `ApplicationStatusPill`, лейблы статусов.
- `features/boxer-form/` — форма создания/редактирования боксёра.
- `features/applications-submit/` — диалог пакетной подачи (для тренера).
- `features/applications-review/` — таблица + approve/reject (для организатора, в составе вкладки «Участники»).
- `pages/register-boxer/`, `pages/boxer-profile/` — наполнение существующих пустых папок.
- `pages/trainer-dashboard/`, `pages/tournament-manage/` — расширяются.

## Модель данных (Prisma)

```prisma
enum Gender { MALE FEMALE }

enum BoxerRank {
  NONE
  THIRD_CLASS    // 3-й разряд
  SECOND_CLASS   // 2-й разряд
  FIRST_CLASS    // 1-й разряд
  CMS            // КМС
  MS             // МС
  MSIC           // МСМК
}

model Boxer {
  id        String    @id @default(uuid())
  fullName  String
  dob       DateTime  @db.Date
  gender    Gender
  weight    Float                          // текущий вес, кг
  club      String?
  rank      BoxerRank @default(NONE)
  trainerId String
  trainer   User      @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  applications Application[]

  @@index([trainerId])
}

enum ApplicationStatus { PENDING APPROVED REJECTED WITHDRAWN }

model Application {
  id           String            @id @default(uuid())
  boxerId      String
  boxer        Boxer             @relation(fields: [boxerId], references: [id], onDelete: Cascade)
  tournamentId String
  tournament   Tournament        @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  category     Float                              // зафиксированная весовая категория турнира
  status       ApplicationStatus @default(PENDING)
  rejectReason String?
  trainerId    String                             // дублируется для индекса/фильтра
  trainer      User              @relation("trainerApplications", fields: [trainerId], references: [id], onDelete: Restrict)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  decidedAt    DateTime?                          // когда APPROVED/REJECTED
  withdrawnAt  DateTime?

  @@unique([boxerId, tournamentId])
  @@index([tournamentId, status])
  @@index([trainerId])
}
```

В `User` добавляются `boxers Boxer[]` и `applicationsAsTrainer Application[] @relation("trainerApplications")`.
В `Tournament` добавляется `applications Application[]`.

**Ключевые решения:**
- `@@unique([boxerId, tournamentId])` — повторная подача невозможна. Если боксёр был отозван/отклонён, тренер сначала делает `DELETE`, потом подаёт заново.
- `category` хранится в заявке, не в боксёре: вес боксёра меняется, а контекст турнира фиксируется.
- `BoxerRank` — enum, чтобы не было разнобоя написания.
- `onDelete: Restrict` на `trainer` — нельзя удалить тренера с боксёрами.
- `Float` для `weight` и `category` — чтобы поддержать `63.5 кг`.

## API endpoints (`/api/v1`)

### Boxers (только `TRAINER`)

| Метод | Путь | Тело / Query | Ответ |
|---|---|---|---|
| `GET` | `/boxers` | `?page&limit` | `{ items, total, page, limit }` своих |
| `GET` | `/boxers/:id` | — | `Boxer` (404 если чужой) |
| `POST` | `/boxers` | `CreateBoxerDto` | `201 Boxer` |
| `PATCH` | `/boxers/:id` | `UpdateBoxerDto` | `200 Boxer` |
| `DELETE` | `/boxers/:id` | — | `204` или `409`, если есть `PENDING|APPROVED` заявка с непрошедшим турниром |

**CreateBoxerDto:**
- `fullName` — string, 2..200
- `dob` — date string; не в будущем; возраст ≥ 8 и ≤ 80 (защита от опечаток)
- `gender` — `MALE|FEMALE`
- `weight` — number, > 0, ≤ 200
- `club` — optional, string ≤ 120
- `rank` — optional `BoxerRank`, default `NONE`

`UpdateBoxerDto = PartialType(CreateBoxerDto)`.

### Applications

| Метод | Путь | Auth | Роль | Тело / Query | Ответ |
|---|---|---|---|---|---|
| `POST` | `/applications` | + | TRAINER | `{ tournamentId, items: [{ boxerId, category? }] }` | `201 { items: Application[] }` либо `400 { errors: [{ index, code, message }] }` (атомарно) |
| `GET` | `/applications/mine` | + | TRAINER | `?tournamentId&status&page&limit` | страница своих |
| `POST` | `/applications/:id/withdraw` | + | TRAINER | — | `200 Application` |
| `DELETE` | `/applications/:id` | + | TRAINER | — | `204` (только `WITHDRAWN|REJECTED`) |
| `GET` | `/tournaments/:id/applications` | + | ORGANIZER (владелец турнира) | `?status&page&limit` | страница заявок |
| `POST` | `/applications/:id/approve` | + | ORGANIZER (владелец турнира) | — | `200 Application` |
| `POST` | `/applications/:id/reject` | + | ORGANIZER (владелец турнира) | `{ reason? }` (≤ 500) | `200 Application` |

**Правила:**
- Все мутирующие операции, затрагивающие турнир (`POST /applications`, `withdraw`, `approve`, `reject`), требуют `tournament.status === PUBLISHED` И `tournament.dateStart > startOfDay(today, UTC)`. Если турнир `CANCELLED`, `DRAFT` или уже стартовал — `409`. (`DELETE` заявки в терминальном статусе — без проверки турнира.)
- Подача (`POST /applications`):
  - Все `boxerId` принадлежат тренеру. Иначе `400` с указанием индекса.
  - `category` (если передан) должна быть в `tournament.categories` и `boxer.weight ≤ category`. Иначе `400`.
  - Если `category` не передан — авто-подбор: минимальное значение из `tournament.categories`, такое что `boxer.weight ≤ value`. Если ничего не подходит — `400 BOXER_OVERWEIGHT`.
  - Уникальность `(boxerId, tournamentId)`. Дубль — `400 DUPLICATE`.
  - Транзакция all-or-nothing: при ошибке хоть одной строки — ни одна не создаётся, возвращается список ошибок.
- `withdraw`: только своя заявка, статус `PENDING|APPROVED`. Заполняет `withdrawnAt`.
- `approve`: только заявка на свой турнир, статус `PENDING`. Заполняет `decidedAt`.
- `reject`: только заявка на свой турнир, статус `PENDING`. Заполняет `decidedAt` и `rejectReason`.
- `DELETE`: только своя, статус `WITHDRAWN|REJECTED`. Иначе `409`.

**Коды ошибок в пакетной подаче (`error.code`):**
- `BOXER_NOT_FOUND` — чужой/несуществующий
- `BOXER_OVERWEIGHT` — авто-подбор не нашёл категорию
- `CATEGORY_NOT_IN_TOURNAMENT` — ручной override не входит в `tournament.categories`
- `WEIGHT_EXCEEDS_CATEGORY` — `boxer.weight > category`
- `DUPLICATE` — заявка на этого боксёра в этот турнир уже есть

**Ошибки HTTP:**
- `404` — чужой/несуществующий ресурс (как и в турнирах, не различаем).
- `403` — не та роль.
- `409` — невалидный переход статуса или операция после `dateStart`.

## Жизненный цикл заявки

```
       (TRAINER POST /applications, до dateStart)
                     │
                     ▼
                 PENDING ──── (ORGANIZER reject) ───▶ REJECTED ──┐
                  │  │                                            │
   (ORGANIZER     │  │   (TRAINER withdraw)                      │   DELETE
    approve)     │  └─────────────────────────────▶ WITHDRAWN ──┤  (только тренер,
                  ▼                                       ▲      │   только своя)
              APPROVED ──── (TRAINER withdraw) ──────────┘      │
                                                                 ▼
                                                            (запись удалена)
```

**Жёсткие правила:**
- Любой переход — только пока `tournament.dateStart > today` (UTC). Иначе `409`.
- `WITHDRAWN`/`REJECTED` — терминальные. Возврата в `PENDING` нет.
- `APPROVED → REJECTED` запрещён. Если организатор передумал — пишет тренеру, тот делает `withdraw`. Это упрощает аудит.
- После `dateStart` записи замораживаются: `APPROVED` идут на турнир.

## Авторизация

- `BoxersController` целиком — `JwtAuthGuard + RolesGuard + @Roles(TRAINER)`.
- `ApplicationsController`:
  - `POST /applications`, `withdraw`, `DELETE`, `GET /applications/mine` — `@Roles(TRAINER)`.
  - `GET /tournaments/:id/applications`, `approve`, `reject` — `@Roles(ORGANIZER)` + проверка `tournament.organizerId === user.id` (иначе 404).
- Доступ к `:id` боксёра/заявки — проверка владения в сервисе, иначе `404`.

## Изменения на фронте

**Создаются:**
- `shared/api/boxers.ts` — `boxersApi` с маппингом enum (gender, rank).
- `shared/api/applications.ts` — `applicationsApi` (submit пакетный, listMine, withdraw, listForTournament, approve, reject, remove).
- `shared/api/index.ts` — реэкспорт.
- `entities/boxer/`:
  - `model/types.ts` — `Boxer`, `Gender`, `BoxerRank`, `RANK_LABEL`, `GENDER_LABEL`, `computeAge(dob)`.
  - `ui/BoxerCard.tsx` — компактная карточка для списков.
- `entities/application/`:
  - `model/types.ts` — `Application`, `ApplicationStatus`, `STATUS_LABEL`, `STATUS_VARIANT`.
  - `ui/ApplicationStatusPill.tsx`.
- `features/boxer-form/ui/BoxerForm.tsx` + `model/useBoxerForm.ts` — переиспользуется в create и edit.
- `features/applications-submit/ui/ApplicationsSubmitDialog.tsx` + `model/useSubmitApplications.ts`.
- `features/applications-review/ui/ApplicationsTable.tsx` + `model/useApplicationsReview.ts`.
- `pages/register-boxer/ui/RegisterBoxerPage.tsx` + `index.ts`.
- `pages/boxer-profile/ui/BoxerProfilePage.tsx` + `index.ts` — карточка + edit/delete + список заявок этого боксёра.

**Меняются:**
- `shared/types/index.ts` — добавляются `Gender`, `BoxerRank`, `Boxer`, `Application`, `ApplicationStatus`.
- `pages/trainer-dashboard/ui/TrainerDashboardPage.tsx` — секции «Мои боксёры», «Мои заявки», «Открытые турниры» (с кнопкой «Подать заявку» → `ApplicationsSubmitDialog`).
- `pages/tournament-manage/ui/TournamentManagePage.tsx` — рефакторим под вкладочную структуру: появляется заголовок турнира (общий) и tab-bar `Информация | Участники`. Вкладка «Информация» — текущее содержимое (карточка + Edit/Publish/Cancel/Delete). Вкладка «Участники» — `ApplicationsTable` с фильтром по статусу. У вкладки рендерится счётчик `pending`. Default = «Информация».
- `app/router/AppRouter.tsx` — роуты `/boxers/new`, `/boxers/:id` за `RequireRole trainer`.

**НЕ трогаем:** auth-флоу, существующие виджеты топбара/сайдбара, ai-assistant (его нет), live-scoring, draw-generation. Их время позже.

**Состояние:** локальный `useState` + `useEffect`. React Query в этой итерации не вводим.

## Что НЕ входит в v1

- OCR паспорта, документы, файлы, фото боксёра.
- История боёв, рейтинг, статистика W-L.
- Медицинская справка (поле/срок/файл).
- Жеребьёвка/сетка/расписание/результаты.
- Email-уведомления о статусе заявки.
- Импорт боксёров CSV.
- Командные/клубные заявки (через юр. лицо клуба).
- Bulk approve/reject у организатора.
- Передача боксёра другому тренеру.
- Сводная таблица всех заявок организатора по всем своим турнирам (только в контексте конкретного турнира).
- Роль `BOXER` (личный кабинет спортсмена).
- AI-помощник.

## Верификация

### Backend (curl, расширение `boxr-api/scripts/`)

`scripts/test-boxers.sh` (≈8 проверок):
1. TRAINER POST `/boxers` → `201`
2. ORGANIZER POST → `403`
3. TRAINER GET `/boxers` видит свой
4. Чужой GET `/boxers/:id` → `404`
5. PATCH чужого → `404`
6. DELETE без активных заявок → `204`
7. DELETE с PENDING заявкой → `409`
8. Валидация: `weight: -1` → `400`, `dob` будущее → `400`

`scripts/test-applications.sh` (≈14 проверок):
1. Подача пакетом 3-х боксёров → `201`, все `PENDING`
2. Авто-категория: `weight=71` → `category=75`
3. Override `category=80` при `weight=71` → `201`
4. Override на категорию вне турнира → `400 CATEGORY_NOT_IN_TOURNAMENT`
5. Override на меньшую (`weight=80, category=75`) → `400 WEIGHT_EXCEEDS_CATEGORY`
6. Boxer overweight (`weight=95, max=92`) → `400 BOXER_OVERWEIGHT`
7. Повтор того же `boxer` на тот же турнир → `400 DUPLICATE`
8. Approve `PENDING` → `APPROVED`, `decidedAt` set
9. Reject с reason → `REJECTED`, `rejectReason` set
10. Approve уже `APPROVED` → `409`
11. Withdraw `PENDING` → `WITHDRAWN`
12. Withdraw `APPROVED` → `WITHDRAWN`
13. DELETE `WITHDRAWN` → `204`
14. После `dateStart`: approve → `409`

### Frontend (Playwright)

`e2e/boxers.spec.ts`:
1. Тренер регистрирует боксёра через форму → видит в списке.
2. Тренер редактирует боксёра → изменения сохраняются.
3. Тренер удаляет боксёра без заявок → пропадает.

`e2e/applications.spec.ts`:
1. Тренер подаёт пакетную заявку (3 боксёра, авто-категория) → у организатора три `PENDING`.
2. Тренер отзывает свою `PENDING` заявку → у организатора статус меняется на `WITHDRAWN`.
3. Организатор аппрувит → у тренера статус меняется на `APPROVED`.
4. Организатор отклоняет с причиной → тренер видит причину.
