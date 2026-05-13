# Judge Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать назначение судьи на матч: организатор назначает судью, судья видит список своих матчей и ведёт судейство через `/scoring/:matchId`.

**Architecture:** Добавляем связь `Match → User (judge)` в Prisma. Backend: новый эндпоинт назначения, открытие scoring-эндпоинтов для JUDGE (с проверкой `match.judgeId === user.id`), список матчей судьи. Frontend: JudgeDashboardPage со списком назначенных матчей, диалог назначения судьи в TournamentManagePage, обновление AppShell/AppRouter.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, React 19, Vite, TypeScript, CSS Modules, Vitest

---

### Task 1: Prisma — добавить judgeId в Match + миграция

**Files:**
- Modify: `boxr-api/prisma/schema.prisma`

- [ ] **Step 1: Добавить поле judgeId в модель Match**

В `schema.prisma` добавить в модель `Match` после поля `ring` (строка ~202):
```prisma
  judgeId       String?
  judge         User?         @relation("judgeMatches", fields: [judgeId], references: [id], onDelete: SetNull)
```

В модель `User` добавить после `applicationsAsTrainer`:
```prisma
  judgeMatches  Match[]       @relation("judgeMatches")
```

- [ ] **Step 2: Запустить миграцию**

```bash
cd boxr-api
npm run prisma:migrate
```
Ввести имя: `judge_assignment`

Ожидаемый результат: создаётся `prisma/migrations/..._judge_assignment/migration.sql` с `ALTER TABLE "Match" ADD COLUMN "judgeId" TEXT REFERENCES "User"("id") ON DELETE SET NULL`.

- [ ] **Step 3: Проверить что типы сгенерированы**

```bash
npm run prisma:generate
```

Ожидаемый результат: без ошибок. Тип `Match` теперь содержит `judgeId: string | null`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add judgeId to Match (Prisma)"
```

---

### Task 2: Backend — UsersController с GET /users/judges

**Files:**
- Modify: `boxr-api/src/users/users.service.ts`
- Create: `boxr-api/src/users/users.controller.ts`
- Modify: `boxr-api/src/users/users.module.ts`

- [ ] **Step 1: Добавить listJudges в UsersService**

В файл `boxr-api/src/users/users.service.ts` добавить метод после `create`:

```ts
listJudges(): Promise<{ id: string; fullName: string; email: string }[]> {
  return this.prisma.user.findMany({
    where: { role: Role.JUDGE },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  });
}
```

Добавить импорт Role в начало файла:
```ts
import { Role, User } from '@prisma/client';
```

- [ ] **Step 2: Создать UsersController**

Создать файл `boxr-api/src/users/users.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Get('judges')
  listJudges() {
    return this.service.listJudges();
  }
}
```

- [ ] **Step 3: Обновить UsersModule**

В `boxr-api/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 4: Проверить компиляцию**

```bash
cd boxr-api
npm run build 2>&1 | tail -20
```

Ожидаемый результат: `Successfully compiled`.

- [ ] **Step 5: Commit**

```bash
git add src/users/
git commit -m "feat: expose GET /users/judges for ORGANIZER"
```

---

### Task 3: Backend — эндпоинт assignJudge + judgeId в ответе bracket

**Files:**
- Create: `boxr-api/src/matches/dto/assign-judge.dto.ts`
- Modify: `boxr-api/src/matches/matches.service.ts`
- Modify: `boxr-api/src/matches/matches.controller.ts`

- [ ] **Step 1: Создать AssignJudgeDto**

Создать `boxr-api/src/matches/dto/assign-judge.dto.ts`:

```ts
import { IsUUID } from 'class-validator';

export class AssignJudgeDto {
  @IsUUID()
  judgeId!: string;
}
```

- [ ] **Step 2: Добавить judgeId в BracketResponseMatch**

В `matches.service.ts` найти интерфейс `BracketResponseMatch` (строка ~38) и добавить поле:

```ts
export interface BracketResponseMatch {
  id: string;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: BracketResponseBoxer | null;
  blue: BracketResponseBoxer | null;
  nextMatchId: string | null;
  nextSlot: 'RED' | 'BLUE' | null;
  scheduledAt: string | null;
  ring: number | null;
  judgeId: string | null;
  result: null | {
    winnerId: string;
    outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
    endRound: number | null;
    decidedAt: string;
  };
}
```

- [ ] **Step 3: Обновить buildBracketResponse — включить judgeId**

В `buildBracketResponse` (строка ~219) в маппинге матчей добавить `judgeId: m.judgeId` в объект:

```ts
matches: list.map((m) => ({
  id: m.id,
  round: m.round,
  position: m.position,
  status: m.status,
  red: m.redBoxer && { ... },
  blue: m.blueBoxer && { ... },
  nextMatchId: m.nextMatchId,
  nextSlot: m.nextSlot,
  scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
  ring: m.ring,
  judgeId: m.judgeId,
  result: ...
})),
```

- [ ] **Step 4: Добавить метод assignJudge в MatchesService**

В конец `MatchesService` (перед `insertCategoryBracket`) добавить:

```ts
async assignJudge(
  organizerId: string,
  tournamentId: string,
  matchId: string,
  judgeId: string,
): Promise<{ matchId: string; judgeId: string; judgeName: string }> {
  const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new NotFoundException('Турнир не найден');
  if (tournament.organizerId !== organizerId) throw new ForbiddenException('Доступ запрещён');

  const match = await this.prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new NotFoundException('Матч не найден');
  if (match.tournamentId !== tournamentId) throw new NotFoundException('Матч не найден');

  const judge = await this.prisma.user.findUnique({ where: { id: judgeId } });
  if (!judge || judge.role !== 'JUDGE') throw new NotFoundException('Судья не найден');

  await this.prisma.match.update({ where: { id: matchId }, data: { judgeId } });

  return { matchId, judgeId, judgeName: judge.fullName };
}
```

Добавить нужные импорты в начале файла (NotFoundException и ForbiddenException уже есть).

- [ ] **Step 5: Добавить endpoint в MatchesController**

В `matches.controller.ts` добавить импорт `AssignJudgeDto`:
```ts
import { AssignJudgeDto } from './dto/assign-judge.dto';
```

Добавить новый метод в класс после `clearSchedule`:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@Patch('tournaments/:id/matches/:matchId/assign-judge')
assignJudge(
  @CurrentUser() user: AuthUser,
  @Param('id', new ParseUUIDPipe()) tournamentId: string,
  @Param('matchId', new ParseUUIDPipe()) matchId: string,
  @Body() dto: AssignJudgeDto,
) {
  return this.service.assignJudge(user.id, tournamentId, matchId, dto.judgeId);
}
```

- [ ] **Step 6: Проверить компиляцию**

```bash
cd boxr-api
npm run build 2>&1 | tail -20
```

Ожидаемый результат: `Successfully compiled`.

- [ ] **Step 7: Commit**

```bash
git add src/matches/
git commit -m "feat: PATCH /tournaments/:id/matches/:matchId/assign-judge"
```

---

### Task 4: Backend — scoring открыт для JUDGE + GET /judge/matches

**Files:**
- Modify: `boxr-api/src/matches/matches.service.ts`
- Modify: `boxr-api/src/matches/matches.controller.ts`

- [ ] **Step 1: Добавить JudgeMatchResponse интерфейс**

В `matches.service.ts` добавить после `MatchForScoringResponse` (строка ~127):

```ts
export interface JudgeMatchItem {
  id: string;
  tournamentId: string;
  tournamentName: string;
  category: number;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: { fullName: string } | null;
  blue: { fullName: string } | null;
  scheduledAt: string | null;
  ring: number | null;
}
```

- [ ] **Step 2: Изменить сигнатуру getMatchForScoring**

Найти метод `getMatchForScoring` (строка ~720) и изменить сигнатуру + проверку доступа:

```ts
async getMatchForScoring(user: AuthUser, matchId: string): Promise<MatchForScoringResponse> {
  const match = await this.prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: { select: { id: true, name: true, rounds: true, roundDuration: true, organizerId: true } },
      redBoxer:  { select: { id: true, fullName: true, club: true, rank: true } },
      blueBoxer: { select: { id: true, fullName: true, club: true, rank: true } },
    },
  });
  if (!match) throw new NotFoundException('Матч не найден');

  if (user.role === 'ORGANIZER' && match.tournament.organizerId !== user.id) {
    throw new ForbiddenException('Доступ запрещён');
  }
  if (user.role === 'JUDGE' && match.judgeId !== user.id) {
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

Добавить импорт `AuthUser` в начало файла:
```ts
import { AuthUser } from '../common/types/auth-user';
```

- [ ] **Step 3: Изменить сигнатуру setResult**

Найти метод `setResult` (строка ~288) и заменить проверку `organizerId`:

Старая строка (в теле транзакции):
```ts
if (match.tournament.organizerId !== userId) {
  throw new ForbiddenException('Доступ запрещён');
}
```

Новая сигнатура и проверка:
```ts
async setResult(
  user: AuthUser,
  matchId: string,
  input: SetResultInput,
): Promise<BracketResponse> {
```

Внутри транзакции заменить проверку:
```ts
if (user.role === 'ORGANIZER' && match.tournament.organizerId !== user.id) {
  throw new ForbiddenException('Доступ запрещён');
}
if (user.role === 'JUDGE' && match.judgeId !== user.id) {
  throw new ForbiddenException('Доступ запрещён');
}
```

Везде внутри транзакции, где использовался `userId`, заменить на `user.id`.

- [ ] **Step 4: Добавить getMatchesForJudge**

В конец `MatchesService` добавить:

```ts
async getMatchesForJudge(judgeId: string): Promise<JudgeMatchItem[]> {
  const matches = await this.prisma.match.findMany({
    where: { judgeId },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      tournament: { select: { id: true, name: true } },
      redBoxer:  { select: { fullName: true } },
      blueBoxer: { select: { fullName: true } },
    },
  });
  return matches.map((m) => ({
    id: m.id,
    tournamentId: m.tournament.id,
    tournamentName: m.tournament.name,
    category: m.category,
    round: m.round,
    position: m.position,
    status: m.status,
    red: m.redBoxer ? { fullName: m.redBoxer.fullName } : null,
    blue: m.blueBoxer ? { fullName: m.blueBoxer.fullName } : null,
    scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
    ring: m.ring,
  }));
}
```

- [ ] **Step 5: Обновить контроллер**

В `matches.controller.ts`:

1. Изменить `getMatchForScoring` — передавать user вместо user.id и добавить JUDGE в роли:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.JUDGE)
@Get('matches/:matchId')
getMatchForScoring(
  @CurrentUser() user: AuthUser,
  @Param('matchId', new ParseUUIDPipe()) matchId: string,
) {
  return this.service.getMatchForScoring(user, matchId);
}
```

2. Изменить `setResult` — передавать user и добавить JUDGE:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.JUDGE)
@Patch('matches/:matchId')
setResult(
  @CurrentUser() user: AuthUser,
  @Param('matchId', new ParseUUIDPipe()) matchId: string,
  @Body() dto: SetMatchResultDto,
) {
  return this.service.setResult(user, matchId, dto);
}
```

3. Добавить новый эндпоинт:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.JUDGE)
@Get('judge/matches')
getMyMatches(@CurrentUser() user: AuthUser) {
  return this.service.getMatchesForJudge(user.id);
}
```

- [ ] **Step 6: Запустить тесты**

```bash
cd boxr-api
npm test
```

Ожидаемый результат: все тесты проходят (текущие spec файлы: bracket-builder.spec.ts, schedule-builder.spec.ts, ai.service.spec.ts).

- [ ] **Step 7: Commit**

```bash
git add src/matches/
git commit -m "feat: open scoring to JUDGE role, add GET /judge/matches"
```

---

### Task 5: Frontend — типы + API клиент

**Files:**
- Modify: `boxr/src/shared/types/index.ts`
- Modify: `boxr/src/shared/api/matches.ts`
- Create: `boxr/src/shared/api/users.ts`
- Modify: `boxr/src/shared/api/index.ts`

- [ ] **Step 1: Добавить типы в shared/types/index.ts**

В конец файла добавить:

```ts
export interface JudgeInfo {
  id: string;
  fullName: string;
  email: string;
}

export interface JudgeMatch {
  id: string;
  tournamentId: string;
  tournamentName: string;
  category: number;
  round: number;
  position: number;
  status: MatchStatus;
  red: { fullName: string } | null;
  blue: { fullName: string } | null;
  scheduledAt: string | null;
  ring: number | null;
}
```

Также добавить `judgeId` в `BracketMatch`:

```ts
export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  status: MatchStatus;
  red: MatchBoxer | null;
  blue: MatchBoxer | null;
  nextMatchId: string | null;
  nextSlot: MatchSlot | null;
  scheduledAt: string | null;
  ring: number | null;
  judgeId: string | null;
  result: MatchResult | null;
}
```

- [ ] **Step 2: Обновить API типы и функции в matches.ts**

В `ApiMatch` добавить поле `judgeId: string | null`:

```ts
type ApiMatch = {
  id: string;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: ApiBoxer | null;
  blue: ApiBoxer | null;
  nextMatchId: string | null;
  nextSlot: 'RED' | 'BLUE' | null;
  result: null | { ... };
  scheduledAt: string | null;
  ring: number | null;
  judgeId: string | null;
};
```

В `toMatch` добавить `judgeId: m.judgeId`.

Добавить тип и конвертер для JudgeMatch:

```ts
type ApiJudgeMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  category: number;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: { fullName: string } | null;
  blue: { fullName: string } | null;
  scheduledAt: string | null;
  ring: number | null;
};

const toJudgeMatch = (m: ApiJudgeMatch): JudgeMatch => ({
  ...m,
  status: m.status.toLowerCase() as JudgeMatch['status'],
});
```

Добавить импорт `JudgeMatch` из shared/types.

Добавить в `matchesApi`:

```ts
getMyMatches: () =>
  request<ApiJudgeMatch[]>('/judge/matches').then((list) => list.map(toJudgeMatch)),
assignJudge: (tournamentId: string, matchId: string, judgeId: string) =>
  request<{ matchId: string; judgeId: string; judgeName: string }>(
    `/tournaments/${tournamentId}/matches/${matchId}/assign-judge`,
    { method: 'PATCH', body: { judgeId } },
  ),
```

- [ ] **Step 3: Создать users.ts API**

Создать `boxr/src/shared/api/users.ts`:

```ts
import { request } from './client';

import type { JudgeInfo } from '../types';

export const usersApi = {
  listJudges: () => request<JudgeInfo[]>('/users/judges'),
};
```

- [ ] **Step 4: Обновить экспорты**

В `boxr/src/shared/api/index.ts` добавить:

```ts
export { usersApi } from './users';
```

Также обновить экспорт из matches (добавить `JudgeMatch` в типы из `../types` если нужно).

- [ ] **Step 5: Проверить типы**

```bash
cd boxr
npm run build 2>&1 | grep -E "error TS" | head -20
```

Ожидаемый результат: нет ошибок TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/shared/
git commit -m "feat: add JudgeMatch types + matchesApi/usersApi methods"
```

---

### Task 6: Frontend — JudgeDashboardPage

**Files:**
- Create: `boxr/src/pages/judge-dashboard/ui/JudgeDashboardPage.tsx`
- Create: `boxr/src/pages/judge-dashboard/ui/JudgeDashboardPage.module.css`
- Create: `boxr/src/pages/judge-dashboard/index.ts`

- [ ] **Step 1: Создать CSS модуль**

Создать `boxr/src/pages/judge-dashboard/ui/JudgeDashboardPage.module.css`:

```css
.page {
  min-height: 100vh;
  background: var(--paper-100);
}

.inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 64px 48px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 40px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  border: 1px solid var(--paper-300);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  background: var(--paper-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.cardInfo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.matchTitle {
  font-weight: 600;
  font-size: var(--text-base);
}

.matchMeta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-500);
  letter-spacing: 0.06em;
}

.statusPending  { color: var(--ink-400); }
.statusReady    { color: var(--ring-600); font-weight: 600; }
.statusCompleted { color: var(--ink-300); }

@media (max-width: 768px) {
  .inner {
    padding: 24px 16px;
  }

  .card {
    flex-direction: column;
    align-items: flex-start;
  }
}
```

- [ ] **Step 2: Создать JudgeDashboardPage**

Создать `boxr/src/pages/judge-dashboard/ui/JudgeDashboardPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { ApiError, matchesApi } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';

import s from './JudgeDashboardPage.module.css';

import type { JudgeMatch } from '@/shared/types';

const STATUS_LABEL: Record<string, string> = {
  pending:   'Ожидает',
  ready:     'Готов к судейству',
  completed: 'Завершён',
};

export const JudgeDashboardPage = () => {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<JudgeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    matchesApi
      .getMyMatches()
      .then(setMatches)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <div>
            <MonoLabel style={{ marginBottom: 16 }}>СУДЬЯ</MonoLabel>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginBottom: 8,
              }}
            >
              Здравствуйте, {user?.fullName}.
            </h1>
            <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-base)' }}>
              {user?.email}
            </p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>Выйти</Button>
        </header>

        <section>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            Назначенные бои
          </h2>

          {loading && (
            <p style={{ color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              Загрузка…
            </p>
          )}
          {error && <p style={{ color: 'var(--ring-600)' }}>{error}</p>}
          {!loading && !error && matches.length === 0 && (
            <p style={{ color: 'var(--ink-400)' }}>Вам пока не назначены бои.</p>
          )}

          {!loading && !error && matches.length > 0 && (
            <div className={s.list}>
              {matches.map((m) => (
                <div key={m.id} className={s.card}>
                  <div className={s.cardInfo}>
                    <div className={s.matchTitle}>
                      {m.red?.fullName ?? 'BYE'} vs {m.blue?.fullName ?? 'BYE'}
                    </div>
                    <div className={s.matchMeta}>
                      {m.tournamentName.toUpperCase()} · {m.category} кг · Р{m.round}
                      {m.scheduledAt
                        ? ` · ${new Date(m.scheduledAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
                        : ''}
                      {m.ring ? ` · Ринг ${m.ring}` : ''}
                    </div>
                    <div
                      className={
                        m.status === 'ready'
                          ? s.statusReady
                          : m.status === 'completed'
                            ? s.statusCompleted
                            : s.statusPending
                      }
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {STATUS_LABEL[m.status]}
                    </div>
                  </div>

                  {m.status === 'ready' && (
                    <Link
                      to={`/scoring/${m.id}`}
                      style={{
                        padding: '8px 20px',
                        background: 'var(--ring-600)',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        letterSpacing: '0.08em',
                        flexShrink: 0,
                      }}
                    >
                      НАЧАТЬ →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Создать barrel index**

Создать `boxr/src/pages/judge-dashboard/index.ts`:

```ts
export { JudgeDashboardPage } from './ui/JudgeDashboardPage';
```

- [ ] **Step 4: Проверить типы**

```bash
cd boxr
npm run build 2>&1 | grep -E "error TS" | head -10
```

Ожидаемый результат: нет ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/pages/judge-dashboard/
git commit -m "feat: JudgeDashboardPage — list of assigned matches"
```

---

### Task 7: Frontend — AppShell + AppRouter (JUDGE)

**Files:**
- Modify: `boxr/src/widgets/app-shell/ui/AppShell.tsx`
- Modify: `boxr/src/app/router/AppRouter.tsx`

- [ ] **Step 1: Добавить JUDGE в NAV_LINKS и ROOT_ROUTES AppShell**

В `AppShell.tsx` найти объект `NAV_LINKS` и добавить запись для judge:

```ts
const NAV_LINKS: Record<string, { label: string; href: string }[]> = {
  organizer: [
    { label: 'Мои турниры', href: '/dashboard' },
    { label: 'Создать турнир', href: '/tournaments/new' },
  ],
  trainer: [
    { label: 'Мои боксёры', href: '/trainer' },
    { label: 'Добавить боксёра', href: '/boxers/new' },
  ],
  judge: [
    { label: 'Мои бои', href: '/judge' },
  ],
};
```

Найти объект `ROOT_ROUTES` (константа с корневыми маршрутами для кнопки «назад») и добавить:

```ts
const ROOT_ROUTES: Record<string, string> = {
  organizer: '/dashboard',
  trainer: '/trainer',
  judge: '/judge',
};
```

- [ ] **Step 2: Обновить тест AppShell**

Найти тест `'nav-ссылки для TRAINER'` в `AppShell.test.tsx` — после него добавить новый тест:

```ts
it('nav-ссылки для JUDGE: Мои бои', async () => {
  const { useAuthContext } = await import('@/app/providers');
  vi.mocked(useAuthContext).mockReturnValue({
    user: { fullName: 'Судья', role: 'judge', email: 'j@test.com' },
    logout: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    register: vi.fn(),
    initializing: false,
  });
  mockMQ(true);
  renderShell('/judge');
  fireEvent.click(screen.getByLabelText('Открыть меню'));
  expect(screen.getByText('Мои бои')).toBeInTheDocument();
});
```

- [ ] **Step 3: Запустить тест AppShell**

```bash
cd boxr
npx vitest run src/widgets/app-shell/ui/AppShell.test.tsx
```

Ожидаемый результат: 7/7 passed.

- [ ] **Step 4: Обновить AppRouter**

В `AppRouter.tsx`:

1. Добавить импорт `JudgeDashboardPage`:
```ts
import { JudgeDashboardPage } from '@/pages/judge-dashboard';
```

2. Добавить маршрут `/judge`:
```tsx
<Route
  path="/judge"
  element={
    <RequireRole role="judge">
      <AppShell><JudgeDashboardPage /></AppShell>
    </RequireRole>
  }
/>
```

3. Изменить маршрут `/scoring/:matchId` — разрешить обе роли:
```tsx
<Route
  path="/scoring/:matchId"
  element={
    <RequireRole role={['organizer', 'judge']}>
      <AppShell><LiveScoringPage /></AppShell>
    </RequireRole>
  }
/>
```

- [ ] **Step 5: Проверить компиляцию**

```bash
cd boxr
npm run build 2>&1 | grep -E "error TS" | head -10
```

Ожидаемый результат: нет ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/app-shell/ src/app/router/AppRouter.tsx
git commit -m "feat: JUDGE nav + /judge route + scoring open to judge"
```

---

### Task 8: Frontend — диалог назначения судьи в TournamentManagePage

**Files:**
- Modify: `boxr/src/widgets/bracket-view/ui/MatchCard.tsx`
- Modify: `boxr/src/widgets/bracket-view/ui/BracketView.tsx`
- Create: `boxr/src/widgets/bracket-view/ui/AssignJudgeDialog.tsx`
- Modify: `boxr/src/widgets/bracket-view/index.ts`
- Modify: `boxr/src/pages/tournament-manage/ui/TournamentManagePage.tsx`

- [ ] **Step 1: Расширить MatchCard — prop onAssignJudge**

В `MatchCard.tsx` добавить `onAssignJudge?: (match: BracketMatch) => void` в интерфейс Props и кнопку под карточкой (рядом с LIVE):

```tsx
interface Props {
  match: BracketMatch;
  onClick?: (match: BracketMatch) => void;
  onAssignJudge?: (match: BracketMatch) => void;
}
```

После кнопки LIVE (внутри `return` после `{showLive && ...}`) добавить:

```tsx
{onAssignJudge && match.status !== 'completed' && (
  <button
    type="button"
    onClick={() => onAssignJudge(match)}
    style={{
      all: 'unset',
      display: 'inline-block',
      padding: '4px 10px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.08em',
      background: 'transparent',
      color: 'var(--ink-500)',
      border: '1px solid var(--paper-300)',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      textAlign: 'center',
      marginTop: 2,
    }}
  >
    {match.judgeId ? '✓ Судья' : 'Назначить судью'}
  </button>
)}
```

- [ ] **Step 2: Передать onAssignJudge через BracketView**

В `BracketView.tsx` добавить проп в интерфейс:

```ts
interface Props {
  bracket: Bracket;
  readOnly?: boolean;
  onMatchClick?: (match: BracketMatch) => void;
  onAssignJudge?: (match: BracketMatch) => void;
}
```

Передать `onAssignJudge` в `MatchCard`:

```tsx
<MatchCard
  key={match.id}
  match={match}
  onClick={readOnly ? undefined : onMatchClick}
  onAssignJudge={onAssignJudge}
/>
```

- [ ] **Step 3: Создать AssignJudgeDialog**

Создать `boxr/src/widgets/bracket-view/ui/AssignJudgeDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';

import { ApiError, matchesApi, usersApi } from '@/shared/api';

import type { BracketMatch } from '@/shared/types';
import type { JudgeInfo } from '@/shared/types';

interface Props {
  match: BracketMatch;
  tournamentId: string;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignJudgeDialog = ({ match, tournamentId, onClose, onAssigned }: Props) => {
  const [judges, setJudges] = useState<JudgeInfo[]>([]);
  const [selected, setSelected] = useState<string>(match.judgeId ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .listJudges()
      .then(setJudges)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await matchesApi.assignJudge(tournamentId, match.id, selected);
      onAssigned();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка назначения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,12,29,0.6)',
        zIndex: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--paper-100)',
          borderRadius: 'var(--radius-md)',
          padding: 32,
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
          }}
        >
          Назначить судью
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>
          {match.red?.fullName ?? 'BYE'} vs {match.blue?.fullName ?? 'BYE'}
        </div>

        {loading && (
          <p style={{ color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            Загрузка судей…
          </p>
        )}

        {!loading && judges.length === 0 && !error && (
          <p style={{ color: 'var(--ink-400)' }}>Нет зарегистрированных судей.</p>
        )}

        {!loading && judges.length > 0 && (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--paper-200)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
            }}
          >
            <option value="">— Выберите судью —</option>
            {judges.map((j) => (
              <option key={j.id} value={j.id}>
                {j.fullName} ({j.email})
              </option>
            ))}
          </select>
        )}

        {error && (
          <p style={{ color: 'var(--ring-600)', fontSize: 'var(--text-sm)' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              all: 'unset',
              padding: '8px 20px',
              border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selected || saving}
            style={{
              all: 'unset',
              padding: '8px 20px',
              background: selected && !saving ? 'var(--ink-900)' : 'var(--paper-300)',
              color: selected && !saving ? 'var(--paper-100)' : 'var(--ink-400)',
              borderRadius: 'var(--radius-sm)',
              cursor: selected && !saving ? 'pointer' : 'default',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            {saving ? 'Сохранение…' : 'Назначить'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Обновить экспорт bracket-view**

В `boxr/src/widgets/bracket-view/index.ts` добавить:

```ts
export { AssignJudgeDialog } from './ui/AssignJudgeDialog';
```

- [ ] **Step 5: Подключить диалог в TournamentManagePage**

В `TournamentManagePage.tsx`:

1. Добавить импорт:
```ts
import { BracketView, MatchResultDialog, AssignJudgeDialog } from '@/widgets/bracket-view';
```

2. Добавить состояние:
```ts
const [assignJudgeMatch, setAssignJudgeMatch] = useState<BracketMatch | null>(null);
```

3. В JSX, где рендерится `<BracketView>`, добавить проп:
```tsx
<BracketView
  bracket={bracket}
  onMatchClick={...}
  onAssignJudge={setAssignJudgeMatch}
/>
```

4. После `{activeMatch && <MatchResultDialog ... />}` добавить:
```tsx
{assignJudgeMatch && tournament && (
  <AssignJudgeDialog
    match={assignJudgeMatch}
    tournamentId={tournament.id}
    onClose={() => setAssignJudgeMatch(null)}
    onAssigned={() => {
      setAssignJudgeMatch(null);
      setBracketLoading(true);
      matchesApi
        .getBracket(tournament.id)
        .then(setBracket)
        .finally(() => setBracketLoading(false));
    }}
  />
)}
```

- [ ] **Step 6: Проверить компиляцию**

```bash
cd boxr
npm run build 2>&1 | grep -E "error TS" | head -10
```

Ожидаемый результат: нет ошибок.

- [ ] **Step 7: Запустить тесты Vitest**

```bash
cd boxr
npx vitest run
```

Ожидаемый результат: все тесты проходят (включая AppShell.test.tsx — 7 тестов).

- [ ] **Step 8: Commit**

```bash
git add src/widgets/bracket-view/ src/pages/tournament-manage/
git commit -m "feat: assign judge dialog in TournamentManagePage bracket view"
```

---

## Итоговый smoke-тест вручную

После всех задач:

1. Запустить базу данных: `cd boxr-api && docker compose up -d`
2. Запустить backend: `npm run start:dev`
3. Запустить frontend: `cd boxr && npm run dev`
4. Зарегистрировать организатора, создать турнир, добавить участников
5. Зарегистрировать судью (роль judge при регистрации)
6. Организатор: опубликовать турнир, сгенерировать сетку, назначить судью на матч через диалог в bracket-вкладке
7. Судья: войти в систему, увидеть список матчей на `/judge`, открыть `/scoring/:matchId` и ввести результат
8. Организатор: убедиться, что результат зафиксирован в сетке
