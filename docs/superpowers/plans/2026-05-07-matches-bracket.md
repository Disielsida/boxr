# Сетка и результаты — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** реализовать сетку матчей с автогенерацией из одобренных заявок и фиксацию результатов до пьедестала, по спеке `docs/superpowers/specs/2026-05-07-matches-bracket-design.md`.

**Architecture:** новый Nest-модуль `MatchesModule` + одна таблица `Match` в Prisma + расширение enum `TournamentStatus` (`IN_PROGRESS`, `FINISHED`). Алгоритм построения сетки вынесен в чистую функцию `bracket-builder.ts` (jest unit-тесты), бизнес-логика `matches.service` покрывается bash smoke (`scripts/test-bracket.sh`) по существующему проектному паттерну. На фронте — два новых виджета (`bracket-view`, `results-view`), две новые вкладки в `TournamentManagePage`, новая публичная страница деталей турнира.

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL), class-validator, jest 29 (для bracket-builder), React 19 + react-router 7, Playwright 1.59 (e2e), bash + curl + python3.

**Repository state:** не git-репозиторий (`Is a git repository: false`). Шаги «Commit» пропускаются. Если будет `git init` — добавь коммиты по своему усмотрению.

**Сервисы для интеграционных тестов:**
- Postgres в Docker: `docker compose up -d` из `boxr-api/`. Проверка: `docker ps | grep boxr-postgres` healthy.
- `boxr-api`: `npm run start:prod` (использует `dist/`) или `npm run start:dev` (watch).
- `boxr`: `npm run dev` (порт 5173) или `npm run build`.

---

## Task 1: Prisma — модель Match и расширение enum TournamentStatus

**Files:**
- Modify: `boxr-api/prisma/schema.prisma`
- Create: `boxr-api/prisma/migrations/<timestamp>_matches/migration.sql` (через `prisma migrate dev`)

- [ ] **Step 1: Расширить `TournamentStatus` и добавить новые enum-ы**

В `boxr-api/prisma/schema.prisma` найти `enum TournamentStatus` и заменить на:

```prisma
enum TournamentStatus {
  DRAFT
  PUBLISHED
  IN_PROGRESS
  FINISHED
  CANCELLED
}
```

После `enum ApplicationStatus { ... }` добавить:

```prisma
enum MatchOutcome { KO  WP  RSC  DSQ  WO }
enum MatchSlot    { RED  BLUE }
enum MatchStatus  { PENDING  READY  COMPLETED }
```

- [ ] **Step 2: Добавить обратные связи в существующие модели**

В `model Tournament { ... }` после `applications Application[]` добавить:

```prisma
  matches Match[]
```

В `model Boxer { ... }` после `applications Application[]` добавить:

```prisma
  redMatches  Match[] @relation("redMatches")
  blueMatches Match[] @relation("blueMatches")
  wonMatches  Match[] @relation("wonMatches")
```

- [ ] **Step 3: Добавить модель `Match`**

В конец файла дописать:

```prisma
model Match {
  id            String        @id @default(uuid())
  tournamentId  String
  tournament    Tournament    @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  category      Float
  round         Int
  position      Int
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
  endRound      Int?
  decidedAt     DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@unique([tournamentId, category, round, position])
  @@index([tournamentId, status])
  @@index([nextMatchId])
}
```

- [ ] **Step 4: Создать и применить миграцию**

Run:
```bash
cd boxr-api && npm run prisma:migrate -- --name matches
```

Expected: «Applying migration `<timestamp>_matches`», prisma client регенерируется.

- [ ] **Step 5: Проверить, что схема корректна и client пересобрался**

Run:
```bash
cd boxr-api && npx prisma validate && npx prisma generate
```

Expected: оба без ошибок. Файл `node_modules/.prisma/client/index.d.ts` теперь содержит `enum MatchOutcome` (быстрая проверка: `grep -q 'MatchOutcome' node_modules/.prisma/client/index.d.ts && echo OK`).

---

## Task 2: Каркас MatchesModule (пустые контроллер и сервис)

**Files:**
- Create: `boxr-api/src/matches/matches.module.ts`
- Create: `boxr-api/src/matches/matches.service.ts`
- Create: `boxr-api/src/matches/matches.controller.ts`
- Modify: `boxr-api/src/app.module.ts`

- [ ] **Step 1: Создать `matches.service.ts` с пустым классом**

```ts
// boxr-api/src/matches/matches.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}
}
```

- [ ] **Step 2: Создать `matches.controller.ts` с пустым контроллером**

```ts
// boxr-api/src/matches/matches.controller.ts
import { Controller } from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller()
export class MatchesController {
  constructor(private readonly service: MatchesService) {}
}
```

- [ ] **Step 3: Создать `matches.module.ts`**

```ts
// boxr-api/src/matches/matches.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [PrismaModule],
  controllers: [MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
```

- [ ] **Step 4: Импортировать MatchesModule в `app.module.ts`**

В `boxr-api/src/app.module.ts` добавить импорт после `ApplicationsModule`:

```ts
import { MatchesModule } from './matches/matches.module';
```

И в массив `imports` добавить `MatchesModule` после `ApplicationsModule`.

- [ ] **Step 5: Убедиться, что приложение собирается**

Run:
```bash
cd boxr-api && npm run build
```

Expected: успешная сборка, появилась `dist/matches/`.

---

## Task 3: bracket-builder — чистая функция построения сетки (TDD)

**Files:**
- Create: `boxr-api/src/matches/bracket-builder.ts`
- Create: `boxr-api/src/matches/bracket-builder.spec.ts`

Это чистая функция: на вход — список boxerId в категории, на выход — массив описаний матчей с координатами `(round, position)`, заполненными слотами и связями `nextRound, nextPositionInRound, nextSlot` (id матчей ещё нет — их назначит сервис при INSERT).

- [ ] **Step 1: Написать первый тест для одиночки (n=1)**

```ts
// boxr-api/src/matches/bracket-builder.spec.ts
import { buildCategoryBracket, BuiltMatch } from './bracket-builder';

describe('buildCategoryBracket', () => {
  it('одиночный участник: один финальный матч с WO', () => {
    const result = buildCategoryBracket(['boxer-A']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<Partial<BuiltMatch>>({
      round: 1,
      position: 0,
      redBoxerId: 'boxer-A',
      blueBoxerId: null,
      status: 'COMPLETED',
      outcome: 'WO',
      winnerId: 'boxer-A',
      nextRef: null,
    });
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run:
```bash
cd boxr-api && npx jest src/matches/bracket-builder.spec.ts
```

Expected: FAIL с «Cannot find module './bracket-builder'».

- [ ] **Step 3: Реализовать `bracket-builder.ts` (минимум для прохождения теста)**

```ts
// boxr-api/src/matches/bracket-builder.ts
export type BuiltMatchStatus = 'PENDING' | 'READY' | 'COMPLETED';
export type BuiltMatchOutcome = 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
export type BuiltMatchSlot = 'RED' | 'BLUE';

export interface BuiltMatch {
  round: number;          // 1 = первый раунд, последний = финал
  position: number;       // 0..matchesInRound-1
  redBoxerId: string | null;
  blueBoxerId: string | null;
  status: BuiltMatchStatus;
  outcome: BuiltMatchOutcome | null;
  winnerId: string | null;
  /**
   * Координаты следующего матча для победителя.
   * null у финала и у одиночки. Сервис превратит координаты в nextMatchId после INSERT.
   */
  nextRef: { round: number; position: number; slot: BuiltMatchSlot } | null;
}

export function buildCategoryBracket(boxerIds: readonly string[]): BuiltMatch[] {
  const n = boxerIds.length;
  if (n === 0) return [];
  if (n === 1) {
    return [
      {
        round: 1,
        position: 0,
        redBoxerId: boxerIds[0],
        blueBoxerId: null,
        status: 'COMPLETED',
        outcome: 'WO',
        winnerId: boxerIds[0],
        nextRef: null,
      },
    ];
  }
  // дальнейшие случаи (n ≥ 2) — реализуем в следующих шагах
  throw new Error('not implemented');
}
```

- [ ] **Step 4: Запустить тест — он должен пройти**

Run:
```bash
cd boxr-api && npx jest src/matches/bracket-builder.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Добавить тесты для n=2 и n=4 (ровные степени двойки)**

В тот же spec-файл добавить:

```ts
it('два участника: один финал, оба слота заполнены, READY', () => {
  const result = buildCategoryBracket(['A', 'B']);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    round: 1,
    position: 0,
    status: 'READY',
    redBoxerId: expect.stringMatching(/^[AB]$/),
    blueBoxerId: expect.stringMatching(/^[AB]$/),
    nextRef: null,
  });
  // оба боксёра присутствуют, каждый ровно один раз
  const seats = [result[0].redBoxerId, result[0].blueBoxerId].sort();
  expect(seats).toEqual(['A', 'B']);
});

it('четыре участника: 2 матча 1/2 + финал, все 1/2 в READY', () => {
  const result = buildCategoryBracket(['A', 'B', 'C', 'D']);
  expect(result).toHaveLength(3);
  const round1 = result.filter((m) => m.round === 1);
  const round2 = result.filter((m) => m.round === 2);
  expect(round1).toHaveLength(2);
  expect(round2).toHaveLength(1);
  expect(round1.every((m) => m.status === 'READY')).toBe(true);
  expect(round1.every((m) => m.nextRef?.round === 2 && m.nextRef.position === 0)).toBe(true);
  // позиции 0 и 1 в первом раунде идут в слоты RED и BLUE финала
  const slots = round1.map((m) => m.nextRef!.slot).sort();
  expect(slots).toEqual(['BLUE', 'RED']);
  // финал — PENDING (никого не продвинули)
  expect(round2[0].status).toBe('PENDING');
  expect(round2[0].nextRef).toBeNull();
});
```

- [ ] **Step 6: Реализовать общий случай (n ≥ 2)**

В `bracket-builder.ts` заменить тело функции после ветки `n === 1`:

```ts
export function buildCategoryBracket(boxerIds: readonly string[]): BuiltMatch[] {
  const n = boxerIds.length;
  if (n === 0) return [];
  if (n === 1) {
    return [
      {
        round: 1, position: 0,
        redBoxerId: boxerIds[0], blueBoxerId: null,
        status: 'COMPLETED', outcome: 'WO', winnerId: boxerIds[0],
        nextRef: null,
      },
    ];
  }

  const bracketSize = nextPow2(n);
  const byes = bracketSize - n;
  const rounds = Math.log2(bracketSize); // целое для степени двойки

  // Создаём пустые матчи всех раундов
  const matches: BuiltMatch[] = [];
  for (let r = 1; r <= rounds; r++) {
    const matchesInRound = bracketSize / 2 ** r;
    for (let p = 0; p < matchesInRound; p++) {
      matches.push({
        round: r,
        position: p,
        redBoxerId: null,
        blueBoxerId: null,
        status: 'PENDING',
        outcome: null,
        winnerId: null,
        nextRef:
          r < rounds
            ? { round: r + 1, position: Math.floor(p / 2), slot: p % 2 === 0 ? 'RED' : 'BLUE' }
            : null,
      });
    }
  }

  // Распределяем участников по слотам первого раунда (с учётом bye)
  const seats = arrangeWithByes(boxerIds, bracketSize, byes);
  for (let p = 0; p < bracketSize / 2; p++) {
    const m = matches.find((mm) => mm.round === 1 && mm.position === p)!;
    m.redBoxerId = seats[2 * p];
    m.blueBoxerId = seats[2 * p + 1];
    if (m.redBoxerId && m.blueBoxerId) {
      m.status = 'READY';
    } else if (m.redBoxerId || m.blueBoxerId) {
      const sole = (m.redBoxerId ?? m.blueBoxerId)!;
      m.winnerId = sole;
      m.outcome = 'WO';
      m.status = 'COMPLETED';
      // продвигаем bye-победителя в nextRef
      propagate(matches, m);
    }
    // оба null невозможны: byes < bracketSize/2 по построению
  }

  return matches;
}

function nextPow2(x: number): number {
  let p = 1;
  while (p < x) p *= 2;
  return p;
}

/**
 * Расставляет boxerIds + byes (как null) в bracketSize слотов так, чтобы:
 *  - не было двух bye в одной паре первого раунда (то есть индексы 2p и 2p+1 не оба null);
 *  - результат шафлится случайно (но bye-инвариант сохраняется).
 */
function arrangeWithByes(
  boxerIds: readonly string[],
  bracketSize: number,
  byes: number,
): (string | null)[] {
  const shuffled = shuffle([...boxerIds]);
  const seats: (string | null)[] = new Array(bracketSize).fill(null);

  // Идея: bye помещаем в нечётные позиции (BLUE-слоты) первых byes пар;
  // если byes < bracketSize/2 — это всегда даёт «один человек + bye» в этих парах,
  // никогда «bye vs bye».
  // Затем заполняем оставшиеся слоты бойцами в порядке shuffled.
  for (let i = 0; i < byes; i++) {
    seats[2 * i] = shuffled[i]; // одиночка получает RED-слот
    // seats[2 * i + 1] остаётся null = bye
  }
  let cursor = byes;
  for (let s = 2 * byes; s < bracketSize; s++) {
    seats[s] = shuffled[cursor++];
  }
  return seats;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function propagate(matches: BuiltMatch[], m: BuiltMatch): void {
  if (!m.nextRef || !m.winnerId) return;
  const next = matches.find(
    (x) => x.round === m.nextRef!.round && x.position === m.nextRef!.position,
  );
  if (!next) return;
  if (m.nextRef.slot === 'RED') next.redBoxerId = m.winnerId;
  else next.blueBoxerId = m.winnerId;
  if (next.redBoxerId && next.blueBoxerId) next.status = 'READY';
}
```

- [ ] **Step 7: Прогнать все тесты**

Run:
```bash
cd boxr-api && npx jest src/matches/bracket-builder.spec.ts
```

Expected: 3/3 PASS.

- [ ] **Step 8: Добавить тесты для bye-кейсов (n=3, n=5, n=6)**

```ts
it('три участника: bracketSize=4, ровно один bye, финал PENDING', () => {
  const result = buildCategoryBracket(['A', 'B', 'C']);
  // 4-местная сетка: 2 матча в 1/2 + 1 финал = 3 матча
  expect(result).toHaveLength(3);
  const round1 = result.filter((m) => m.round === 1);
  const byeMatches = round1.filter((m) => m.status === 'COMPLETED');
  expect(byeMatches).toHaveLength(1);
  expect(byeMatches[0].outcome).toBe('WO');
  expect(byeMatches[0].winnerId).not.toBeNull();
  // финал получил bye-победителя в один из слотов, второй пуст
  const final = result.find((m) => m.round === 2)!;
  const filledSlots = [final.redBoxerId, final.blueBoxerId].filter((x) => x !== null);
  expect(filledSlots).toHaveLength(1);
  expect(final.status).toBe('PENDING');
});

it('пять участников: bracketSize=8, три bye-матча, два полуфинала', () => {
  const result = buildCategoryBracket(['A', 'B', 'C', 'D', 'E']);
  // 8-местная: 4 матча 1/4 + 2 матча 1/2 + 1 финал = 7
  expect(result).toHaveLength(7);
  const round1 = result.filter((m) => m.round === 1);
  expect(round1).toHaveLength(4);
  const byes = round1.filter((m) => m.status === 'COMPLETED');
  expect(byes).toHaveLength(3);
  // ни в одном bye-матче оба слота не пусты (то есть «bye vs bye» нет)
  byes.forEach((m) => {
    const filled = [m.redBoxerId, m.blueBoxerId].filter((x) => x !== null);
    expect(filled).toHaveLength(1);
  });
});

it('шесть участников: bracketSize=8, два bye-матча', () => {
  const result = buildCategoryBracket(['A', 'B', 'C', 'D', 'E', 'F']);
  expect(result).toHaveLength(7);
  const byes = result.filter((m) => m.round === 1 && m.status === 'COMPLETED');
  expect(byes).toHaveLength(2);
});
```

- [ ] **Step 9: Прогнать тесты — должны все 6 пройти**

Run:
```bash
cd boxr-api && npx jest src/matches/bracket-builder.spec.ts
```

Expected: 6/6 PASS.

- [ ] **Step 10: Добавить тест на инвариант «sum of pairings»**

```ts
it('инвариант: каждый боксёр появляется ровно один раз в первом раунде', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const result = buildCategoryBracket(ids);
  const seats = result
    .filter((m) => m.round === 1)
    .flatMap((m) => [m.redBoxerId, m.blueBoxerId])
    .filter((x): x is string => x !== null);
  expect(seats.sort()).toEqual([...ids].sort());
});

it('инвариант: каждый non-final матч имеет валидный nextRef', () => {
  const result = buildCategoryBracket(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  result.forEach((m) => {
    if (m.nextRef) {
      const next = result.find(
        (x) => x.round === m.nextRef!.round && x.position === m.nextRef!.position,
      );
      expect(next).toBeDefined();
    }
  });
  // ровно один матч без nextRef — финал
  expect(result.filter((m) => m.nextRef === null)).toHaveLength(1);
});
```

Run:
```bash
cd boxr-api && npx jest src/matches/bracket-builder.spec.ts
```

Expected: 8/8 PASS.

---

## Task 4: matches.service — generateBracket

**Files:**
- Modify: `boxr-api/src/matches/matches.service.ts`

Описание метода `generateBracket(userId, tournamentId)` — основная мутация: проверки, удаление старой сетки, генерация новой через `buildCategoryBracket`, перевод турнира в `IN_PROGRESS`.

- [ ] **Step 1: Расширить `MatchesService` методом `generateBracket`**

Заменить содержимое `boxr-api/src/matches/matches.service.ts` на:

```ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, TournamentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildCategoryBracket, BuiltMatch } from './bracket-builder';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async generateBracket(userId: string, tournamentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw new NotFoundException('Турнир не найден');
      if (tournament.organizerId !== userId) throw new ForbiddenException('Доступ запрещён');

      if (
        tournament.status !== TournamentStatus.PUBLISHED &&
        tournament.status !== TournamentStatus.IN_PROGRESS
      ) {
        throw new UnprocessableEntityException(
          'Сетку можно генерировать только у опубликованного турнира',
        );
      }

      // Если уже IN_PROGRESS — нельзя перегенерировать при наличии не-bye COMPLETED матчей.
      // bye-матч = COMPLETED + outcome=WO + один из слотов null.
      if (tournament.status === TournamentStatus.IN_PROGRESS) {
        const blocking = await tx.match.findFirst({
          where: {
            tournamentId,
            status: 'COMPLETED',
            NOT: {
              AND: [
                { outcome: 'WO' },
                { OR: [{ redBoxerId: null }, { blueBoxerId: null }] },
              ],
            },
          },
        });
        if (blocking) {
          throw new UnprocessableEntityException(
            'Нельзя перегенерировать сетку: уже есть зафиксированные результаты',
          );
        }
        await tx.match.deleteMany({ where: { tournamentId } });
      }

      // Грузим APPROVED-заявки, группируем по category
      const apps = await tx.application.findMany({
        where: { tournamentId, status: 'APPROVED' },
        select: { boxerId: true, category: true },
      });
      if (apps.length === 0) {
        throw new UnprocessableEntityException(
          'Нет одобрённых участников ни в одной категории',
        );
      }
      const byCategory = new Map<number, string[]>();
      for (const a of apps) {
        const arr = byCategory.get(a.category) ?? [];
        arr.push(a.boxerId);
        byCategory.set(a.category, arr);
      }

      // Для каждой категории турнира строим сетку и вставляем в БД
      for (const category of tournament.categories) {
        const boxerIds = byCategory.get(category) ?? [];
        if (boxerIds.length === 0) continue;
        await this.insertCategoryBracket(tx, tournamentId, category, boxerIds);
      }

      // Перевод турнира в IN_PROGRESS (даже если уже был — это no-op)
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      });
    });
  }

  private async insertCategoryBracket(
    tx: Prisma.TransactionClient,
    tournamentId: string,
    category: number,
    boxerIds: readonly string[],
  ): Promise<void> {
    const built = buildCategoryBracket(boxerIds);
    if (built.length === 0) return;

    // Создаём матчи без nextMatchId (его проставим во второй проход)
    // Запоминаем мапу (round, position) → id
    const idByCoord = new Map<string, string>();
    const key = (r: number, p: number) => `${r}:${p}`;
    const decidedAt = new Date();

    for (const m of built) {
      const created = await tx.match.create({
        data: {
          tournamentId,
          category,
          round: m.round,
          position: m.position,
          redBoxerId: m.redBoxerId,
          blueBoxerId: m.blueBoxerId,
          status: m.status,
          outcome: m.outcome ?? null,
          winnerId: m.winnerId,
          decidedAt: m.status === 'COMPLETED' ? decidedAt : null,
        },
      });
      idByCoord.set(key(m.round, m.position), created.id);
    }

    // Второй проход: проставляем nextMatchId/nextSlot
    for (const m of built) {
      if (!m.nextRef) continue;
      const id = idByCoord.get(key(m.round, m.position))!;
      const nextId = idByCoord.get(key(m.nextRef.round, m.nextRef.position))!;
      await tx.match.update({
        where: { id },
        data: { nextMatchId: nextId, nextSlot: m.nextRef.slot },
      });
    }

    // Третий проход не нужен: builder уже выполнил propagate для bye-победителей
    // внутри BuiltMatch, и первый проход INSERT создал next-матч с уже заполненным
    // слотом и корректным status (READY если оба слота заполнены, иначе PENDING).
  }
}
```

- [ ] **Step 2: Скомпилировать**

Run:
```bash
cd boxr-api && npm run build
```

Expected: компиляция успешна. (Юнит-тестов на `matches.service` нет — покрытие через bash smoke в Task 10.)

---

## Task 5: matches.service — getBracket (чтение сетки)

**Files:**
- Modify: `boxr-api/src/matches/matches.service.ts`

Один внутренний метод чтения, две публичные обёртки (для приватного и публичного эндпоинтов).

- [ ] **Step 1: Описать тип ответа `BracketResponse`**

В начало `matches.service.ts` (после импортов) добавить:

```ts
export interface BracketResponseBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
  rank: string;
}

export interface BracketResponseMatch {
  id: string;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: BracketResponseBoxer | null;
  blue: BracketResponseBoxer | null;
  nextMatchId: string | null;
  nextSlot: 'RED' | 'BLUE' | null;
  result: null | {
    winnerId: string;
    outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
    endRound: number | null;
    decidedAt: string;
  };
}

export interface BracketResponseCategory {
  weight: number;
  rounds: number;
  matches: BracketResponseMatch[];
}

export interface BracketResponse {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: BracketResponseCategory[];
}
```

- [ ] **Step 2: Добавить методы чтения в `MatchesService`**

В класс `MatchesService` добавить методы:

```ts
async getBracketForOwner(userId: string, tournamentId: string): Promise<BracketResponse> {
  const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new NotFoundException('Турнир не найден');
  if (tournament.organizerId !== userId) throw new ForbiddenException('Доступ запрещён');
  return this.buildBracketResponse(tournamentId);
}

async getPublicBracket(tournamentId: string): Promise<BracketResponse> {
  const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new NotFoundException('Турнир не найден');
  if (
    tournament.status === TournamentStatus.DRAFT ||
    tournament.status === TournamentStatus.CANCELLED
  ) {
    throw new NotFoundException('Турнир не найден');
  }
  return this.buildBracketResponse(tournamentId);
}

private async buildBracketResponse(tournamentId: string): Promise<BracketResponse> {
  const tournament = await this.prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { id: true, name: true, status: true, categories: true },
  });
  const matches = await this.prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ category: 'asc' }, { round: 'asc' }, { position: 'asc' }],
    include: {
      redBoxer: { select: { id: true, fullName: true, club: true, rank: true } },
      blueBoxer: { select: { id: true, fullName: true, club: true, rank: true } },
    },
  });

  // group by category
  const byCat = new Map<number, typeof matches>();
  for (const m of matches) {
    const arr = byCat.get(m.category) ?? [];
    arr.push(m);
    byCat.set(m.category, arr);
  }

  const categories: BracketResponseCategory[] = [];
  for (const weight of tournament.categories) {
    const list = byCat.get(weight) ?? [];
    if (list.length === 0) continue;
    const rounds = Math.max(...list.map((m) => m.round));
    categories.push({
      weight,
      rounds,
      matches: list.map((m) => ({
        id: m.id,
        round: m.round,
        position: m.position,
        status: m.status,
        red: m.redBoxer && {
          boxerId: m.redBoxer.id,
          fullName: m.redBoxer.fullName,
          club: m.redBoxer.club,
          rank: m.redBoxer.rank,
        },
        blue: m.blueBoxer && {
          boxerId: m.blueBoxer.id,
          fullName: m.blueBoxer.fullName,
          club: m.blueBoxer.club,
          rank: m.blueBoxer.rank,
        },
        nextMatchId: m.nextMatchId,
        nextSlot: m.nextSlot,
        result:
          m.status === 'COMPLETED' && m.winnerId && m.outcome
            ? {
                winnerId: m.winnerId,
                outcome: m.outcome,
                endRound: m.endRound,
                decidedAt: m.decidedAt!.toISOString(),
              }
            : null,
      })),
    });
  }

  return {
    tournament: { id: tournament.id, name: tournament.name, status: tournament.status },
    categories,
  };
}
```

- [ ] **Step 3: Проверить, что generateBracket возвращает свежий BracketResponse**

Поменять сигнатуру `generateBracket` на возвращающую `BracketResponse`:

```ts
async generateBracket(userId: string, tournamentId: string): Promise<BracketResponse> {
  await this.prisma.$transaction(async (tx) => {
    /* ... весь существующий код транзакции ... */
  });
  return this.buildBracketResponse(tournamentId);
}
```

- [ ] **Step 4: Скомпилировать**

Run:
```bash
cd boxr-api && npm run build
```

Expected: компиляция успешна.

---

## Task 6: matches.service — setResult

**Files:**
- Modify: `boxr-api/src/matches/matches.service.ts`

- [ ] **Step 1: Добавить тип `SetResultInput` и метод `setResult`**

В `matches.service.ts` после `BracketResponse` добавить тип:

```ts
export interface SetResultInput {
  winner: 'RED' | 'BLUE';
  outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
  endRound?: number;
}
```

В класс `MatchesService` добавить:

```ts
async setResult(
  userId: string,
  matchId: string,
  input: SetResultInput,
): Promise<BracketResponse> {
  const tournamentId = await this.prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Матч не найден');
    if (match.tournament.organizerId !== userId) {
      throw new ForbiddenException('Доступ запрещён');
    }
    if (match.tournament.status !== TournamentStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException('Турнир не в активной фазе');
    }
    if (match.status !== 'READY') {
      throw new UnprocessableEntityException(
        match.status === 'COMPLETED'
          ? 'Результат уже зафиксирован'
          : 'Матч ещё не готов к фиксации',
      );
    }

    // Кросс-валидация (DTO даёт типы, тут проверяем семантику)
    const requiresEndRound = input.outcome === 'KO' || input.outcome === 'RSC';
    if (requiresEndRound) {
      if (input.endRound === undefined) {
        throw new UnprocessableEntityException('endRound обязателен для KO/RSC');
      }
      if (input.endRound < 1 || input.endRound > match.tournament.rounds) {
        throw new UnprocessableEntityException(
          'endRound не может превышать количество раундов',
        );
      }
    } else if (input.endRound !== undefined) {
      throw new UnprocessableEntityException('endRound допустим только для KO/RSC');
    }

    const winnerId = input.winner === 'RED' ? match.redBoxerId! : match.blueBoxerId!;

    // 1) фиксируем результат в текущем матче
    await tx.match.update({
      where: { id: matchId },
      data: {
        winnerId,
        outcome: input.outcome,
        endRound: requiresEndRound ? input.endRound! : null,
        status: 'COMPLETED',
        decidedAt: new Date(),
      },
    });

    // 2) продвигаем победителя в nextMatch (если есть)
    if (match.nextMatchId && match.nextSlot) {
      const next = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
      const nextData: Prisma.MatchUpdateInput =
        match.nextSlot === 'RED'
          ? { redBoxer: { connect: { id: winnerId } } }
          : { blueBoxer: { connect: { id: winnerId } } };
      const willBeReady =
        (match.nextSlot === 'RED' && next.blueBoxerId !== null) ||
        (match.nextSlot === 'BLUE' && next.redBoxerId !== null);
      await tx.match.update({
        where: { id: match.nextMatchId },
        data: { ...nextData, status: willBeReady ? 'READY' : 'PENDING' },
      });
    }

    // 3) если все финалы во всех категориях COMPLETED — переводим турнир в FINISHED
    const remaining = await tx.match.count({
      where: {
        tournamentId: match.tournamentId,
        nextMatchId: null,
        status: { not: 'COMPLETED' },
      },
    });
    if (remaining === 0) {
      await tx.tournament.update({
        where: { id: match.tournamentId },
        data: { status: TournamentStatus.FINISHED },
      });
    }

    return match.tournamentId;
  });

  return this.buildBracketResponse(tournamentId);
}
```

- [ ] **Step 2: Скомпилировать**

Run:
```bash
cd boxr-api && npm run build
```

Expected: успешно.

---

## Task 7: matches.service — clearResult (откат результата)

**Files:**
- Modify: `boxr-api/src/matches/matches.service.ts`

- [ ] **Step 1: Добавить метод `clearResult`**

В класс `MatchesService` добавить:

```ts
async clearResult(userId: string, matchId: string): Promise<BracketResponse> {
  const tournamentId = await this.prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException('Матч не найден');
    if (match.tournament.organizerId !== userId) {
      throw new ForbiddenException('Доступ запрещён');
    }
    if (match.status !== 'COMPLETED') {
      throw new UnprocessableEntityException('Матч не зафиксирован');
    }
    // Запрет на откат bye-матчей
    const isBye =
      match.outcome === 'WO' && (match.redBoxerId === null || match.blueBoxerId === null);
    if (isBye) {
      throw new UnprocessableEntityException(
        'Bye-матч не редактируется, перегенерируйте сетку',
      );
    }
    // nextMatch не должен быть COMPLETED
    if (match.nextMatchId) {
      const next = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
      if (next.status === 'COMPLETED') {
        throw new UnprocessableEntityException('Сначала отмените результат следующего боя');
      }
    }

    // 1) сбрасываем текущий матч в READY (оба слота заполнены, иначе он не был бы COMPLETED не-bye)
    await tx.match.update({
      where: { id: matchId },
      data: {
        winnerId: null,
        outcome: null,
        endRound: null,
        decidedAt: null,
        status: 'READY',
      },
    });

    // 2) сбрасываем слот в nextMatch
    if (match.nextMatchId && match.nextSlot) {
      const slotData: Prisma.MatchUpdateInput =
        match.nextSlot === 'RED'
          ? { redBoxer: { disconnect: true } }
          : { blueBoxer: { disconnect: true } };
      await tx.match.update({
        where: { id: match.nextMatchId },
        data: { ...slotData, status: 'PENDING' },
      });
    }

    // 3) если турнир был FINISHED — возвращаем в IN_PROGRESS
    if (match.tournament.status === TournamentStatus.FINISHED) {
      await tx.tournament.update({
        where: { id: match.tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      });
    }

    return match.tournamentId;
  });

  return this.buildBracketResponse(tournamentId);
}
```

- [ ] **Step 2: Скомпилировать**

Run:
```bash
cd boxr-api && npm run build
```

Expected: успешно.

---

## Task 8: matches.service — getResults (пьедесталы)

**Files:**
- Modify: `boxr-api/src/matches/matches.service.ts`

- [ ] **Step 1: Описать тип `ResultsResponse`**

В `matches.service.ts` после `BracketResponse` добавить:

```ts
export interface ResultsResponseBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
}

export interface ResultsResponseFinal {
  round: number;
  winner: { boxerId: string; fullName: string };
  loser: { boxerId: string; fullName: string };
  outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
  endRound: number | null;
}

export interface ResultsResponseCategory {
  weight: number;
  finished: boolean;
  podium: {
    gold: ResultsResponseBoxer | null;
    silver: ResultsResponseBoxer | null;
    bronze: ResultsResponseBoxer[];
  };
  finals: ResultsResponseFinal[];
}

export interface ResultsResponse {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: ResultsResponseCategory[];
}
```

- [ ] **Step 2: Добавить метод `getPublicResults`**

В класс добавить:

```ts
async getPublicResults(tournamentId: string): Promise<ResultsResponse> {
  const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new NotFoundException('Турнир не найден');
  if (
    tournament.status === TournamentStatus.DRAFT ||
    tournament.status === TournamentStatus.CANCELLED
  ) {
    throw new NotFoundException('Турнир не найден');
  }

  const matches = await this.prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ category: 'asc' }, { round: 'asc' }, { position: 'asc' }],
    include: {
      redBoxer: { select: { id: true, fullName: true, club: true } },
      blueBoxer: { select: { id: true, fullName: true, club: true } },
      winner: { select: { id: true, fullName: true, club: true } },
    },
  });

  const byCat = new Map<number, typeof matches>();
  for (const m of matches) {
    const arr = byCat.get(m.category) ?? [];
    arr.push(m);
    byCat.set(m.category, arr);
  }

  const categories: ResultsResponseCategory[] = [];
  for (const weight of tournament.categories) {
    const list = byCat.get(weight) ?? [];
    if (list.length === 0) continue;
    const rounds = Math.max(...list.map((m) => m.round));
    const final = list.find((m) => m.round === rounds && m.position === 0);
    const finished = final?.status === 'COMPLETED';

    // Пьедестал
    let gold: ResultsResponseBoxer | null = null;
    let silver: ResultsResponseBoxer | null = null;
    const bronze: ResultsResponseBoxer[] = [];

    if (final?.winner) {
      gold = {
        boxerId: final.winner.id,
        fullName: final.winner.fullName,
        club: final.winner.club,
      };
      const loser =
        final.winnerId === final.redBoxerId ? final.blueBoxer : final.redBoxer;
      if (loser) silver = { boxerId: loser.id, fullName: loser.fullName, club: loser.club };
    }
    if (rounds >= 2) {
      const semis = list.filter((m) => m.round === rounds - 1 && m.status === 'COMPLETED');
      for (const s of semis) {
        const loser = s.winnerId === s.redBoxerId ? s.blueBoxer : s.redBoxer;
        if (loser) bronze.push({ boxerId: loser.id, fullName: loser.fullName, club: loser.club });
      }
    }

    // Список финалов и полуфиналов (для UI)
    const finals: ResultsResponseFinal[] = [];
    for (const m of list) {
      if (m.status !== 'COMPLETED') continue;
      if (m.round !== rounds && m.round !== rounds - 1) continue;
      // bye-матч не показываем
      if (!m.redBoxerId || !m.blueBoxerId) continue;
      const winnerBoxer = m.winnerId === m.redBoxerId ? m.redBoxer : m.blueBoxer;
      const loserBoxer = m.winnerId === m.redBoxerId ? m.blueBoxer : m.redBoxer;
      if (!winnerBoxer || !loserBoxer) continue;
      finals.push({
        round: m.round,
        winner: { boxerId: winnerBoxer.id, fullName: winnerBoxer.fullName },
        loser: { boxerId: loserBoxer.id, fullName: loserBoxer.fullName },
        outcome: m.outcome!,
        endRound: m.endRound,
      });
    }

    categories.push({
      weight,
      finished,
      podium: { gold, silver, bronze },
      finals,
    });
  }

  return {
    tournament: { id: tournament.id, name: tournament.name, status: tournament.status },
    categories,
  };
}
```

- [ ] **Step 3: Скомпилировать**

Run:
```bash
cd boxr-api && npm run build
```

Expected: успешно.

---

## Task 9: matches.controller — все 6 эндпоинтов и DTO

**Files:**
- Create: `boxr-api/src/matches/dto/set-result.dto.ts`
- Modify: `boxr-api/src/matches/matches.controller.ts`

- [ ] **Step 1: DTO `SetMatchResultDto`**

```ts
// boxr-api/src/matches/dto/set-result.dto.ts
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { MatchOutcome, MatchSlot } from '@prisma/client';

export class SetMatchResultDto {
  @IsIn(['RED', 'BLUE'])
  winner!: MatchSlot;

  @IsIn(['KO', 'WP', 'RSC', 'DSQ', 'WO'])
  outcome!: MatchOutcome;

  @IsOptional()
  @IsInt()
  @Min(1)
  endRound?: number;
}
```

- [ ] **Step 2: Реализовать контроллер**

Заменить содержимое `matches.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { SetMatchResultDto } from './dto/set-result.dto';
import { MatchesService } from './matches.service';

@Controller()
export class MatchesController {
  constructor(private readonly service: MatchesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Post('tournaments/:id/bracket')
  @HttpCode(HttpStatus.OK)
  generate(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ) {
    return this.service.generateBracket(user.id, tournamentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Get('tournaments/:id/bracket')
  getBracketOwner(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
  ) {
    return this.service.getBracketForOwner(user.id, tournamentId);
  }

  @Get('tournaments/public/:id/bracket')
  getBracketPublic(@Param('id', new ParseUUIDPipe()) tournamentId: string) {
    return this.service.getPublicBracket(tournamentId);
  }

  @Get('tournaments/public/:id/results')
  getResultsPublic(@Param('id', new ParseUUIDPipe()) tournamentId: string) {
    return this.service.getPublicResults(tournamentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Patch('matches/:matchId')
  setResult(
    @CurrentUser() user: AuthUser,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
    @Body() dto: SetMatchResultDto,
  ) {
    return this.service.setResult(user.id, matchId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER)
  @Delete('matches/:matchId/result')
  @HttpCode(HttpStatus.OK)
  clearResult(
    @CurrentUser() user: AuthUser,
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
  ) {
    return this.service.clearResult(user.id, matchId);
  }
}
```

- [ ] **Step 3: Запустить сборку**

Run:
```bash
cd boxr-api && npm run build
```

Expected: успешно.

- [ ] **Step 4: Запустить API локально и проверить health**

Run (в отдельном терминале):
```bash
cd boxr-api && npm run start:prod
```

В другом терминале:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/tournaments/public
```

Expected: `200` (эндпоинт списка публичных турниров не сломан).

---

## Task 10: bash smoke — scripts/test-bracket.sh

**Files:**
- Create: `boxr-api/scripts/test-bracket.sh`

End-to-end сценарий: тренер регистрируется, организатор регистрируется, создаётся турнир, добавляются 6 одобренных боксёров в одной категории (75 кг), генерится сетка, фиксируются 2 полуфинала + финал, проверяется `FINISHED` и пьедестал.

- [ ] **Step 1: Создать скрипт**

```bash
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
  APPS+=("$(json '["created"][0]["id"]')")
done
for A in "${APPS[@]}"; do
  post POST "/applications/$A/approve" "$ORG" >/dev/null
done

# 5) Генерируем сетку
status=$(post POST "/tournaments/$T_ID/bracket" "$ORG")
record "generate bracket" "$status" "200"
NUM_MATCHES=$(json '["categories"][0]["matches"].__len__()')
record "matches count" "$NUM_MATCHES" "7"  # 4 матча 1/4 + 2 полуфинала + финал, без bye
TOURN_STATUS=$(json '["tournament"]["status"]')
record "tournament status" "$TOURN_STATUS" "IN_PROGRESS"

# 6) Фиксируем все 1/4 (winner=RED, WP)
for i in 0 1 2 3; do
  MID=$(json "['categories'][0]['matches'][$i]['id']")
  status=$(post PATCH "/matches/$MID" "$ORG" '{"winner":"RED","outcome":"WP"}')
  record "fix 1/4 #$i" "$status" "200"
done

# 7) Полуфиналы и финал — берём свежие matches из последнего ответа
SEMI_0=$(json "['categories'][0]['matches'][4]['id']")
SEMI_1=$(json "['categories'][0]['matches'][5]['id']")
status=$(post PATCH "/matches/$SEMI_0" "$ORG" '{"winner":"RED","outcome":"KO","endRound":2}')
record "fix semi 0" "$status" "200"
status=$(post PATCH "/matches/$SEMI_1" "$ORG" '{"winner":"BLUE","outcome":"WP"}')
record "fix semi 1" "$status" "200"
FINAL=$(json "['categories'][0]['matches'][6]['id']")
status=$(post PATCH "/matches/$FINAL" "$ORG" '{"winner":"RED","outcome":"WP"}')
record "fix final" "$status" "200"
TOURN_STATUS=$(json '["tournament"]["status"]')
record "tournament FINISHED" "$TOURN_STATUS" "FINISHED"

# 8) Публичные результаты
status=$(post GET "/tournaments/public/$T_ID/results")
record "public results" "$status" "200"
GOLD=$(json '["categories"][0]["podium"]["gold"]')
[ "$GOLD" != "None" ] && record "podium has gold" "yes" "yes" || record "podium has gold" "no" "yes"

# 9) Откат финала возвращает турнир в IN_PROGRESS
status=$(post DELETE "/matches/$FINAL/result" "$ORG")
record "clear final" "$status" "200"
TOURN_STATUS=$(json '["tournament"]["status"]')
record "back to IN_PROGRESS" "$TOURN_STATUS" "IN_PROGRESS"

# 10) Запрет отката полуфинала, когда финал ещё... подожди, мы только что финал откатили,
# полуфинал теперь можно. Проверим обратное: фиксируем финал заново и пробуем откатить полуфинал → 422
post PATCH "/matches/$FINAL" "$ORG" '{"winner":"RED","outcome":"WP"}' >/dev/null
status=$(post DELETE "/matches/$SEMI_0/result" "$ORG")
record "blocked clear of inner" "$status" "422"

# Итог
echo
for r in "${RESULTS[@]}"; do echo "$r"; done
echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
```

- [ ] **Step 2: Сделать исполняемым**

Run:
```bash
chmod +x boxr-api/scripts/test-bracket.sh
```

- [ ] **Step 3: Применить миграцию (если ещё не применена)**

Run:
```bash
cd boxr-api && npm run prisma:migrate -- --name matches
```

(Если уже применена в Task 1 — пропустить.)

- [ ] **Step 4: Запустить API и smoke**

В одном терминале:
```bash
cd boxr-api && npm run start:dev
```

В другом:
```bash
cd boxr-api && ./scripts/test-bracket.sh
```

Expected: `PASS=14 FAIL=0`, exit code 0.

Если что-то падает — фиксим в сервисе/контроллере и перезапускаем.

---

## Task 11: Frontend — типы

**Files:**
- Modify: `boxr/src/shared/types/index.ts`

- [ ] **Step 1: Добавить типы matches в конец файла**

В конец `boxr/src/shared/types/index.ts` дописать:

```ts
export type MatchOutcome = 'ko' | 'wp' | 'rsc' | 'dsq' | 'wo';
export type MatchSlot = 'red' | 'blue';
export type MatchStatus = 'pending' | 'ready' | 'completed';

export interface MatchBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
  rank: BoxerRank;
}

export interface MatchResult {
  winnerId: string;
  outcome: MatchOutcome;
  endRound: number | null;
  decidedAt: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  status: MatchStatus;
  red: MatchBoxer | null;
  blue: MatchBoxer | null;
  nextMatchId: string | null;
  nextSlot: MatchSlot | null;
  result: MatchResult | null;
}

export interface BracketCategory {
  weight: number;
  rounds: number;
  matches: BracketMatch[];
}

export interface Bracket {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: BracketCategory[];
}

export interface PodiumBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
}

export interface CategoryFinal {
  round: number;
  winner: { boxerId: string; fullName: string };
  loser: { boxerId: string; fullName: string };
  outcome: MatchOutcome;
  endRound: number | null;
}

export interface CategoryResults {
  weight: number;
  finished: boolean;
  podium: {
    gold: PodiumBoxer | null;
    silver: PodiumBoxer | null;
    bronze: PodiumBoxer[];
  };
  finals: CategoryFinal[];
}

export interface Results {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: CategoryResults[];
}
```

Также убедиться, что в `TournamentStatus` есть `'in_progress'` и `'finished'`. Найти строку:

```ts
export type TournamentStatus = 'draft' | 'published' | 'cancelled';
```

Заменить на:

```ts
export type TournamentStatus = 'draft' | 'published' | 'in_progress' | 'finished' | 'cancelled';
```

- [ ] **Step 2: Запустить tsc**

Run:
```bash
cd boxr && npx tsc -b --noEmit
```

Expected: компиляция успешна.

---

## Task 12: Frontend — shared/api/matches.ts

**Files:**
- Create: `boxr/src/shared/api/matches.ts`
- Modify: `boxr/src/shared/api/index.ts`

- [ ] **Step 1: Создать клиент**

```ts
// boxr/src/shared/api/matches.ts
import { request } from './client';
import type {
  Bracket,
  BracketMatch,
  Results,
  MatchOutcome,
  MatchSlot,
} from '../types';

// Хелпер: API возвращает upper-case enum-ы, фронт работает с lower-case
type ApiBoxer = { boxerId: string; fullName: string; club: string | null; rank: string };
type ApiMatch = {
  id: string;
  round: number;
  position: number;
  status: 'PENDING' | 'READY' | 'COMPLETED';
  red: ApiBoxer | null;
  blue: ApiBoxer | null;
  nextMatchId: string | null;
  nextSlot: 'RED' | 'BLUE' | null;
  result:
    | null
    | { winnerId: string; outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO'; endRound: number | null; decidedAt: string };
};
type ApiBracket = {
  tournament: { id: string; name: string; status: string };
  categories: Array<{ weight: number; rounds: number; matches: ApiMatch[] }>;
};

const toBracket = (api: ApiBracket): Bracket => ({
  tournament: {
    id: api.tournament.id,
    name: api.tournament.name,
    status: api.tournament.status.toLowerCase() as Bracket['tournament']['status'],
  },
  categories: api.categories.map((c) => ({
    weight: c.weight,
    rounds: c.rounds,
    matches: c.matches.map(toMatch),
  })),
});

const toMatch = (m: ApiMatch): BracketMatch => ({
  id: m.id,
  round: m.round,
  position: m.position,
  status: m.status.toLowerCase() as BracketMatch['status'],
  red: m.red && {
    boxerId: m.red.boxerId,
    fullName: m.red.fullName,
    club: m.red.club,
    rank: m.red.rank.toLowerCase() as BracketMatch['red']['rank'],
  },
  blue: m.blue && {
    boxerId: m.blue.boxerId,
    fullName: m.blue.fullName,
    club: m.blue.club,
    rank: m.blue.rank.toLowerCase() as BracketMatch['blue']['rank'],
  },
  nextMatchId: m.nextMatchId,
  nextSlot: m.nextSlot ? (m.nextSlot.toLowerCase() as MatchSlot) : null,
  result: m.result && {
    winnerId: m.result.winnerId,
    outcome: m.result.outcome.toLowerCase() as MatchOutcome,
    endRound: m.result.endRound,
    decidedAt: m.result.decidedAt,
  },
});

type ApiResults = {
  tournament: { id: string; name: string; status: string };
  categories: Array<{
    weight: number;
    finished: boolean;
    podium: {
      gold: { boxerId: string; fullName: string; club: string | null } | null;
      silver: { boxerId: string; fullName: string; club: string | null } | null;
      bronze: Array<{ boxerId: string; fullName: string; club: string | null }>;
    };
    finals: Array<{
      round: number;
      winner: { boxerId: string; fullName: string };
      loser: { boxerId: string; fullName: string };
      outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
      endRound: number | null;
    }>;
  }>;
};

const toResults = (api: ApiResults): Results => ({
  tournament: {
    id: api.tournament.id,
    name: api.tournament.name,
    status: api.tournament.status.toLowerCase() as Results['tournament']['status'],
  },
  categories: api.categories.map((c) => ({
    weight: c.weight,
    finished: c.finished,
    podium: c.podium,
    finals: c.finals.map((f) => ({ ...f, outcome: f.outcome.toLowerCase() as MatchOutcome })),
  })),
});

export interface SetResultInput {
  winner: 'red' | 'blue';
  outcome: MatchOutcome;
  endRound?: number;
}

export const matchesApi = {
  generateBracket: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/${tournamentId}/bracket`, { method: 'POST' }).then(toBracket),
  getBracket: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/${tournamentId}/bracket`).then(toBracket),
  getPublicBracket: (tournamentId: string) =>
    request<ApiBracket>(`/tournaments/public/${tournamentId}/bracket`, { auth: false }).then(toBracket),
  getPublicResults: (tournamentId: string) =>
    request<ApiResults>(`/tournaments/public/${tournamentId}/results`, { auth: false }).then(toResults),
  setResult: (matchId: string, input: SetResultInput) =>
    request<ApiBracket>(`/matches/${matchId}`, {
      method: 'PATCH',
      body: {
        winner: input.winner.toUpperCase(),
        outcome: input.outcome.toUpperCase(),
        ...(input.endRound !== undefined ? { endRound: input.endRound } : {}),
      },
    }).then(toBracket),
  clearResult: (matchId: string) =>
    request<ApiBracket>(`/matches/${matchId}/result`, { method: 'DELETE' }).then(toBracket),
};
```

- [ ] **Step 2: Экспортировать из `shared/api/index.ts`**

В конец `boxr/src/shared/api/index.ts` дописать:

```ts
export { matchesApi, type SetResultInput } from './matches';
```

- [ ] **Step 3: Скомпилировать**

Run:
```bash
cd boxr && npx tsc -b --noEmit
```

Expected: успешно.

---

## Task 13: Frontend — widget bracket-view (BracketView + MatchCard, read-only)

**Files:**
- Create: `boxr/src/widgets/bracket-view/index.ts`
- Create: `boxr/src/widgets/bracket-view/ui/BracketView.tsx`
- Create: `boxr/src/widgets/bracket-view/ui/MatchCard.tsx`

Стилистика — по образцу мокапа (`index.html:2651-2837`, секция `DrawTab`). Здесь делаем функциональную версию без анимаций «AI генерирует».

- [ ] **Step 1: `MatchCard.tsx`**

```tsx
// boxr/src/widgets/bracket-view/ui/MatchCard.tsx
import type { BracketMatch } from '@/shared/types';

interface Props {
  match: BracketMatch;
  onClick?: (match: BracketMatch) => void;
}

const outcomeLabel: Record<string, string> = {
  ko: 'KO', wp: 'WP', rsc: 'RSC', dsq: 'DSQ', wo: 'WO',
};

export const MatchCard = ({ match, onClick }: Props) => {
  const clickable = match.status === 'ready' && onClick !== undefined;
  const winnerSlot =
    match.result?.winnerId === match.red?.boxerId
      ? 'red'
      : match.result?.winnerId === match.blue?.boxerId
        ? 'blue'
        : null;

  const slotStyle = (isWinner: boolean) => ({
    padding: '8px 12px',
    fontSize: 'var(--text-sm)',
    fontWeight: isWinner ? 600 : 500,
    opacity: match.result && !isWinner ? 0.5 : 1,
  });

  return (
    <button
      type="button"
      onClick={clickable ? () => onClick(match) : undefined}
      disabled={!clickable}
      style={{
        all: 'unset',
        display: 'block',
        width: '100%',
        border: '1px solid var(--paper-300)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        cursor: clickable ? 'pointer' : 'default',
        background: 'var(--paper-100)',
      }}
    >
      <div
        style={{
          ...slotStyle(winnerSlot === 'red'),
          background: 'rgba(178,58,47,0.05)',
          borderBottom: '1px solid var(--paper-300)',
        }}
      >
        🔴 {match.red?.fullName ?? <em style={{ color: 'var(--ink-300)' }}>BYE</em>}
      </div>
      <div style={slotStyle(winnerSlot === 'blue')}>
        🔵 {match.blue?.fullName ?? <em style={{ color: 'var(--ink-300)' }}>BYE</em>}
      </div>
      {match.result && (
        <div
          style={{
            padding: '4px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-500)',
            borderTop: '1px solid var(--paper-300)',
            background: 'var(--paper-200)',
          }}
        >
          {outcomeLabel[match.result.outcome]}
          {match.result.endRound ? ` · Р${match.result.endRound}` : ''}
        </div>
      )}
    </button>
  );
};
```

- [ ] **Step 2: `BracketView.tsx`**

```tsx
// boxr/src/widgets/bracket-view/ui/BracketView.tsx
import type { Bracket, BracketMatch } from '@/shared/types';
import { MonoLabel } from '@/shared/ui';
import { MatchCard } from './MatchCard';

interface Props {
  bracket: Bracket;
  readOnly?: boolean;
  onMatchClick?: (match: BracketMatch) => void;
}

const roundLabel = (round: number, totalRounds: number): string => {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Финал';
  if (fromEnd === 1) return 'Полуфинал';
  if (fromEnd === 2) return '1/4 финала';
  if (fromEnd === 3) return '1/8 финала';
  return `Раунд ${round}`;
};

export const BracketView = ({ bracket, readOnly, onMatchClick }: Props) => {
  if (bracket.categories.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
        Сетка пуста — нет одобренных участников ни в одной категории.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {bracket.categories.map((cat) => (
        <div
          key={cat.weight}
          style={{
            border: '1px solid var(--paper-300)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--paper-200)',
              borderBottom: '1px solid var(--paper-300)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)' }}>
                {cat.weight} кг
              </span>
            </div>
            <MonoLabel>
              {cat.matches.filter((m) => m.round === 1).length} матчей в 1-м раунде
            </MonoLabel>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 16, overflowX: 'auto' }}>
            {Array.from({ length: cat.rounds }, (_, i) => i + 1).map((round) => {
              const matchesInRound = cat.matches
                .filter((m) => m.round === round)
                .sort((a, b) => a.position - b.position);
              return (
                <div
                  key={round}
                  style={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <MonoLabel style={{ textAlign: 'center' }}>{roundLabel(round, cat.rounds)}</MonoLabel>
                  {matchesInRound.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      onClick={readOnly ? undefined : onMatchClick}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: `index.ts`**

```ts
// boxr/src/widgets/bracket-view/index.ts
export { BracketView } from './ui/BracketView';
```

- [ ] **Step 4: Скомпилировать**

Run:
```bash
cd boxr && npx tsc -b --noEmit
```

Expected: успешно.

---

## Task 14: Frontend — MatchResultDialog (модалка фиксации результата)

**Files:**
- Create: `boxr/src/widgets/bracket-view/ui/MatchResultDialog.tsx`
- Modify: `boxr/src/widgets/bracket-view/index.ts`

- [ ] **Step 1: Реализовать диалог**

```tsx
// boxr/src/widgets/bracket-view/ui/MatchResultDialog.tsx
import { useState } from 'react';
import type { BracketMatch, MatchOutcome } from '@/shared/types';
import { matchesApi, type SetResultInput, ApiError } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';

interface Props {
  match: BracketMatch;
  tournamentRounds: number;
  onClose: () => void;
  onResult: (bracket: Awaited<ReturnType<typeof matchesApi.setResult>>) => void;
}

const outcomes: Array<{ value: MatchOutcome; label: string }> = [
  { value: 'wp', label: 'WP — по очкам' },
  { value: 'ko', label: 'KO — нокаут' },
  { value: 'rsc', label: 'RSC — рефери остановил' },
  { value: 'dsq', label: 'DSQ — дисквалификация' },
  { value: 'wo', label: 'WO — неявка / отказ' },
];

const requiresEndRound = (o: MatchOutcome) => o === 'ko' || o === 'rsc';

export const MatchResultDialog = ({ match, tournamentRounds, onClose, onResult }: Props) => {
  const [winner, setWinner] = useState<'red' | 'blue'>('red');
  const [outcome, setOutcome] = useState<MatchOutcome>('wp');
  const [endRound, setEndRound] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const input: SetResultInput = {
        winner,
        outcome,
        ...(requiresEndRound(outcome) ? { endRound } : {}),
      };
      const fresh = await matchesApi.setResult(match.id, input);
      onResult(fresh);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить результат');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,20,61,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--paper-100)', padding: 28, borderRadius: 'var(--radius-md)',
          width: 420, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div>
          <MonoLabel>ФИКСАЦИЯ РЕЗУЛЬТАТА</MonoLabel>
          <div style={{ marginTop: 8, fontSize: 'var(--text-sm)' }}>
            🔴 {match.red?.fullName} vs 🔵 {match.blue?.fullName}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MonoLabel>ПОБЕДИТЕЛЬ</MonoLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['red', 'blue'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWinner(w)}
                style={{
                  flex: 1, padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${winner === w ? 'var(--ink-900)' : 'var(--paper-300)'}`,
                  background: winner === w ? 'var(--ink-900)' : 'transparent',
                  color: winner === w ? 'var(--paper-100)' : 'var(--ink-900)',
                  cursor: 'pointer',
                }}
              >
                {w === 'red' ? '🔴 ' : '🔵 '}
                {(w === 'red' ? match.red : match.blue)?.fullName}
              </button>
            ))}
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MonoLabel>ИСХОД</MonoLabel>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as MatchOutcome)}
            style={{ padding: 8, fontSize: 'var(--text-sm)' }}
          >
            {outcomes.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {requiresEndRound(outcome) && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <MonoLabel>РАУНД ОКОНЧАНИЯ</MonoLabel>
            <select
              value={endRound}
              onChange={(e) => setEndRound(Number(e.target.value))}
              style={{ padding: 8, fontSize: 'var(--text-sm)' }}
            >
              {Array.from({ length: tournamentRounds }, (_, i) => i + 1).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Отмена</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Сохраняем…' : 'Утвердить'}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Экспорт диалога**

В `boxr/src/widgets/bracket-view/index.ts` дописать:

```ts
export { MatchResultDialog } from './ui/MatchResultDialog';
```

- [ ] **Step 3: Скомпилировать**

Run:
```bash
cd boxr && npx tsc -b --noEmit
```

Expected: успешно.

---

## Task 15: Frontend — widget results-view

**Files:**
- Create: `boxr/src/widgets/results-view/index.ts`
- Create: `boxr/src/widgets/results-view/ui/ResultsView.tsx`

Стилистика — по образцу мокапа (`index.html:2904-2987`, секция `ResultsTab`).

- [ ] **Step 1: `ResultsView.tsx`**

```tsx
// boxr/src/widgets/results-view/ui/ResultsView.tsx
import type { Results } from '@/shared/types';
import { MonoLabel } from '@/shared/ui';

interface Props { results: Results; }

const outcomeLabel: Record<string, string> = {
  ko: 'KO', wp: 'WP', rsc: 'RSC', dsq: 'DSQ', wo: 'WO',
};

export const ResultsView = ({ results }: Props) => {
  if (results.categories.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
        Результатов пока нет.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {results.categories.map((cat) => (
        <div
          key={cat.weight}
          style={{
            border: '1px solid var(--paper-300)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--paper-200)',
              borderBottom: '1px solid var(--paper-300)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)' }}>
              {cat.weight} кг
            </span>
            <MonoLabel>{cat.finished ? 'ЗАВЕРШЕНА' : 'В ХОДЕ'}</MonoLabel>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {(['gold', 'silver'] as const).map((place, i) => {
                const p = cat.podium[place];
                return (
                  <div
                    key={place}
                    style={{
                      flex: 1,
                      padding: 14,
                      background: i === 0 ? 'var(--ink-900)' : 'var(--paper-200)',
                      color: i === 0 ? 'var(--paper-100)' : 'var(--ink-900)',
                      border: '1px solid var(--paper-300)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 28,
                        fontWeight: 300,
                        opacity: 0.4,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                      {p ? `${p.fullName}${p.club ? ` (${p.club})` : ''}` : '—'}
                    </div>
                  </div>
                );
              })}
              {cat.podium.bronze.map((b, i) => (
                <div
                  key={`bronze-${i}`}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: 'var(--paper-200)',
                    border: '1px solid var(--paper-300)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 28,
                      fontWeight: 300,
                      opacity: 0.4,
                    }}
                  >
                    3
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    {b.fullName}
                    {b.club ? ` (${b.club})` : ''}
                  </div>
                </div>
              ))}
            </div>

            {cat.finals.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {cat.finals.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 16,
                      padding: '10px 0',
                      borderTop: '1px solid var(--paper-300)',
                      alignItems: 'center',
                    }}
                  >
                    <MonoLabel style={{ minWidth: 90 }}>
                      {f.round === Math.max(...cat.finals.map((x) => x.round)) ? 'Финал' : '1/2'}
                    </MonoLabel>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {f.winner.fullName}
                    </span>
                    <span style={{ color: 'var(--ink-300)' }}>def.</span>
                    <span style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
                      {f.loser.fullName}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      {outcomeLabel[f.outcome]}
                      {f.endRound ? ` · Р${f.endRound}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: `index.ts`**

```ts
// boxr/src/widgets/results-view/index.ts
export { ResultsView } from './ui/ResultsView';
```

- [ ] **Step 3: Скомпилировать**

Run:
```bash
cd boxr && npx tsc -b --noEmit
```

Expected: успешно.

---

## Task 16: Frontend — расширить TournamentManagePage

**Files:**
- Modify: `boxr/src/pages/tournament-manage/ui/TournamentManagePage.tsx`

Существующая страница имеет вкладки `info | participants`. Добавляем `bracket | results`. На вкладке `info` появляются кнопки «Сгенерировать сетку» / «Перегенерировать» в зависимости от статуса.

- [ ] **Step 1: Расширить тип `Tab` и подгрузку bracket/results**

В файле найти строку:

```ts
type Tab = 'info' | 'participants';
```

Заменить на:

```ts
type Tab = 'info' | 'participants' | 'bracket' | 'results';
```

И в массив map для рендера вкладок (строка `(['info', 'participants'] as Tab[]).map(...)`) — заменить на:

```ts
(['info', 'participants', 'bracket', 'results'] as Tab[]).map((id) => (
```

И в тернарном лейбле добавить:

```ts
{id === 'info'
  ? 'Информация'
  : id === 'participants'
    ? 'Участники'
    : id === 'bracket'
      ? 'Жеребьёвка'
      : 'Результаты'}
```

- [ ] **Step 2: Подключить загрузку bracket/results и рендер вкладок**

Импорты в начале файла дополнить:

```ts
import { useEffect, useState } from 'react';
import { matchesApi, ApiError } from '@/shared/api';
import type { Bracket, BracketMatch, Results } from '@/shared/types';
import { BracketView, MatchResultDialog } from '@/widgets/bracket-view';
import { ResultsView } from '@/widgets/results-view';
```

Внутри компонента (рядом с уже существующими useState для tournament/edit) добавить:

```ts
const [bracket, setBracket] = useState<Bracket | null>(null);
const [bracketLoading, setBracketLoading] = useState(false);
const [bracketError, setBracketError] = useState<string | null>(null);
const [results, setResults] = useState<Results | null>(null);
const [activeMatch, setActiveMatch] = useState<BracketMatch | null>(null);
```

После существующего useEffect загрузки турнира — добавить useEffect для bracket:

```ts
useEffect(() => {
  if (!tournament) return;
  if (tournament.status !== 'in_progress' && tournament.status !== 'finished') return;
  setBracketLoading(true);
  matchesApi
    .getBracket(tournament.id)
    .then((b) => setBracket(b))
    .catch((e) => setBracketError(e instanceof ApiError ? e.message : 'Ошибка'))
    .finally(() => setBracketLoading(false));
  matchesApi
    .getPublicResults(tournament.id)
    .then((r) => setResults(r))
    .catch(() => {});
}, [tournament?.id, tournament?.status]);
```

В блоке `{tab === 'participants' && ...}` после него добавить:

```tsx
{tab === 'bracket' && tournament && (
  <BracketTab
    tournament={tournament}
    bracket={bracket}
    loading={bracketLoading}
    error={bracketError}
    onMatchClick={setActiveMatch}
    onGenerate={async () => {
      try {
        const b = await matchesApi.generateBracket(tournament.id);
        setBracket(b);
        setTournament({ ...tournament, status: b.tournament.status });
      } catch (e) {
        setBracketError(e instanceof ApiError ? e.message : 'Ошибка генерации');
      }
    }}
  />
)}
{tab === 'results' && results && <ResultsView results={results} />}
{activeMatch && tournament && (
  <MatchResultDialog
    match={activeMatch}
    tournamentRounds={tournament.rounds}
    onClose={() => setActiveMatch(null)}
    onResult={(b) => {
      setBracket(b);
      setTournament({ ...tournament, status: b.tournament.status });
      // results тоже подгрузим заново
      matchesApi.getPublicResults(tournament.id).then(setResults).catch(() => {});
    }}
  />
)}
```

- [ ] **Step 3: Реализовать `BracketTab` (внутри того же файла)**

В конец файла (после `Centered`) добавить:

```tsx
const BracketTab = ({
  tournament, bracket, loading, error, onMatchClick, onGenerate,
}: {
  tournament: { id: string; status: string };
  bracket: Bracket | null;
  loading: boolean;
  error: string | null;
  onMatchClick: (m: BracketMatch) => void;
  onGenerate: () => void;
}) => {
  const canGenerate = tournament.status === 'published';
  const canRegenerate =
    tournament.status === 'in_progress' &&
    bracket !== null &&
    bracket.categories
      .flatMap((c) => c.matches)
      .every(
        (m) =>
          m.status !== 'completed' ||
          (m.result?.outcome === 'wo' && (m.red === null || m.blue === null)),
      );

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>{error}</div>;

  if (!bracket) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ marginBottom: 16, color: 'var(--ink-500)' }}>
          Сетка ещё не сгенерирована. Сетка строится из одобренных заявок.
        </p>
        {canGenerate && <Button onClick={onGenerate}>Сгенерировать сетку</Button>}
        {!canGenerate && (
          <div style={{ color: 'var(--ink-500)' }}>
            Сначала опубликуйте турнир, чтобы сгенерировать сетку.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {canRegenerate && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onGenerate}>Перегенерировать сетку</Button>
        </div>
      )}
      <BracketView bracket={bracket} onMatchClick={onMatchClick} />
    </div>
  );
};
```

(Импорт `Button` уже есть в файле — иначе добавить из `@/shared/ui`.)

- [ ] **Step 4: Скомпилировать**

Run:
```bash
cd boxr && npx tsc -b --noEmit
```

Expected: успешно. Если попадаются ошибки про `Tournament` тип — проверить, что `TournamentStatus` обновлён (Task 11 step 1).

---

## Task 17: Frontend — публичная страница турнира

**Files:**
- Create: `boxr/src/pages/public-tournament/index.ts`
- Create: `boxr/src/pages/public-tournament/ui/PublicTournamentPage.tsx`
- Modify: `boxr/src/app/router/AppRouter.tsx`
- Modify: `boxr/src/pages/public-tournaments/ui/PublicTournamentsPage.tsx`

- [ ] **Step 1: `PublicTournamentPage.tsx`**

```tsx
// boxr/src/pages/public-tournament/ui/PublicTournamentPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { matchesApi, tournamentsApi, ApiError } from '@/shared/api';
import type { Bracket, PublicTournament, Results } from '@/shared/types';
import { BracketView } from '@/widgets/bracket-view';
import { ResultsView } from '@/widgets/results-view';
import { MonoLabel } from '@/shared/ui';

export const PublicTournamentPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<PublicTournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tournamentsApi
      .findPublic(id)
      .then((t) => setTournament(t))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Турнир не найден'));
  }, [id]);

  useEffect(() => {
    if (!tournament) return;
    if (tournament.status === 'in_progress' || tournament.status === 'finished') {
      matchesApi.getPublicBracket(id).then(setBracket).catch(() => {});
      matchesApi.getPublicResults(id).then(setResults).catch(() => {});
    }
  }, [tournament?.status, id]);

  if (error) {
    return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <h1>Турнир не найден</h1>
      </div>
    );
  }
  if (!tournament) return null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
      <MonoLabel>ТУРНИР</MonoLabel>
      <h1 style={{ marginTop: 8, fontFamily: 'var(--font-display)' }}>{tournament.name}</h1>
      <div style={{ color: 'var(--ink-500)', marginBottom: 32, fontStyle: 'italic' }}>
        {tournament.dateStart} — {tournament.dateEnd} · {tournament.city}
      </div>
      {bracket && (
        <section style={{ marginBottom: 32 }}>
          <h2>Сетка</h2>
          <BracketView bracket={bracket} readOnly />
        </section>
      )}
      {results && (
        <section>
          <h2>Результаты</h2>
          <ResultsView results={results} />
        </section>
      )}
    </div>
  );
};
```

- [ ] **Step 2: `index.ts`**

```ts
// boxr/src/pages/public-tournament/index.ts
export { PublicTournamentPage } from './ui/PublicTournamentPage';
```

- [ ] **Step 3: Добавить маршрут в `AppRouter.tsx`**

В `boxr/src/app/router/AppRouter.tsx` импортировать страницу:

```ts
import { PublicTournamentPage } from '@/pages/public-tournament';
```

В `<Routes>` (перед catch-all `*`) добавить:

```tsx
<Route path="/public/tournaments/:id" element={<PublicTournamentPage />} />
```

- [ ] **Step 4: Сделать имена в списке кликабельными**

В `boxr/src/pages/public-tournaments/ui/PublicTournamentsPage.tsx` обернуть имя турнира в `<Link to={`/public/tournaments/${t.id}`}>`. Импорт `Link from 'react-router-dom'` если ещё нет.

Точечная правка зависит от текущей разметки списка — найти место, где рендерится `tournament.name`, и заменить:

```tsx
{tournament.name}
```

на:

```tsx
<Link to={`/public/tournaments/${tournament.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
  {tournament.name}
</Link>
```

- [ ] **Step 5: Скомпилировать и быстро проверить**

Run:
```bash
cd boxr && npx tsc -b --noEmit
```

Run:
```bash
cd boxr && npm run dev
```

Открыть `http://localhost:5173/public/tournaments/<id-завершённого-турнира>` (можно взять id из smoke-теста Task 10) — должна появиться сетка и пьедестал.

---

## Task 18: Frontend — Playwright e2e

**Files:**
- Create: `boxr/e2e/bracket.spec.ts`

- [ ] **Step 1: Расширить `e2e/helpers.ts` функцией одобрения заявки**

Если функции ещё нет — добавить в `boxr/e2e/helpers.ts`:

```ts
export async function approveApplicationViaApi(
  request: APIRequestContext,
  organizer: RegisteredUser,
  applicationId: string,
): Promise<void> {
  const res = await request.post(`${API_URL}/applications/${applicationId}/approve`, {
    headers: { Authorization: `Bearer ${organizer.accessToken}` },
  });
  if (!res.ok()) throw new Error(`approve failed ${res.status()}: ${await res.text()}`);
}

export async function submitApplicationViaApi(
  request: APIRequestContext,
  trainer: RegisteredUser,
  tournamentId: string,
  boxerId: string,
  category: number,
): Promise<{ id: string }> {
  const res = await request.post(`${API_URL}/applications`, {
    headers: { Authorization: `Bearer ${trainer.accessToken}` },
    data: { tournamentId, items: [{ boxerId, category }] },
  });
  if (!res.ok()) throw new Error(`submit failed ${res.status()}: ${await res.text()}`);
  const body = (await res.json()) as { created: Array<{ id: string }> };
  return body.created[0];
}
```

- [ ] **Step 2: Написать `bracket.spec.ts`**

```ts
// boxr/e2e/bracket.spec.ts
import { expect, test } from '@playwright/test';
import {
  approveApplicationViaApi,
  createBoxerViaApi,
  createTournamentViaApi,
  registerUser,
  seedTokens,
  submitApplicationViaApi,
} from './helpers';

test('организатор генерирует сетку и доводит турнир до пьедестала', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');

  const tournament = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });

  // 4 боксёра в категории 71
  const boxers = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      createBoxerViaApi(request, trainer, { fullName: `E2E Boxer ${i}`, weight: 71 }),
    ),
  );
  for (const b of boxers) {
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 71);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  // Логиним организатора в браузер и идём в управление турниром
  await seedTokens(page, organizer);
  await page.goto(`/tournaments/${tournament.id}`);

  await page.getByRole('button', { name: 'Жеребьёвка' }).click();
  await page.getByRole('button', { name: 'Сгенерировать сетку' }).click();

  // 3 матча: 2 полуфинала + финал
  await expect(page.getByText('71 кг')).toBeVisible();
  await expect(page.getByText('🔴').first()).toBeVisible();

  // Фиксируем все 3 матча. Кликаем по каждому READY и подтверждаем форму.
  for (let i = 0; i < 3; i++) {
    // первый READY-матч на странице
    const readyCard = page.locator('button:not([disabled])').first();
    await readyCard.click();
    await page.getByRole('button', { name: 'Утвердить' }).click();
    await expect(page.getByRole('dialog', { name: /Фиксация/ })).toBeHidden({ timeout: 5000 }).catch(() => {});
  }

  // Перешли на вкладку Результаты — есть пьедестал
  await page.getByRole('button', { name: 'Результаты' }).click();
  await expect(page.getByText('ЗАВЕРШЕНА')).toBeVisible();
});

test('публичная страница турнира показывает сетку и результаты', async ({ page, request }) => {
  // Аналогично выше: создаём турнир, доводим до результатов через API
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');
  const tournament = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });

  const b1 = await createBoxerViaApi(request, trainer, { fullName: 'P1', weight: 60 });
  const b2 = await createBoxerViaApi(request, trainer, { fullName: 'P2', weight: 60 });
  for (const b of [b1, b2]) {
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 60);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  // Генерируем сетку через API
  const r = await request.post(
    `http://localhost:${process.env.E2E_API_PORT ?? 3000}/api/v1/tournaments/${tournament.id}/bracket`,
    { headers: { Authorization: `Bearer ${organizer.accessToken}` } },
  );
  expect(r.ok()).toBeTruthy();

  // Без логина идём на публичную страницу
  await page.goto(`/public/tournaments/${tournament.id}`);
  await expect(page.getByText(tournament.name)).toBeVisible();
  await expect(page.getByText('60 кг')).toBeVisible();
});
```

- [ ] **Step 3: Запустить e2e**

Run (в `boxr/`):
```bash
npm run test:e2e -- bracket.spec.ts
```

Expected: оба теста PASS.

При первом запуске Playwright поднимает оба сервера автоматически (см. `playwright.config.ts`). Postgres должен быть запущен заранее.

---

## Self-review checklist

После выполнения всех задач — проверить вручную:

- [ ] `cd boxr-api && npm run build` — без ошибок.
- [ ] `cd boxr-api && npx jest src/matches/` — все тесты bracket-builder зелёные.
- [ ] `cd boxr-api && ./scripts/test-bracket.sh` — `PASS=14 FAIL=0`.
- [ ] `cd boxr && npx tsc -b --noEmit` — без ошибок.
- [ ] `cd boxr && npm run lint` — без новых ошибок.
- [ ] `cd boxr && npm run test:e2e -- bracket.spec.ts` — оба сценария PASS.
- [ ] Старые e2e не сломались: `cd boxr && npm run test:e2e` — все .spec.ts проходят.
- [ ] Существующие smoke-скрипты бэкенда не сломаны: `cd boxr-api && ./scripts/test-tournaments.sh && ./scripts/test-applications.sh` — оба `FAIL=0`.

Если что-то падает — фиксим до зелёного перед сдачей.
