# Боксёры и заявки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** добавить CRUD боксёров под ролью `TRAINER` и пакетные заявки на турнир с аппрувом организатора, по спеке `docs/superpowers/specs/2026-05-06-boxers-applications-design.md`.

**Architecture:** два новых Nest-модуля (`BoxersModule`, `ApplicationsModule`) и две таблицы Prisma. На фронте — две новые сущности FSD (`entities/boxer`, `entities/application`), три фичи (форма боксёра, диалог пакетной подачи, таблица ревью), две страницы (`register-boxer`, `boxer-profile`), рефакторинг `trainer-dashboard` и `tournament-manage` (вкладочная структура).

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL), class-validator, React 19 + react-router 7, Playwright 1.59 (e2e), bash + curl + python3 (backend integration), уже установленные.

**Repository state:** не git-репозиторий (`Is a git repository: false`). Git-коммиты пропускаются. Если репо появится — добавить шаги commit вручную.

**Сервисы для интеграционных тестов:**
- Postgres в Docker уже работает: `docker ps | grep boxr-postgres` должен показать healthy.
- `boxr-api` запускается через `npm run start:prod` (использует `dist/`), либо `npm run start:dev` для итеративной разработки.
- `boxr` (фронт): `npm run dev` на 5173.

---

## Task 1: Prisma — модели Boxer и Application + миграция

**Files:**
- Modify: `boxr-api/prisma/schema.prisma`
- Create: `boxr-api/prisma/migrations/<timestamp>_boxers_applications/migration.sql` (генерируется Prisma)

- [ ] **Step 1: Дописать enum-ы и модели в schema.prisma**

В `boxr-api/prisma/schema.prisma` после блока `enum TournamentStatus` добавить:

```prisma
enum Gender { MALE FEMALE }

enum BoxerRank {
  NONE
  THIRD_CLASS
  SECOND_CLASS
  FIRST_CLASS
  CMS
  MS
  MSIC
}

enum ApplicationStatus { PENDING APPROVED REJECTED WITHDRAWN }
```

В `model User { ... }` добавить две строки рядом с `tournaments`:

```prisma
  boxers                Boxer[]
  applicationsAsTrainer Application[] @relation("trainerApplications")
```

В `model Tournament { ... }` добавить рядом с `organizer`:

```prisma
  applications Application[]
```

В конец файла добавить:

```prisma
model Boxer {
  id        String    @id @default(uuid())
  fullName  String
  dob       DateTime  @db.Date
  gender    Gender
  weight    Float
  club      String?
  rank      BoxerRank @default(NONE)
  trainerId String
  trainer   User      @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  applications Application[]

  @@index([trainerId])
}

model Application {
  id           String            @id @default(uuid())
  boxerId      String
  boxer        Boxer             @relation(fields: [boxerId], references: [id], onDelete: Cascade)
  tournamentId String
  tournament   Tournament        @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  category     Float
  status       ApplicationStatus @default(PENDING)
  rejectReason String?
  trainerId    String
  trainer      User              @relation("trainerApplications", fields: [trainerId], references: [id], onDelete: Restrict)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  decidedAt    DateTime?
  withdrawnAt  DateTime?

  @@unique([boxerId, tournamentId])
  @@index([tournamentId, status])
  @@index([trainerId])
}
```

- [ ] **Step 2: Запустить миграцию**

Из `boxr-api/`:

```bash
npx prisma migrate dev --name boxers_applications
```

Ожидается: «Your database is now in sync with your schema» и «Generated Prisma Client».

- [ ] **Step 3: Smoke-проверка типов**

```bash
node -e "const c=require('@prisma/client'); console.log(Object.keys(c).filter(k=>['Gender','BoxerRank','ApplicationStatus'].includes(k)))"
```

Ожидается вывод массива из трёх enum-имён.

---

## Task 2: BoxersModule (DTO, сервис, контроллер, подключение)

**Files:**
- Create: `boxr-api/src/boxers/boxers.module.ts`
- Create: `boxr-api/src/boxers/boxers.controller.ts`
- Create: `boxr-api/src/boxers/boxers.service.ts`
- Create: `boxr-api/src/boxers/dto/create-boxer.dto.ts`
- Create: `boxr-api/src/boxers/dto/update-boxer.dto.ts`
- Create: `boxr-api/src/boxers/dto/list-boxers.dto.ts`
- Modify: `boxr-api/src/app.module.ts`

- [ ] **Step 1: CreateBoxerDto**

`boxr-api/src/boxers/dto/create-boxer.dto.ts`:

```ts
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BoxerRank, Gender } from '@prisma/client';

export class CreateBoxerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsDateString({ strict: true })
  dob!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsNumber()
  @Min(0.1)
  @Max(200)
  weight!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  club?: string;

  @IsOptional()
  @IsEnum(BoxerRank)
  rank?: BoxerRank;
}
```

- [ ] **Step 2: UpdateBoxerDto**

`boxr-api/src/boxers/dto/update-boxer.dto.ts`:

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateBoxerDto } from './create-boxer.dto';

export class UpdateBoxerDto extends PartialType(CreateBoxerDto) {}
```

- [ ] **Step 3: ListBoxersDto**

`boxr-api/src/boxers/dto/list-boxers.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListBoxersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
```

- [ ] **Step 4: BoxersService**

`boxr-api/src/boxers/boxers.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Boxer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoxerDto } from './dto/create-boxer.dto';
import { ListBoxersDto } from './dto/list-boxers.dto';
import { UpdateBoxerDto } from './dto/update-boxer.dto';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class BoxersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(trainerId: string, dto: CreateBoxerDto): Promise<Boxer> {
    this.validateDob(dto.dob);
    return this.prisma.boxer.create({
      data: {
        ...dto,
        dob: new Date(dto.dob),
        trainerId,
      },
    });
  }

  async list(trainerId: string, query: ListBoxersDto): Promise<PageResult<Boxer>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BoxerWhereInput = { trainerId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.boxer.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.boxer.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findMine(trainerId: string, id: string): Promise<Boxer> {
    const b = await this.prisma.boxer.findUnique({ where: { id } });
    if (!b || b.trainerId !== trainerId) {
      throw new NotFoundException('Боксёр не найден');
    }
    return b;
  }

  async update(trainerId: string, id: string, dto: UpdateBoxerDto): Promise<Boxer> {
    await this.findMine(trainerId, id);
    if (dto.dob) this.validateDob(dto.dob);
    const data: Prisma.BoxerUpdateInput = { ...dto };
    if (dto.dob) data.dob = new Date(dto.dob);
    return this.prisma.boxer.update({ where: { id }, data });
  }

  async remove(trainerId: string, id: string): Promise<void> {
    const b = await this.findMine(trainerId, id);
    const active = await this.prisma.application.count({
      where: {
        boxerId: b.id,
        status: { in: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED] },
        tournament: { dateStart: { gt: new Date() } },
      },
    });
    if (active > 0) {
      throw new ConflictException(
        'Нельзя удалить боксёра с активными заявками на будущие турниры',
      );
    }
    await this.prisma.boxer.delete({ where: { id } });
  }

  private validateDob(dob: string): void {
    const d = new Date(dob);
    const now = new Date();
    if (d.getTime() > now.getTime()) {
      throw new BadRequestException('dob не может быть в будущем');
    }
    const age =
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 8 || age > 80) {
      throw new BadRequestException('Возраст боксёра должен быть от 8 до 80 лет');
    }
  }
}
```

- [ ] **Step 5: BoxersController**

`boxr-api/src/boxers/boxers.controller.ts`:

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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { BoxersService } from './boxers.service';
import { CreateBoxerDto } from './dto/create-boxer.dto';
import { ListBoxersDto } from './dto/list-boxers.dto';
import { UpdateBoxerDto } from './dto/update-boxer.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TRAINER)
@Controller('boxers')
export class BoxersController {
  constructor(private readonly service: BoxersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListBoxersDto) {
    return this.service.list(user.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findMine(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoxerDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBoxerDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.remove(user.id, id);
  }
}
```

- [ ] **Step 6: BoxersModule**

`boxr-api/src/boxers/boxers.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BoxersController } from './boxers.controller';
import { BoxersService } from './boxers.service';

@Module({
  controllers: [BoxersController],
  providers: [BoxersService],
  exports: [BoxersService],
})
export class BoxersModule {}
```

- [ ] **Step 7: Подключить в AppModule**

В `boxr-api/src/app.module.ts` добавить импорт и в массив `imports`:

```ts
import { BoxersModule } from './boxers/boxers.module';
```

В `imports: [...]` добавить `BoxersModule` (после `TournamentsModule`).

- [ ] **Step 8: Build**

Из `boxr-api/`:

```bash
npx nest build
```

Ожидается: пустой вывод (без ошибок TS).

---

## Task 3: Интеграционный bash-тест боксёров

**Files:**
- Create: `boxr-api/scripts/test-boxers.sh`

- [ ] **Step 1: Скрипт тестов**

`boxr-api/scripts/test-boxers.sh`:

```bash
#!/usr/bin/env bash
# Интеграционный smoke по разделу «Boxers» спеки
# 2026-05-06-boxers-applications-design.md.
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

# Регистрируем 1 тренера и 1 организатора
post POST /auth/register "" "{\"email\":\"tr-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR_TOKEN=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG_TOKEN=$(json '["accessToken"]')

VALID="{\"fullName\":\"Иванов И.И.\",\"dob\":\"2000-01-15\",\"gender\":\"MALE\",\"weight\":71}"

# 1. TRAINER POST → 201
CODE=$(post POST /boxers "$TR_TOKEN" "$VALID")
record "01 TRAINER POST → 201" "$CODE" "201"
BID=$(json '["id"]')

# 2. ORGANIZER POST → 403
CODE=$(post POST /boxers "$ORG_TOKEN" "$VALID")
record "02 ORGANIZER POST → 403" "$CODE" "403"

# 3. GET /boxers видит свой
post GET /boxers "$TR_TOKEN" >/dev/null
record "03 GET /boxers содержит свой" "$(json "['items'][0]['id'] if d['items'] else ''")" "$BID"

# 4. Чужой GET — регистрируем второго тренера
post POST /auth/register "" "{\"email\":\"tr2-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr2\",\"role\":\"TRAINER\"}" >/dev/null
TR2_TOKEN=$(json '["accessToken"]')
CODE=$(post GET "/boxers/$BID" "$TR2_TOKEN")
record "04 чужой GET → 404" "$CODE" "404"

# 5. PATCH чужого → 404
CODE=$(post PATCH "/boxers/$BID" "$TR2_TOKEN" '{"club":"hijack"}')
record "05 чужой PATCH → 404" "$CODE" "404"

# 6. DELETE без активных заявок → 204
CODE=$(post DELETE "/boxers/$BID" "$TR_TOKEN")
record "06 DELETE без заявок → 204" "$CODE" "204"

# 7. Создаём ещё одного боксёра, турнир, заявку, потом DELETE → 409
post POST /boxers "$TR_TOKEN" "$VALID" >/dev/null
BID2=$(json '["id"]')
TBODY="{\"name\":\"T-$STAMP\",\"type\":\"REGIONAL\",\"level\":\"AMATEUR\",\"dateStart\":\"2099-09-10\",\"dateEnd\":\"2099-09-11\",\"city\":\"М\",\"categories\":[60,67,75],\"rounds\":3,\"roundDuration\":3,\"helmets\":false}"
post POST /tournaments "$ORG_TOKEN" "$TBODY" >/dev/null
TID=$(json '["id"]')
post POST "/tournaments/$TID/publish" "$ORG_TOKEN" >/dev/null
post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$BID2\"}]}" >/dev/null
CODE=$(post DELETE "/boxers/$BID2" "$TR_TOKEN")
record "07 DELETE с PENDING заявкой → 409" "$CODE" "409"

# 8. Валидация: weight=-1 → 400, dob в будущем → 400
CODE=$(post POST /boxers "$TR_TOKEN" '{"fullName":"X","dob":"2000-01-15","gender":"MALE","weight":-1}')
record "08a weight=-1 → 400" "$CODE" "400"
CODE=$(post POST /boxers "$TR_TOKEN" '{"fullName":"X","dob":"2999-01-01","gender":"MALE","weight":70}')
record "08b dob future → 400" "$CODE" "400"

echo
printf '%s\n' "${RESULTS[@]}"
echo
echo "PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Сделать исполняемым**

```bash
chmod +x boxr-api/scripts/test-boxers.sh
```

- [ ] **Step 3: Не запускаем сейчас**

Тест 07 (`DELETE с PENDING заявкой → 409`) обращается к эндпоинту `/applications`, который появится только в Task 4. Поэтому сам прогон обоих скриптов делаем в конце Task 5, когда оба модуля уже на месте. Здесь только создаём файл и делаем его исполняемым.

---

## Task 4: ApplicationsModule (DTO, сервис, контроллер)

**Files:**
- Create: `boxr-api/src/applications/applications.module.ts`
- Create: `boxr-api/src/applications/applications.controller.ts`
- Create: `boxr-api/src/applications/applications.service.ts`
- Create: `boxr-api/src/applications/dto/submit-applications.dto.ts`
- Create: `boxr-api/src/applications/dto/reject-application.dto.ts`
- Create: `boxr-api/src/applications/dto/list-applications.dto.ts`
- Modify: `boxr-api/src/app.module.ts`

- [ ] **Step 1: SubmitApplicationsDto**

`boxr-api/src/applications/dto/submit-applications.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class SubmitApplicationItemDto {
  @IsUUID()
  boxerId!: string;

  @IsOptional()
  @IsNumber()
  category?: number;
}

export class SubmitApplicationsDto {
  @IsString()
  @IsUUID()
  tournamentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmitApplicationItemDto)
  items!: SubmitApplicationItemDto[];
}
```

- [ ] **Step 2: RejectApplicationDto**

`boxr-api/src/applications/dto/reject-application.dto.ts`:

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

- [ ] **Step 3: ListApplicationsDto**

`boxr-api/src/applications/dto/list-applications.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class ListMineApplicationsDto {
  @IsOptional() @IsUUID() tournamentId?: string;
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

export class ListForTournamentDto {
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
```

- [ ] **Step 4: ApplicationsService**

`boxr-api/src/applications/applications.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Application,
  ApplicationStatus,
  Prisma,
  Tournament,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListForTournamentDto, ListMineApplicationsDto } from './dto/list-applications.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { SubmitApplicationsDto } from './dto/submit-applications.dto';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface SubmitError {
  index: number;
  code:
    | 'BOXER_NOT_FOUND'
    | 'BOXER_OVERWEIGHT'
    | 'CATEGORY_NOT_IN_TOURNAMENT'
    | 'WEIGHT_EXCEEDS_CATEGORY'
    | 'DUPLICATE';
  message: string;
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(
    trainerId: string,
    dto: SubmitApplicationsDto,
  ): Promise<{ items: Application[] }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });
    this.assertTournamentOpen(tournament);

    // Загружаем всех боксёров одним запросом
    const boxerIds = dto.items.map((i) => i.boxerId);
    const boxers = await this.prisma.boxer.findMany({
      where: { id: { in: boxerIds }, trainerId },
    });
    const boxerById = new Map(boxers.map((b) => [b.id, b]));

    // Уникальность: проверяем существующие заявки
    const existing = await this.prisma.application.findMany({
      where: { tournamentId: dto.tournamentId, boxerId: { in: boxerIds } },
      select: { boxerId: true },
    });
    const existingBoxers = new Set(existing.map((e) => e.boxerId));

    const errors: SubmitError[] = [];
    const toCreate: Prisma.ApplicationCreateManyInput[] = [];

    dto.items.forEach((item, index) => {
      const boxer = boxerById.get(item.boxerId);
      if (!boxer) {
        errors.push({
          index,
          code: 'BOXER_NOT_FOUND',
          message: `Боксёр ${item.boxerId} не найден или не принадлежит вам`,
        });
        return;
      }
      if (existingBoxers.has(boxer.id)) {
        errors.push({
          index,
          code: 'DUPLICATE',
          message: `Заявка на боксёра ${boxer.fullName} в этот турнир уже существует`,
        });
        return;
      }
      const cats = tournament!.categories;
      let category = item.category;
      if (category === undefined) {
        // авто-подбор: минимальная категория ≥ веса
        const sorted = [...cats].sort((a, b) => a - b);
        const found = sorted.find((c) => boxer.weight <= c);
        if (found === undefined) {
          errors.push({
            index,
            code: 'BOXER_OVERWEIGHT',
            message: `Вес боксёра ${boxer.fullName} (${boxer.weight} кг) превышает максимальную категорию турнира`,
          });
          return;
        }
        category = found;
      } else {
        if (!cats.includes(category)) {
          errors.push({
            index,
            code: 'CATEGORY_NOT_IN_TOURNAMENT',
            message: `Категория ${category} кг не входит в список турнира`,
          });
          return;
        }
        if (boxer.weight > category) {
          errors.push({
            index,
            code: 'WEIGHT_EXCEEDS_CATEGORY',
            message: `Вес боксёра ${boxer.fullName} (${boxer.weight} кг) больше выбранной категории ${category} кг`,
          });
          return;
        }
      }
      toCreate.push({
        boxerId: boxer.id,
        tournamentId: dto.tournamentId,
        category,
        trainerId,
      });
    });

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Ошибки в пакете заявок', errors });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const data of toCreate) {
        const a = await tx.application.create({ data });
        ids.push(a.id);
      }
      return tx.application.findMany({ where: { id: { in: ids } } });
    });

    return { items: created };
  }

  async listMine(
    trainerId: string,
    query: ListMineApplicationsDto,
  ): Promise<PageResult<Application>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ApplicationWhereInput = { trainerId };
    if (query.tournamentId) where.tournamentId = query.tournamentId;
    if (query.status) where.status = query.status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: { boxer: true, tournament: true },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async listForTournament(
    organizerId: string,
    tournamentId: string,
    query: ListForTournamentDto,
  ): Promise<PageResult<Application>> {
    await this.assertTournamentOwned(organizerId, tournamentId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ApplicationWhereInput = { tournamentId };
    if (query.status) where.status = query.status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: { boxer: true },
        orderBy: [{ createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async withdraw(trainerId: string, id: string): Promise<Application> {
    const app = await this.findOwnedByTrainer(trainerId, id);
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: app.tournamentId },
    });
    this.assertTournamentOpen(tournament);
    if (
      app.status !== ApplicationStatus.PENDING &&
      app.status !== ApplicationStatus.APPROVED
    ) {
      throw new ConflictException(
        'Отозвать можно только заявку в статусе PENDING или APPROVED',
      );
    }
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.WITHDRAWN, withdrawnAt: new Date() },
    });
  }

  async remove(trainerId: string, id: string): Promise<void> {
    const app = await this.findOwnedByTrainer(trainerId, id);
    if (
      app.status !== ApplicationStatus.WITHDRAWN &&
      app.status !== ApplicationStatus.REJECTED
    ) {
      throw new ConflictException(
        'Удалить можно только отозванную или отклонённую заявку',
      );
    }
    await this.prisma.application.delete({ where: { id } });
  }

  async approve(organizerId: string, id: string): Promise<Application> {
    const app = await this.findForOrganizer(organizerId, id);
    if (app.status !== ApplicationStatus.PENDING) {
      throw new ConflictException('Одобрить можно только заявку в статусе PENDING');
    }
    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.APPROVED, decidedAt: new Date() },
    });
  }

  async reject(
    organizerId: string,
    id: string,
    dto: RejectApplicationDto,
  ): Promise<Application> {
    const app = await this.findForOrganizer(organizerId, id);
    if (app.status !== ApplicationStatus.PENDING) {
      throw new ConflictException('Отклонить можно только заявку в статусе PENDING');
    }
    return this.prisma.application.update({
      where: { id },
      data: {
        status: ApplicationStatus.REJECTED,
        decidedAt: new Date(),
        rejectReason: dto.reason ?? null,
      },
    });
  }

  // ── helpers ───────────────────────────────────────────────

  private async findOwnedByTrainer(
    trainerId: string,
    id: string,
  ): Promise<Application> {
    const a = await this.prisma.application.findUnique({ where: { id } });
    if (!a || a.trainerId !== trainerId) {
      throw new NotFoundException('Заявка не найдена');
    }
    return a;
  }

  private async findForOrganizer(
    organizerId: string,
    id: string,
  ): Promise<Application> {
    const a = await this.prisma.application.findUnique({
      where: { id },
      include: { tournament: true },
    });
    if (!a || a.tournament.organizerId !== organizerId) {
      throw new NotFoundException('Заявка не найдена');
    }
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: a.tournamentId },
    });
    this.assertTournamentOpen(tournament);
    return a;
  }

  private async assertTournamentOwned(
    organizerId: string,
    tournamentId: string,
  ): Promise<void> {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t || t.organizerId !== organizerId) {
      throw new NotFoundException('Турнир не найден');
    }
  }

  private assertTournamentOpen(t: Tournament | null): void {
    if (!t) throw new NotFoundException('Турнир не найден');
    if (t.status !== TournamentStatus.PUBLISHED) {
      throw new ConflictException(
        'Операции с заявками доступны только для опубликованных турниров',
      );
    }
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const start = new Date(t.dateStart);
    start.setUTCHours(0, 0, 0, 0);
    if (start.getTime() <= now.getTime()) {
      throw new ConflictException(
        'Турнир уже стартовал — изменения заявок невозможны',
      );
    }
  }
}
```

- [ ] **Step 5: ApplicationsController**

`boxr-api/src/applications/applications.controller.ts`:

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
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user';
import { ApplicationsService } from './applications.service';
import {
  ListForTournamentDto,
  ListMineApplicationsDto,
} from './dto/list-applications.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { SubmitApplicationsDto } from './dto/submit-applications.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // TRAINER

  @Roles(Role.TRAINER)
  @Post('applications')
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitApplicationsDto) {
    return this.service.submit(user.id, dto);
  }

  @Roles(Role.TRAINER)
  @Get('applications/mine')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMineApplicationsDto,
  ) {
    return this.service.listMine(user.id, query);
  }

  @Roles(Role.TRAINER)
  @Post('applications/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.withdraw(user.id, id);
  }

  @Roles(Role.TRAINER)
  @Delete('applications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.remove(user.id, id);
  }

  // ORGANIZER

  @Roles(Role.ORGANIZER)
  @Get('tournaments/:id/applications')
  listForTournament(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) tournamentId: string,
    @Query() query: ListForTournamentDto,
  ) {
    return this.service.listForTournament(user.id, tournamentId, query);
  }

  @Roles(Role.ORGANIZER)
  @Post('applications/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.approve(user.id, id);
  }

  @Roles(Role.ORGANIZER)
  @Post('applications/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectApplicationDto,
  ) {
    return this.service.reject(user.id, id, dto);
  }
}
```

- [ ] **Step 6: ApplicationsModule**

`boxr-api/src/applications/applications.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
```

- [ ] **Step 7: Подключить в AppModule**

В `boxr-api/src/app.module.ts`:

```ts
import { ApplicationsModule } from './applications/applications.module';
```

В `imports: [...]` добавить `ApplicationsModule` (после `BoxersModule`).

- [ ] **Step 8: Build**

```bash
cd boxr-api && npx nest build
```

Ожидается: пустой вывод. Если падает на нерасширённом `Prisma.ApplicationCreateManyInput` — проверить, что Step 1 Task 1 сделал миграцию и `npx prisma generate` отработал.

---

## Task 5: Интеграционный bash-тест заявок

**Files:**
- Create: `boxr-api/scripts/test-applications.sh`

- [ ] **Step 1: Скрипт тестов**

`boxr-api/scripts/test-applications.sh`:

```bash
#!/usr/bin/env bash
# Интеграционный smoke по разделу «Applications» спеки.
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

# Setup: тренер, организатор, 4 боксёра, опубликованный турнир (cats 60,67,75,86,92)
post POST /auth/register "" "{\"email\":\"tr-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Tr\",\"role\":\"TRAINER\"}" >/dev/null
TR_TOKEN=$(json '["accessToken"]')
post POST /auth/register "" "{\"email\":\"org-$STAMP@boxr.test\",\"password\":\"Strong1pw\",\"fullName\":\"Org\",\"role\":\"ORGANIZER\"}" >/dev/null
ORG_TOKEN=$(json '["accessToken"]')

post POST /boxers "$TR_TOKEN" '{"fullName":"А","dob":"2000-01-15","gender":"MALE","weight":59}' >/dev/null
B1=$(json '["id"]')
post POST /boxers "$TR_TOKEN" '{"fullName":"Б","dob":"2000-01-15","gender":"MALE","weight":71}' >/dev/null
B2=$(json '["id"]')
post POST /boxers "$TR_TOKEN" '{"fullName":"В","dob":"2000-01-15","gender":"MALE","weight":80}' >/dev/null
B3=$(json '["id"]')
post POST /boxers "$TR_TOKEN" '{"fullName":"Г","dob":"2000-01-15","gender":"MALE","weight":95}' >/dev/null
B4=$(json '["id"]')

TBODY="{\"name\":\"T-$STAMP\",\"type\":\"REGIONAL\",\"level\":\"AMATEUR\",\"dateStart\":\"2099-09-10\",\"dateEnd\":\"2099-09-11\",\"city\":\"М\",\"categories\":[60,67,75,86,92],\"rounds\":3,\"roundDuration\":3,\"helmets\":false}"
post POST /tournaments "$ORG_TOKEN" "$TBODY" >/dev/null
TID=$(json '["id"]')
post POST "/tournaments/$TID/publish" "$ORG_TOKEN" >/dev/null

# 1. Подача пакетом 3-х боксёров (B1,B2,B3) → 201
BODY="{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B1\"},{\"boxerId\":\"$B2\"},{\"boxerId\":\"$B3\"}]}"
CODE=$(post POST /applications "$TR_TOKEN" "$BODY")
record "01 пакет 3-х → 201" "$CODE" "201"
record "01 все PENDING" "$(json "['items'][0]['status']+'/'+d['items'][1]['status']+'/'+d['items'][2]['status']")" "PENDING/PENDING/PENDING"

# 2. Авто-категория: B2 (71) → 75
record "02 авто 71→75" "$(json "['items'][1]['category']")" "75.0"

# A1 = id первой созданной (B1, авто 60)
A1=$(json "['items'][0]['id']")

# 3. Override category=86 при weight=71 (новый боксёр Б2-копия — но проще удалить B3 и попробовать)
# Удалим только-что созданную заявку B3, потом пересоздадим с override
A3=$(json "['items'][2]['id']")
# Withdraw + delete на B3
post POST "/applications/$A3/withdraw" "$TR_TOKEN" >/dev/null
post DELETE "/applications/$A3" "$TR_TOKEN" >/dev/null
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B3\",\"category\":86}]}")
record "03 override 80→86 → 201" "$CODE" "201"

# 4. Override на категорию вне турнира → 400 CATEGORY_NOT_IN_TOURNAMENT
post POST /boxers "$TR_TOKEN" '{"fullName":"Д","dob":"2000-01-15","gender":"MALE","weight":71}' >/dev/null
B5=$(json '["id"]')
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B5\",\"category\":63.5}]}")
record "04 категория не в турнире → 400" "$CODE" "400"
record "04 code" "$(json "['errors'][0]['code']")" "CATEGORY_NOT_IN_TOURNAMENT"

# 5. Override на меньшую (вес 80, категория 75) → WEIGHT_EXCEEDS_CATEGORY
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B5\",\"category\":67}]}")
record "05 weight>category → 400" "$CODE" "400"

# 6. Boxer overweight (B4: 95, max=92)
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B4\"}]}")
record "06 overweight → 400" "$CODE" "400"
record "06 code" "$(json "['errors'][0]['code']")" "BOXER_OVERWEIGHT"

# 7. Дубль: B1 уже подан
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B1\"}]}")
record "07 дубль → 400 DUPLICATE" "$(json "['errors'][0]['code']")" "DUPLICATE"

# 8. Approve PENDING → APPROVED
CODE=$(post POST "/applications/$A1/approve" "$ORG_TOKEN")
record "08 approve → 200" "$CODE" "200"
record "08 status APPROVED" "$(json '["status"]')" "APPROVED"

# 9. Reject с reason
A2=$(json '["id"]') # A1 ещё актуален; нам нужна другая PENDING — возьмём вторую B2
post GET "/tournaments/$TID/applications?status=PENDING" "$ORG_TOKEN" >/dev/null
A_PENDING=$(json "['items'][0]['id']")
post POST "/applications/$A_PENDING/reject" "$ORG_TOKEN" '{"reason":"некомплект документов"}' >/dev/null
record "09 reject → REJECTED" "$(json '["status"]')" "REJECTED"
record "09 reason" "$(json '["rejectReason"]')" "некомплект документов"

# 10. Approve уже APPROVED → 409
CODE=$(post POST "/applications/$A1/approve" "$ORG_TOKEN")
record "10 approve уже APPROVED → 409" "$CODE" "409"

# 11. Withdraw APPROVED → WITHDRAWN
CODE=$(post POST "/applications/$A1/withdraw" "$TR_TOKEN")
record "11 withdraw APPROVED → 200" "$CODE" "200"
record "11 status WITHDRAWN" "$(json '["status"]')" "WITHDRAWN"

# 12. DELETE WITHDRAWN → 204
CODE=$(post DELETE "/applications/$A1" "$TR_TOKEN")
record "12 DELETE WITHDRAWN → 204" "$CODE" "204"

# 13. После dateStart: создаём турнир в прошлом нельзя (валидация), но можем «протестить» на CANCELLED
post POST "/tournaments/$TID/cancel" "$ORG_TOKEN" >/dev/null
CODE=$(post POST /applications "$TR_TOKEN" "{\"tournamentId\":\"$TID\",\"items\":[{\"boxerId\":\"$B5\"}]}")
record "13 submit на CANCELLED → 409" "$CODE" "409"

echo
printf '%s\n' "${RESULTS[@]}"
echo
echo "PASS=$PASS  FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Сделать исполняемым и запустить**

```bash
chmod +x boxr-api/scripts/test-applications.sh
cd boxr-api && npm run start:prod > /tmp/boxr-api.log 2>&1 &
echo $! > /tmp/boxr-api.pid
sleep 3
bash scripts/test-applications.sh
bash scripts/test-boxers.sh   # этот тест теперь должен проходить целиком
kill $(cat /tmp/boxr-api.pid); rm -f /tmp/boxr-api.pid
```

Ожидается у обоих скриптов `FAIL=0`. Если нет — отладка по выводу `RESULTS`.

---

## Task 6: Frontend — обновление shared/types и API-клиенты

**Files:**
- Modify: `boxr/src/shared/types/index.ts`
- Create: `boxr/src/shared/api/boxers.ts`
- Create: `boxr/src/shared/api/applications.ts`
- Modify: `boxr/src/shared/api/index.ts`

- [ ] **Step 1: Расширить shared/types**

В конец `boxr/src/shared/types/index.ts` добавить:

```ts
export type Gender = 'male' | 'female';

export type BoxerRank =
  | 'none'
  | 'third_class'
  | 'second_class'
  | 'first_class'
  | 'cms'
  | 'ms'
  | 'msic';

export interface Boxer {
  id: string;
  fullName: string;
  dob: string;            // ISO date (YYYY-MM-DD)
  gender: Gender;
  weight: number;
  club: string | null;
  rank: BoxerRank;
  trainerId: string;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface Application {
  id: string;
  boxerId: string;
  tournamentId: string;
  category: number;
  status: ApplicationStatus;
  rejectReason: string | null;
  trainerId: string;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  withdrawnAt: string | null;
  boxer?: Boxer;          // когда сервер inлайнит
  tournament?: Tournament;
}
```

- [ ] **Step 2: boxers API клиент**

`boxr/src/shared/api/boxers.ts`:

```ts
import type { Boxer, BoxerRank, Gender } from '@/shared/types';
import { request } from './client';

interface RawBoxer {
  id: string;
  fullName: string;
  dob: string;
  gender: string;
  weight: number;
  club: string | null;
  rank: string;
  trainerId: string;
  createdAt: string;
  updatedAt: string;
}

interface RawPage<T> { items: T[]; total: number; page: number; limit: number }
export interface Page<T> { items: T[]; total: number; page: number; limit: number }

const GENDER_TO_API: Record<Gender, string> = { male: 'MALE', female: 'FEMALE' };
const GENDER_FROM_API: Record<string, Gender> = { MALE: 'male', FEMALE: 'female' };

const RANK_TO_API: Record<BoxerRank, string> = {
  none: 'NONE',
  third_class: 'THIRD_CLASS',
  second_class: 'SECOND_CLASS',
  first_class: 'FIRST_CLASS',
  cms: 'CMS',
  ms: 'MS',
  msic: 'MSIC',
};
const RANK_FROM_API: Record<string, BoxerRank> = Object.fromEntries(
  Object.entries(RANK_TO_API).map(([k, v]) => [v, k as BoxerRank]),
);

export interface CreateBoxerInput {
  fullName: string;
  dob: string;
  gender: Gender;
  weight: number;
  club?: string;
  rank?: BoxerRank;
}
export type UpdateBoxerInput = Partial<CreateBoxerInput>;

function mapBoxer(raw: RawBoxer): Boxer {
  return {
    ...raw,
    gender: GENDER_FROM_API[raw.gender],
    rank: RANK_FROM_API[raw.rank] ?? 'none',
    dob: raw.dob.slice(0, 10),
  };
}

function mapInput(input: CreateBoxerInput | UpdateBoxerInput): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if (input.gender) out.gender = GENDER_TO_API[input.gender];
  if (input.rank) out.rank = RANK_TO_API[input.rank];
  return out;
}

export const boxersApi = {
  async list(): Promise<Page<Boxer>> {
    const raw = await request<RawPage<RawBoxer>>('/boxers?limit=100');
    return { ...raw, items: raw.items.map(mapBoxer) };
  },
  async findOne(id: string): Promise<Boxer> {
    const raw = await request<RawBoxer>(`/boxers/${id}`);
    return mapBoxer(raw);
  },
  async create(input: CreateBoxerInput): Promise<Boxer> {
    const raw = await request<RawBoxer>('/boxers', { method: 'POST', body: mapInput(input) });
    return mapBoxer(raw);
  },
  async update(id: string, input: UpdateBoxerInput): Promise<Boxer> {
    const raw = await request<RawBoxer>(`/boxers/${id}`, { method: 'PATCH', body: mapInput(input) });
    return mapBoxer(raw);
  },
  async remove(id: string): Promise<void> {
    await request<void>(`/boxers/${id}`, { method: 'DELETE' });
  },
};
```

- [ ] **Step 3: applications API клиент**

`boxr/src/shared/api/applications.ts`:

```ts
import type {
  Application,
  ApplicationStatus,
  Boxer,
  Tournament,
} from '@/shared/types';
import { request } from './client';

interface RawApplication {
  id: string;
  boxerId: string;
  tournamentId: string;
  category: number;
  status: string;
  rejectReason: string | null;
  trainerId: string;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  withdrawnAt: string | null;
  boxer?: unknown;
  tournament?: unknown;
}
interface RawPage<T> { items: T[]; total: number; page: number; limit: number }
export interface Page<T> { items: T[]; total: number; page: number; limit: number }

const STATUS_TO_API: Record<ApplicationStatus, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  withdrawn: 'WITHDRAWN',
};
const STATUS_FROM_API: Record<string, ApplicationStatus> = Object.fromEntries(
  Object.entries(STATUS_TO_API).map(([k, v]) => [v, k as ApplicationStatus]),
);

export interface SubmitApplicationsInput {
  tournamentId: string;
  items: { boxerId: string; category?: number }[];
}

export interface SubmitError { index: number; code: string; message: string }
export interface SubmitErrorResponse { message: string; errors: SubmitError[] }

function mapApplication(raw: RawApplication): Application {
  const a: Application = {
    id: raw.id,
    boxerId: raw.boxerId,
    tournamentId: raw.tournamentId,
    category: raw.category,
    status: STATUS_FROM_API[raw.status],
    rejectReason: raw.rejectReason,
    trainerId: raw.trainerId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    decidedAt: raw.decidedAt,
    withdrawnAt: raw.withdrawnAt,
  };
  if (raw.boxer) a.boxer = raw.boxer as Boxer;
  if (raw.tournament) a.tournament = raw.tournament as Tournament;
  return a;
}

function buildQuery(params: Record<string, string | number | undefined> | object): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const applicationsApi = {
  async submit(input: SubmitApplicationsInput): Promise<{ items: Application[] }> {
    const raw = await request<{ items: RawApplication[] }>('/applications', {
      method: 'POST',
      body: input,
    });
    return { items: raw.items.map(mapApplication) };
  },
  async listMine(query: { tournamentId?: string; status?: ApplicationStatus } = {}): Promise<Page<Application>> {
    const apiQuery: Record<string, string | undefined> = { tournamentId: query.tournamentId };
    if (query.status) apiQuery.status = STATUS_TO_API[query.status];
    const raw = await request<RawPage<RawApplication>>(`/applications/mine${buildQuery(apiQuery)}`);
    return { ...raw, items: raw.items.map(mapApplication) };
  },
  async listForTournament(tournamentId: string, query: { status?: ApplicationStatus } = {}): Promise<Page<Application>> {
    const apiQuery: Record<string, string | undefined> = {};
    if (query.status) apiQuery.status = STATUS_TO_API[query.status];
    const raw = await request<RawPage<RawApplication>>(
      `/tournaments/${tournamentId}/applications${buildQuery(apiQuery)}`,
    );
    return { ...raw, items: raw.items.map(mapApplication) };
  },
  async withdraw(id: string): Promise<Application> {
    const raw = await request<RawApplication>(`/applications/${id}/withdraw`, { method: 'POST' });
    return mapApplication(raw);
  },
  async approve(id: string): Promise<Application> {
    const raw = await request<RawApplication>(`/applications/${id}/approve`, { method: 'POST' });
    return mapApplication(raw);
  },
  async reject(id: string, reason?: string): Promise<Application> {
    const raw = await request<RawApplication>(`/applications/${id}/reject`, {
      method: 'POST',
      body: reason ? { reason } : {},
    });
    return mapApplication(raw);
  },
  async remove(id: string): Promise<void> {
    await request<void>(`/applications/${id}`, { method: 'DELETE' });
  },
};
```

- [ ] **Step 4: Реэкспорт**

В `boxr/src/shared/api/index.ts` добавить:

```ts
export {
  boxersApi,
  type CreateBoxerInput,
  type UpdateBoxerInput,
} from './boxers';
export {
  applicationsApi,
  type SubmitApplicationsInput,
  type SubmitError,
  type SubmitErrorResponse,
} from './applications';
```

- [ ] **Step 5: Проверка tsc**

```bash
cd boxr && npx tsc -p tsconfig.app.json --noEmit
```

Ожидается: пустой вывод.

---

## Task 7: entities/boxer и entities/application

**Files:**
- Create: `boxr/src/entities/boxer/index.ts`
- Create: `boxr/src/entities/boxer/model/types.ts`
- Create: `boxr/src/entities/boxer/ui/BoxerCard.tsx`
- Create: `boxr/src/entities/application/index.ts`
- Create: `boxr/src/entities/application/model/types.ts`
- Create: `boxr/src/entities/application/ui/ApplicationStatusPill.tsx`

- [ ] **Step 1: entities/boxer/model/types.ts**

```ts
import type { Boxer, BoxerRank, Gender } from '@/shared/types';

export type { Boxer, BoxerRank, Gender };

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'М',
  female: 'Ж',
};

export const RANK_LABEL: Record<BoxerRank, string> = {
  none: 'Без разряда',
  third_class: '3-й разряд',
  second_class: '2-й разряд',
  first_class: '1-й разряд',
  cms: 'КМС',
  ms: 'МС',
  msic: 'МСМК',
};

export function computeAge(dob: string, now: Date = new Date()): number {
  const d = new Date(`${dob}T00:00:00Z`);
  const ms = now.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
}
```

- [ ] **Step 2: entities/boxer/ui/BoxerCard.tsx**

```tsx
import { useState } from 'react';
import type { Boxer } from '@/shared/types';
import { MonoLabel, Pill } from '@/shared/ui';
import { GENDER_LABEL, RANK_LABEL, computeAge } from '../model/types';

interface BoxerCardProps {
  boxer: Boxer;
  onClick?: () => void;
}

export const BoxerCard = ({ boxer, onClick }: BoxerCardProps) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--paper-100)',
        border: `1px solid ${hover ? 'var(--ink-900)' : 'var(--paper-300)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color var(--duration-fast) var(--ease-out-quart)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <MonoLabel>{GENDER_LABEL[boxer.gender]} · {computeAge(boxer.dob)} лет</MonoLabel>
        <Pill variant="default">{RANK_LABEL[boxer.rank]}</Pill>
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        {boxer.fullName}
      </h3>
      <div style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
        {boxer.weight} кг{boxer.club ? ` · ${boxer.club}` : ''}
      </div>
    </button>
  );
};
```

- [ ] **Step 3: entities/boxer/index.ts**

```ts
export { BoxerCard } from './ui/BoxerCard';
export {
  GENDER_LABEL,
  RANK_LABEL,
  computeAge,
} from './model/types';
```

- [ ] **Step 4: entities/application/model/types.ts**

```ts
import type { Application, ApplicationStatus } from '@/shared/types';

export type { Application, ApplicationStatus };

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'На проверке',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  withdrawn: 'Отозвана',
};

export const STATUS_VARIANT: Record<ApplicationStatus, 'pending' | 'active' | 'danger' | 'default'> = {
  pending: 'pending',
  approved: 'active',
  rejected: 'danger',
  withdrawn: 'default',
};
```

- [ ] **Step 5: entities/application/ui/ApplicationStatusPill.tsx**

```tsx
import { Pill } from '@/shared/ui';
import type { ApplicationStatus } from '@/shared/types';
import { STATUS_LABEL, STATUS_VARIANT } from '../model/types';

interface Props {
  status: ApplicationStatus;
}

export const ApplicationStatusPill = ({ status }: Props) => (
  <Pill variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Pill>
);
```

- [ ] **Step 6: entities/application/index.ts**

```ts
export { ApplicationStatusPill } from './ui/ApplicationStatusPill';
export { STATUS_LABEL, STATUS_VARIANT } from './model/types';
```

- [ ] **Step 7: tsc**

```bash
cd boxr && npx tsc -p tsconfig.app.json --noEmit
```

Ожидается: пустой вывод.

---

## Task 8: features/boxer-form + pages/register-boxer + роутер

**Files:**
- Create: `boxr/src/features/boxer-form/index.ts`
- Create: `boxr/src/features/boxer-form/ui/BoxerForm.tsx`
- Create: `boxr/src/features/boxer-form/model/useBoxerForm.ts`
- Create: `boxr/src/pages/register-boxer/index.ts`
- Create: `boxr/src/pages/register-boxer/ui/RegisterBoxerPage.tsx`
- Modify: `boxr/src/app/router/AppRouter.tsx`

- [ ] **Step 1: useBoxerForm**

`boxr/src/features/boxer-form/model/useBoxerForm.ts`:

```ts
import { useState } from 'react';
import {
  ApiError,
  boxersApi,
  type CreateBoxerInput,
  type UpdateBoxerInput,
} from '@/shared/api';
import type { Boxer } from '@/shared/types';

interface Result {
  submitting: boolean;
  error: string | null;
  create: (input: CreateBoxerInput) => Promise<Boxer>;
  update: (id: string, input: UpdateBoxerInput) => Promise<Boxer>;
}

export const useBoxerForm = (): Result => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSubmitting(true);
    setError(null);
    try { return await fn(); }
    catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить боксёра');
      throw e;
    } finally { setSubmitting(false); }
  };
  return {
    submitting,
    error,
    create: (input) => run(() => boxersApi.create(input)),
    update: (id, input) => run(() => boxersApi.update(id, input)),
  };
};
```

- [ ] **Step 2: BoxerForm**

`boxr/src/features/boxer-form/ui/BoxerForm.tsx`:

```tsx
import { useState } from 'react';
import { Button, Input, MonoLabel } from '@/shared/ui';
import { GENDER_LABEL, RANK_LABEL } from '@/entities/boxer';
import type { Boxer, BoxerRank, Gender } from '@/shared/types';
import { useBoxerForm } from '../model/useBoxerForm';

interface BoxerFormProps {
  initial?: Boxer;
  onSaved: (b: Boxer) => void;
  onCancel: () => void;
}

const GENDER_OPTIONS: Gender[] = ['male', 'female'];
const RANK_OPTIONS: BoxerRank[] = [
  'none',
  'third_class',
  'second_class',
  'first_class',
  'cms',
  'ms',
  'msic',
];

export const BoxerForm = ({ initial, onSaved, onCancel }: BoxerFormProps) => {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [weight, setWeight] = useState(String(initial?.weight ?? ''));
  const [club, setClub] = useState(initial?.club ?? '');
  const [rank, setRank] = useState<BoxerRank>(initial?.rank ?? 'none');
  const { create, update, submitting, error } = useBoxerForm();

  const valid = fullName.trim().length >= 2 && !!dob && Number(weight) > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    const payload = {
      fullName: fullName.trim(),
      dob,
      gender,
      weight: Number(weight),
      club: club.trim() || undefined,
      rank,
    };
    try {
      const result = initial ? await update(initial.id, payload) : await create(payload);
      onSaved(result);
    } catch {
      /* ошибка в state */
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>
      <Input label="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Input
        label="Дата рождения"
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
      />
      <div>
        <MonoLabel style={{ marginBottom: 12 }}>ПОЛ</MonoLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {GENDER_OPTIONS.map((g) => {
            const sel = gender === g;
            return (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: sel ? 'var(--ink-900)' : 'var(--paper-200)',
                  color: sel ? 'var(--paper-100)' : 'var(--ink-700)',
                  border: `1px solid ${sel ? 'var(--ink-900)' : 'var(--paper-300)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {GENDER_LABEL[g] === 'М' ? 'Мужской' : 'Женский'}
              </button>
            );
          })}
        </div>
      </div>
      <Input
        label="Текущий вес, кг"
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <Input label="Клуб (опц.)" value={club} onChange={(e) => setClub(e.target.value)} />
      <div>
        <MonoLabel style={{ marginBottom: 12 }}>РАЗРЯД</MonoLabel>
        <select
          value={rank}
          onChange={(e) => setRank(e.target.value as BoxerRank)}
          style={{
            height: 48,
            padding: '0 12px',
            background: 'var(--paper-200)',
            border: '1px solid transparent',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            width: '100%',
          }}
        >
          {RANK_OPTIONS.map((r) => (
            <option key={r} value={r}>{RANK_LABEL[r]}</option>
          ))}
        </select>
      </div>
      {error && (
        <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button onClick={handleSubmit} disabled={!valid || submitting}>
          {submitting ? 'Сохраняем…' : initial ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: features/boxer-form/index.ts**

```ts
export { BoxerForm } from './ui/BoxerForm';
export { useBoxerForm } from './model/useBoxerForm';
```

- [ ] **Step 4: pages/register-boxer**

`boxr/src/pages/register-boxer/ui/RegisterBoxerPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { BoxerForm } from '@/features/boxer-form';
import { Button, MonoLabel } from '@/shared/ui';

export const RegisterBoxerPage = () => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/trainer')}>
          ← К тренерскому дашборду
        </Button>
        <MonoLabel style={{ margin: '24px 0 16px' }}>НОВЫЙ БОКСЁР</MonoLabel>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 4vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 32,
          }}
        >
          Регистрация боксёра
        </h1>
        <BoxerForm
          onSaved={(b) => navigate(`/boxers/${b.id}`, { replace: true })}
          onCancel={() => navigate('/trainer')}
        />
      </div>
    </div>
  );
};
```

`boxr/src/pages/register-boxer/index.ts`:

```ts
export { RegisterBoxerPage } from './ui/RegisterBoxerPage';
```

- [ ] **Step 5: Роуты**

В `boxr/src/app/router/AppRouter.tsx` добавить импорт:

```tsx
import { RegisterBoxerPage } from '@/pages/register-boxer';
```

И в `<Routes>`:

```tsx
<Route
  path="/boxers/new"
  element={
    <RequireRole role="trainer">
      <RegisterBoxerPage />
    </RequireRole>
  }
/>
```

- [ ] **Step 6: Проверка**

```bash
cd boxr && npx tsc -p tsconfig.app.json --noEmit && npx vite build
```

Ожидается: чистый билд без ошибок.

---

## Task 9: pages/boxer-profile + удаление боксёра

**Files:**
- Create: `boxr/src/pages/boxer-profile/index.ts`
- Create: `boxr/src/pages/boxer-profile/ui/BoxerProfilePage.tsx`
- Modify: `boxr/src/app/router/AppRouter.tsx`

- [ ] **Step 1: BoxerProfilePage**

`boxr/src/pages/boxer-profile/ui/BoxerProfilePage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, applicationsApi, boxersApi } from '@/shared/api';
import { BoxerForm } from '@/features/boxer-form';
import {
  ApplicationStatusPill,
} from '@/entities/application';
import { GENDER_LABEL, RANK_LABEL, computeAge } from '@/entities/boxer';
import type { Application, Boxer } from '@/shared/types';
import { Button, MonoLabel } from '@/shared/ui';

type Mode = 'view' | 'edit';

export const BoxerProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [boxer, setBoxer] = useState<Boxer | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [b, a] = await Promise.all([
        boxersApi.findOne(id),
        applicationsApi.listMine({}),
      ]);
      setBoxer(b);
      setApps(a.items.filter((x) => x.boxerId === id));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'Боксёр не найден или у вас нет доступа'
          : 'Не удалось загрузить боксёра',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async () => {
    if (!boxer) return;
    if (!confirm(`Удалить боксёра ${boxer.fullName}?`)) return;
    try {
      await boxersApi.remove(boxer.id);
      navigate('/trainer', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить');
    }
  };

  if (loading) return <Centered text="Загрузка…" />;
  if (error || !boxer) return <Centered text={error ?? 'Не найдено'} action={() => navigate('/trainer')} />;

  if (mode === 'edit') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <MonoLabel style={{ marginBottom: 16 }}>РЕДАКТИРОВАНИЕ</MonoLabel>
          <h1 style={titleStyle}>{boxer.fullName}</h1>
          <BoxerForm
            initial={boxer}
            onSaved={(b) => { setBoxer(b); setMode('view'); }}
            onCancel={() => setMode('view')}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/trainer')}>← К тренерскому дашборду</Button>
        <MonoLabel style={{ margin: '24px 0 8px' }}>
          {GENDER_LABEL[boxer.gender] === 'М' ? 'Мужчина' : 'Женщина'} · {computeAge(boxer.dob)} лет · {RANK_LABEL[boxer.rank]}
        </MonoLabel>
        <h1 style={titleStyle}>{boxer.fullName}</h1>
        <div style={{ color: 'var(--ink-500)', fontSize: 'var(--text-base)', marginTop: 8 }}>
          {boxer.weight} кг{boxer.club ? ` · ${boxer.club}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <Button variant="secondary" onClick={() => setMode('edit')}>Редактировать</Button>
          <Button variant="danger" onClick={handleDelete}>Удалить</Button>
        </div>

        <h2 style={{ ...titleStyle, fontSize: 'clamp(24px, 2vw, 32px)', marginTop: 48 }}>Заявки</h2>
        {apps.length === 0 && (
          <div style={{ color: 'var(--ink-500)', marginTop: 16 }}>Заявок пока нет.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {apps.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                background: 'var(--paper-200)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <MonoLabel>Турнир {a.tournamentId.slice(0, 8)}</MonoLabel>
                <div style={{ marginTop: 4 }}>Категория: {a.category} кг</div>
              </div>
              <ApplicationStatusPill status={a.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(32px, 4vw, 52px)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
} as const;

const Centered = ({ text, action }: { text: string; action?: () => void }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <MonoLabel>{text}</MonoLabel>
    {action && <Button onClick={action}>На дашборд</Button>}
  </div>
);
```

`boxr/src/pages/boxer-profile/index.ts`:

```ts
export { BoxerProfilePage } from './ui/BoxerProfilePage';
```

- [ ] **Step 2: Роут**

В `boxr/src/app/router/AppRouter.tsx`:

```tsx
import { BoxerProfilePage } from '@/pages/boxer-profile';
```

В `<Routes>`:

```tsx
<Route
  path="/boxers/:id"
  element={
    <RequireRole role="trainer">
      <BoxerProfilePage />
    </RequireRole>
  }
/>
```

- [ ] **Step 3: tsc/build**

```bash
cd boxr && npx tsc -p tsconfig.app.json --noEmit
```

Ожидается: пустой вывод.

---

## Task 10: features/applications-submit (диалог)

**Files:**
- Create: `boxr/src/features/applications-submit/index.ts`
- Create: `boxr/src/features/applications-submit/ui/ApplicationsSubmitDialog.tsx`
- Create: `boxr/src/features/applications-submit/model/useSubmitApplications.ts`

- [ ] **Step 1: useSubmitApplications**

`boxr/src/features/applications-submit/model/useSubmitApplications.ts`:

```ts
import { useState } from 'react';
import {
  ApiError,
  applicationsApi,
  type SubmitApplicationsInput,
  type SubmitErrorResponse,
} from '@/shared/api';
import type { Application } from '@/shared/types';

interface Result {
  submitting: boolean;
  error: string | null;
  perItemErrors: Record<number, string>;
  submit: (input: SubmitApplicationsInput) => Promise<Application[] | null>;
}

export const useSubmitApplications = (): Result => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perItemErrors, setPerItemErrors] = useState<Record<number, string>>({});

  const submit = async (input: SubmitApplicationsInput) => {
    setSubmitting(true);
    setError(null);
    setPerItemErrors({});
    try {
      const res = await applicationsApi.submit(input);
      return res.items;
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && isErrorResponse(e.payload)) {
        const map: Record<number, string> = {};
        for (const x of e.payload.errors) map[x.index] = x.message;
        setPerItemErrors(map);
        setError(e.payload.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'Не удалось подать заявку');
      }
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, perItemErrors, submit };
};

function isErrorResponse(p: unknown): p is SubmitErrorResponse {
  return !!p && typeof p === 'object' && Array.isArray((p as { errors?: unknown }).errors);
}
```

- [ ] **Step 2: ApplicationsSubmitDialog**

`boxr/src/features/applications-submit/ui/ApplicationsSubmitDialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { Boxer, PublicTournament } from '@/shared/types';
import { Button, MonoLabel } from '@/shared/ui';
import { boxersApi } from '@/shared/api';
import { GENDER_LABEL, computeAge } from '@/entities/boxer';
import { useSubmitApplications } from '../model/useSubmitApplications';

interface Props {
  tournament: PublicTournament;
  onClose: () => void;
  onSubmitted: () => void;
}

interface Row {
  boxerId: string;
  category?: number;
  selected: boolean;
}

function pickAutoCategory(weight: number, cats: number[]): number | undefined {
  return [...cats].sort((a, b) => a - b).find((c) => weight <= c);
}

export const ApplicationsSubmitDialog = ({ tournament, onClose, onSubmitted }: Props) => {
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const { submit, submitting, error, perItemErrors } = useSubmitApplications();

  useEffect(() => {
    void (async () => {
      const page = await boxersApi.list();
      setBoxers(page.items);
      const init: Record<string, Row> = {};
      for (const b of page.items) {
        init[b.id] = {
          boxerId: b.id,
          category: pickAutoCategory(b.weight, tournament.categories),
          selected: false,
        };
      }
      setRows(init);
      setLoading(false);
    })();
  }, [tournament.categories]);

  const items = useMemo(() => Object.values(rows).filter((r) => r.selected), [rows]);

  const handleToggle = (id: string) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], selected: !r[id].selected } }));
  };

  const handleCategory = (id: string, value: string) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], category: value ? Number(value) : undefined } }));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    const result = await submit({
      tournamentId: tournament.id,
      items: items.map((r) => ({ boxerId: r.boxerId, category: r.category })),
    });
    if (result) onSubmitted();
  };

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 14, 12, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'var(--paper-100)',
          maxWidth: 720,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 'var(--radius-md)',
          padding: 32,
        }}
      >
        <MonoLabel style={{ marginBottom: 8 }}>ПОДАТЬ ЗАЯВКУ</MonoLabel>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
          {tournament.name}
        </h2>
        <div style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 'var(--text-sm)' }}>
          Категории: {tournament.categories.map((c) => `${c}кг`).join(', ')}
        </div>

        {loading && <MonoLabel>ЗАГРУЗКА БОКСЁРОВ…</MonoLabel>}
        {!loading && boxers.length === 0 && (
          <div style={{ color: 'var(--ink-500)' }}>Сначала добавьте боксёров на странице регистрации.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {boxers.map((b, idx) => {
            const r = rows[b.id];
            const auto = pickAutoCategory(b.weight, tournament.categories);
            const overweight = auto === undefined;
            const itemError = perItemErrors[items.findIndex((x) => x.boxerId === b.id)];
            return (
              <div
                key={b.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 100px 120px',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  background: r?.selected ? 'var(--paper-200)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  opacity: overweight ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  disabled={overweight}
                  checked={r?.selected ?? false}
                  onChange={() => handleToggle(b.id)}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{b.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                    {GENDER_LABEL[b.gender]} · {computeAge(b.dob)} лет · {b.weight} кг
                  </div>
                  {itemError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{itemError}</div>}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                  {overweight ? '—' : `авто: ${auto}кг`}
                </div>
                <select
                  disabled={overweight || !r?.selected}
                  value={r?.category ?? ''}
                  onChange={(e) => handleCategory(b.id, e.target.value)}
                  style={{
                    height: 32,
                    padding: '0 8px',
                    background: 'var(--paper-200)',
                    border: '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {tournament.categories.map((c) => (
                    <option key={c} value={c}>{c}кг</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {error && <div style={{ marginTop: 16, color: 'var(--danger)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={items.length === 0 || submitting}>
            {submitting ? 'Подаём…' : `Подать заявку (${items.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: index.ts**

`boxr/src/features/applications-submit/index.ts`:

```ts
export { ApplicationsSubmitDialog } from './ui/ApplicationsSubmitDialog';
export { useSubmitApplications } from './model/useSubmitApplications';
```

- [ ] **Step 4: tsc**

```bash
cd boxr && npx tsc -p tsconfig.app.json --noEmit
```

---

## Task 11: trainer-dashboard рефакторинг

**Files:**
- Modify: `boxr/src/pages/trainer-dashboard/ui/TrainerDashboardPage.tsx`

- [ ] **Step 1: Прочитать текущую страницу**

```bash
cat boxr/src/pages/trainer-dashboard/ui/TrainerDashboardPage.tsx
```

- [ ] **Step 2: Полностью переписать страницу**

`boxr/src/pages/trainer-dashboard/ui/TrainerDashboardPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/app/providers';
import { ApiError, applicationsApi, boxersApi, tournamentsApi } from '@/shared/api';
import type { Application, Boxer, PublicTournament } from '@/shared/types';
import { Button, MonoLabel } from '@/shared/ui';
import { BoxerCard } from '@/entities/boxer';
import { ApplicationStatusPill } from '@/entities/application';
import { ApplicationsSubmitDialog } from '@/features/applications-submit';

export const TrainerDashboardPage = () => {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [tournaments, setTournaments] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitFor, setSubmitFor] = useState<PublicTournament | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, a, t] = await Promise.all([
        boxersApi.list(),
        applicationsApi.listMine({}),
        tournamentsApi.listPublic({ limit: 50 }),
      ]);
      setBoxers(b.items);
      setApps(a.items);
      setTournaments(t.items.filter((x) => x.phase === 'open'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 48,
          }}
        >
          <div>
            <MonoLabel style={{ marginBottom: 16 }}>ТРЕНЕРСКИЙ ДАШБОРД</MonoLabel>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(36px, 4vw, 56px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginBottom: 8,
              }}
            >
              Здравствуйте, {user?.fullName}.
            </h1>
            <p style={{ color: 'var(--ink-500)' }}>{user?.email}</p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>Выйти</Button>
        </header>

        {error && <div style={{ color: 'var(--danger)', marginBottom: 24 }}>{error}</div>}

        <Section title="Мои боксёры" right={
          <Button onClick={() => navigate('/boxers/new')}>Добавить боксёра</Button>
        }>
          {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
          {!loading && boxers.length === 0 && (
            <Empty text="Пока нет боксёров. Добавьте первого." />
          )}
          <Grid>
            {boxers.map((b) => (
              <BoxerCard key={b.id} boxer={b} onClick={() => navigate(`/boxers/${b.id}`)} />
            ))}
          </Grid>
        </Section>

        <Section title="Мои заявки">
          {!loading && apps.length === 0 && (
            <Empty text="Заявок пока нет. Подайте боксёров на турнир из списка ниже." />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apps.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 16,
                  background: 'var(--paper-200)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>
                    Боксёр: {boxers.find((b) => b.id === a.boxerId)?.fullName ?? a.boxerId.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                    Категория {a.category} кг
                    {a.rejectReason ? ` · причина отказа: ${a.rejectReason}` : ''}
                  </div>
                </div>
                <ApplicationStatusPill status={a.status} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Открытые турниры">
          {!loading && tournaments.length === 0 && <Empty text="Сейчас нет турниров, открытых для регистрации." />}
          <Grid>
            {tournaments.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: 24,
                  background: 'var(--paper-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: 0 }}>{t.name}</h3>
                <div style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
                  {t.dateStart} — {t.dateEnd} · {t.city}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>
                  {t.categories.length} категорий
                </div>
                <Button onClick={() => setSubmitFor(t)} disabled={boxers.length === 0}>
                  Подать заявку
                </Button>
              </div>
            ))}
          </Grid>
        </Section>
      </div>

      {submitFor && (
        <ApplicationsSubmitDialog
          tournament={submitFor}
          onClose={() => setSubmitFor(null)}
          onSubmitted={() => {
            setSubmitFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
};

const Section = ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <section style={{ marginBottom: 48 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 2.5vw, 32px)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      {right}
    </div>
    {children}
  </section>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
    }}
  >
    {children}
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div
    style={{
      padding: 32,
      textAlign: 'center',
      background: 'var(--paper-200)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--ink-500)',
    }}
  >
    {text}
  </div>
);
```

- [ ] **Step 3: tsc/build**

```bash
cd boxr && npx tsc -p tsconfig.app.json --noEmit && npx vite build
```

Ожидается: чистый билд.

- [ ] **Step 4: ручная UI-проверка**

```bash
cd boxr && npm run dev &
sleep 3
open http://localhost:5173/login   # залогиниться тренером (зарегистрированным или новым)
```

Проверить визуально: дашборд показывает три секции, кнопка «Добавить боксёра» ведёт на форму, карточка боксёра ведёт на профиль, у турниров видна кнопка «Подать заявку». Затем стопануть `npm run dev`.

---

## Task 12: features/applications-review + tabs в tournament-manage

**Files:**
- Create: `boxr/src/features/applications-review/index.ts`
- Create: `boxr/src/features/applications-review/ui/ApplicationsTable.tsx`
- Create: `boxr/src/features/applications-review/model/useApplicationsReview.ts`
- Modify: `boxr/src/pages/tournament-manage/ui/TournamentManagePage.tsx`

- [ ] **Step 1: useApplicationsReview**

`boxr/src/features/applications-review/model/useApplicationsReview.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { ApiError, applicationsApi } from '@/shared/api';
import type { Application, ApplicationStatus } from '@/shared/types';

interface Result {
  items: Application[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
}

export const useApplicationsReview = (
  tournamentId: string,
  status?: ApplicationStatus,
): Result => {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await applicationsApi.listForTournament(tournamentId, { status });
      setItems(page.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, status]);

  useEffect(() => { void refresh(); }, [refresh]);

  const approve = useCallback(async (id: string) => {
    try {
      const updated = await applicationsApi.approve(id);
      setItems((arr) => arr.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось одобрить');
    }
  }, []);

  const reject = useCallback(async (id: string, reason?: string) => {
    try {
      const updated = await applicationsApi.reject(id, reason);
      setItems((arr) => arr.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отклонить');
    }
  }, []);

  return { items, loading, error, refresh, approve, reject };
};
```

- [ ] **Step 2: ApplicationsTable**

`boxr/src/features/applications-review/ui/ApplicationsTable.tsx`:

```tsx
import { useState } from 'react';
import type { ApplicationStatus, Boxer } from '@/shared/types';
import { ApplicationStatusPill } from '@/entities/application';
import { computeAge, GENDER_LABEL, RANK_LABEL } from '@/entities/boxer';
import { Button, MonoLabel } from '@/shared/ui';
import { useApplicationsReview } from '../model/useApplicationsReview';

interface Props {
  tournamentId: string;
  frozen: boolean;
}

const FILTERS: { id?: ApplicationStatus; label: string }[] = [
  { id: undefined, label: 'Все' },
  { id: 'pending', label: 'На проверке' },
  { id: 'approved', label: 'Одобрены' },
  { id: 'rejected', label: 'Отклонены' },
  { id: 'withdrawn', label: 'Отозваны' },
];

export const ApplicationsTable = ({ tournamentId, frozen }: Props) => {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | undefined>(undefined);
  const { items, loading, error, approve, reject } = useApplicationsReview(tournamentId, statusFilter);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const sel = statusFilter === f.id;
          return (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '6px 14px',
                background: sel ? 'var(--ink-900)' : 'var(--paper-200)',
                color: sel ? 'var(--paper-100)' : 'var(--ink-700)',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {!loading && items.length === 0 && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            background: 'var(--paper-200)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--ink-500)',
          }}
        >
          Пока нет заявок.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {items.map((a, idx) => {
          const b = a.boxer as Boxer | undefined;
          return (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 80px 100px 100px 120px 1fr',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: '1px solid var(--paper-300)',
                borderLeft: a.status === 'pending' ? '3px solid var(--warning)' : '3px solid transparent',
              }}
            >
              <MonoLabel style={{ fontSize: 11 }}>№ {idx + 1}</MonoLabel>
              <div>
                <div style={{ fontWeight: 500 }}>{b?.fullName ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{b?.club ?? '—'}</div>
              </div>
              <div>{b ? `${computeAge(b.dob)} лет` : '—'}</div>
              <div>{b ? `${b.weight} кг` : '—'}</div>
              <div>{a.category} кг</div>
              <div>{b ? RANK_LABEL[b.rank] : '—'}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                <ApplicationStatusPill status={a.status} />
                {!frozen && a.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => approve(a.id)}>Одобрить</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const reason = prompt('Причина отказа (опц.)') ?? undefined;
                        void reject(a.id, reason || undefined);
                      }}
                    >
                      Отклонить
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: index.ts**

`boxr/src/features/applications-review/index.ts`:

```ts
export { ApplicationsTable } from './ui/ApplicationsTable';
export { useApplicationsReview } from './model/useApplicationsReview';
```

- [ ] **Step 4: Рефакторинг TournamentManagePage в табы**

Полностью переписать `boxr/src/pages/tournament-manage/ui/TournamentManagePage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, MonoLabel } from '@/shared/ui';
import {
  LEVEL_LABEL,
  StatusPill,
  TYPE_LABEL,
  formatDateRange,
} from '@/entities/tournament';
import { CreateTournamentWizard } from '@/features/tournament-create';
import { ApplicationsTable } from '@/features/applications-review';
import { ApiError, tournamentsApi } from '@/shared/api';
import type { Tournament } from '@/shared/types';

type Mode = 'view' | 'edit';
type Tab = 'info' | 'participants';

export const TournamentManagePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [tab, setTab] = useState<Tab>('info');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const t = await tournamentsApi.findOne(id);
      setTournament(t);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'Турнир не найден или у вас нет доступа'
          : 'Не удалось загрузить турнир',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (fn: () => Promise<Tournament | void>) => {
    setActionPending(true);
    setActionError(null);
    try {
      const r = await fn();
      if (r) setTournament(r);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Не удалось выполнить');
    } finally {
      setActionPending(false);
    }
  };

  if (loading) return <Centered text="Загрузка…" />;
  if (error || !tournament) return <Centered text={error ?? 'Не найдено'} action={() => navigate('/dashboard')} />;

  if (mode === 'edit') {
    return (
      <CreateTournamentWizard
        initial={tournament}
        onSubmitted={(t) => { setTournament(t); setMode('view'); }}
        onCancel={() => setMode('view')}
      />
    );
  }

  const isDraft = tournament.status === 'draft';
  const isPublished = tournament.status === 'published';
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const start = new Date(`${tournament.dateStart}T00:00:00Z`);
  const frozen = !isPublished || start.getTime() <= today.getTime();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-100)' }}>
      <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>← К дашборду</Button>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <MonoLabel>{TYPE_LABEL[tournament.type]} · {LEVEL_LABEL[tournament.level]}</MonoLabel>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(32px, 4vw, 52px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginTop: 8,
              }}
            >
              {tournament.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-500)' }}>
                {formatDateRange(tournament.dateStart, tournament.dateEnd)} · {tournament.city}
                {tournament.address ? ` · ${tournament.address}` : ''}
              </span>
              <StatusPill tournament={tournament} showPhase={isPublished} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, display: 'flex', gap: 0, borderBottom: '1px solid var(--paper-300)' }}>
          {(['info', 'participants'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '10px 24px',
                background: 'none',
                border: 'none',
                borderBottom: tab === id ? '2px solid var(--ink-900)' : '2px solid transparent',
                color: tab === id ? 'var(--ink-900)' : 'var(--ink-500)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                fontWeight: tab === id ? 500 : 400,
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {id === 'info' ? 'Информация' : 'Участники'}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 32 }}>
          {tab === 'info' && (
            <>
              <div
                style={{
                  padding: 24,
                  background: 'var(--paper-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                }}
              >
                <Stat label="Категории">{tournament.categories.length}</Stat>
                <Stat label="Раунды">{tournament.rounds} × {tournament.roundDuration} мин</Stat>
                <Stat label="Шлемы">{tournament.helmets ? 'Да' : 'Нет'}</Stat>
                <Stat label="Статус">{tournament.status}</Stat>
                <Stat label="Опубликован">
                  {tournament.publishedAt ? new Date(tournament.publishedAt).toLocaleDateString('ru-RU') : '—'}
                </Stat>
                <Stat label="Веса">{tournament.categories.map((c) => `${c}кг`).join(', ')}</Stat>
              </div>
              {actionError && (
                <div style={{ marginTop: 16, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                  {actionError}
                </div>
              )}
              <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {tournament.status !== 'cancelled' && (
                  <Button variant="secondary" onClick={() => setMode('edit')} disabled={actionPending}>
                    Редактировать
                  </Button>
                )}
                {isDraft && (
                  <Button onClick={() => runAction(() => tournamentsApi.publish(tournament.id))} disabled={actionPending}>
                    Опубликовать
                  </Button>
                )}
                {isPublished && (
                  <Button
                    variant="secondary"
                    onClick={() => runAction(() => tournamentsApi.cancel(tournament.id))}
                    disabled={actionPending}
                  >
                    Отменить турнир
                  </Button>
                )}
                {isDraft && (
                  <Button
                    variant="danger"
                    disabled={actionPending}
                    onClick={() =>
                      runAction(async () => {
                        if (!confirm('Удалить черновик безвозвратно?')) return;
                        await tournamentsApi.remove(tournament.id);
                        navigate('/dashboard', { replace: true });
                      })
                    }
                  >
                    Удалить черновик
                  </Button>
                )}
              </div>
            </>
          )}
          {tab === 'participants' && (
            <ApplicationsTable tournamentId={tournament.id} frozen={frozen} />
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <MonoLabel>{label}</MonoLabel>
    <div style={{ marginTop: 6, fontSize: 'var(--text-base)', fontWeight: 500 }}>{children}</div>
  </div>
);

const Centered = ({ text, action }: { text: string; action?: () => void }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <MonoLabel>{text}</MonoLabel>
    {action && <Button onClick={action}>На дашборд</Button>}
  </div>
);
```

- [ ] **Step 5: tsc/build**

```bash
cd boxr && npx tsc -p tsconfig.app.json --noEmit && npx vite build
```

Ожидается: чистый билд.

---

## Task 13: Playwright e2e — boxers + applications

**Files:**
- Create: `boxr/e2e/boxers.spec.ts`
- Create: `boxr/e2e/applications.spec.ts`
- Modify: `boxr/e2e/helpers.ts`

- [ ] **Step 1: Расширить helpers.ts**

В конец `boxr/e2e/helpers.ts` добавить:

```ts
export interface CreateBoxerApiInput {
  fullName?: string;
  weight?: number;
  dob?: string;
  gender?: 'MALE' | 'FEMALE';
}

export async function createBoxerViaApi(
  request: APIRequestContext,
  trainer: RegisteredUser,
  input: CreateBoxerApiInput = {},
): Promise<{ id: string; fullName: string }> {
  const res = await request.post(`${API_URL}/boxers`, {
    headers: { Authorization: `Bearer ${trainer.accessToken}` },
    data: {
      fullName: input.fullName ?? `Боксёр ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      dob: input.dob ?? '2000-01-15',
      gender: input.gender ?? 'MALE',
      weight: input.weight ?? 71,
    },
  });
  if (!res.ok()) throw new Error(`createBoxer failed ${res.status()}: ${await res.text()}`);
  return (await res.json()) as { id: string; fullName: string };
}
```

- [ ] **Step 2: e2e/boxers.spec.ts**

```ts
import { expect, test } from '@playwright/test';
import { clearTokens, createBoxerViaApi, loginViaApi } from './helpers';

test.describe('Boxers UI', () => {
  test('1. Тренер регистрирует боксёра', async ({ page, request }) => {
    await loginViaApi(page, request, 'TRAINER');
    await page.goto('/boxers/new');

    const name = `Иванов ${Date.now()}`;
    await page.locator('input').nth(0).fill(name);
    await page.locator('input[type="date"]').fill('2000-05-15');
    await page.locator('input[type="number"]').fill('71');

    await page.getByRole('button', { name: /^Создать$/ }).click();
    await page.waitForURL(/\/boxers\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('2. Тренер редактирует боксёра', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const created = await createBoxerViaApi(request, trainer, { fullName: `Старое ${Date.now()}` });

    await page.goto(`/boxers/${created.id}`);
    await page.getByRole('button', { name: /Редактировать/ }).click();
    const newName = `Новое ${Date.now()}`;
    await page.locator('input').nth(0).fill(newName);
    await page.getByRole('button', { name: /^Сохранить$/ }).click();
    await expect(page.getByRole('heading', { name: newName })).toBeVisible();
  });

  test('3. Тренер удаляет боксёра без заявок', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const created = await createBoxerViaApi(request, trainer, { fullName: `Удалить ${Date.now()}` });

    page.on('dialog', (d) => d.accept());
    await page.goto(`/boxers/${created.id}`);
    await page.getByRole('button', { name: /Удалить/ }).click();
    await page.waitForURL('**/trainer');
    await expect(page).toHaveURL(/\/trainer$/);
  });

  test.afterEach(async ({ page }) => {
    await clearTokens(page);
  });
});
```

- [ ] **Step 3: e2e/applications.spec.ts**

```ts
import { expect, test } from '@playwright/test';
import {
  createBoxerViaApi,
  createTournamentViaApi,
  loginViaApi,
  registerUser,
  seedTokens,
} from './helpers';

const API = 'http://localhost:3000/api/v1';

test.describe('Applications UI', () => {
  test('1. Пакетная заявка тренером', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const organizer = await registerUser(request, 'ORGANIZER');
    await createBoxerViaApi(request, trainer, { weight: 60 });
    await createBoxerViaApi(request, trainer, { weight: 71 });
    await createBoxerViaApi(request, trainer, { weight: 80 });
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });

    await page.goto('/trainer');
    await page.getByRole('button', { name: 'Подать заявку' }).first().click();
    // выбираем все три чекбокса
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
    await page.getByRole('button', { name: /Подать заявку \(\d+\)/ }).click();

    // Проверим у организатора 3 PENDING
    await page.evaluate(() => {
      localStorage.removeItem('boxr.access');
      localStorage.removeItem('boxr.refresh');
    });
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${organizer.accessToken}` },
    });
    const list = await ctx.get(`${API}/tournaments/${t.id}/applications?status=PENDING`);
    const data = (await list.json()) as { items: unknown[] };
    expect(data.items).toHaveLength(3);
  });

  test('2. Тренер отзывает PENDING заявку', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const organizer = await registerUser(request, 'ORGANIZER');
    const boxer = await createBoxerViaApi(request, trainer, { weight: 71 });
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });
    const submit = await request.post(`${API}/applications`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
      data: { tournamentId: t.id, items: [{ boxerId: boxer.id }] },
    });
    const submitted = (await submit.json()) as { items: { id: string }[] };
    const appId = submitted.items[0].id;

    // прямой вызов withdraw через API (UI «отозвать» нет в дашборде в этой v1)
    const r = await request.post(`${API}/applications/${appId}/withdraw`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
    });
    expect(r.ok()).toBeTruthy();
    const back = await request.get(`${API}/applications/mine`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
    });
    const list = (await back.json()) as { items: { status: string }[] };
    expect(list.items[0].status).toBe('WITHDRAWN');
  });

  test('3. Организатор аппрувит — у тренера статус Одобрена', async ({ page, request }) => {
    const trainer = await registerUser(request, 'TRAINER');
    const organizer = await loginViaApi(page, request, 'ORGANIZER');
    const boxer = await createBoxerViaApi(request, trainer, { weight: 71 });
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });
    await request.post(`${API}/applications`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
      data: { tournamentId: t.id, items: [{ boxerId: boxer.id }] },
    });

    await page.goto(`/tournaments/${t.id}`);
    await page.getByRole('button', { name: 'Участники' }).click();
    await page.getByRole('button', { name: /Одобрить/ }).click();
    await expect(page.getByText('Одобрена', { exact: true })).toBeVisible();

    // у тренера статус — переключаемся
    await seedTokens(page, trainer);
    await page.goto('/trainer');
    await expect(page.getByText('Одобрена', { exact: true })).toBeVisible();
  });

  test('4. Организатор отклоняет с причиной', async ({ page, request }) => {
    const trainer = await registerUser(request, 'TRAINER');
    const organizer = await loginViaApi(page, request, 'ORGANIZER');
    const boxer = await createBoxerViaApi(request, trainer, { weight: 71 });
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });
    await request.post(`${API}/applications`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
      data: { tournamentId: t.id, items: [{ boxerId: boxer.id }] },
    });

    await page.goto(`/tournaments/${t.id}`);
    await page.getByRole('button', { name: 'Участники' }).click();
    page.on('dialog', async (d) => { await d.accept('Нет документов'); });
    await page.getByRole('button', { name: /Отклонить/ }).click();
    await expect(page.getByText('Отклонена', { exact: true })).toBeVisible();

    // у тренера видна причина
    await seedTokens(page, trainer);
    await page.goto('/trainer');
    await expect(page.getByText('Нет документов', { exact: false })).toBeVisible();
  });
});
```

- [ ] **Step 4: Прогон**

```bash
cd boxr && npx playwright test
```

Ожидается: все 8 тестов из tournaments.spec.ts (старые) + новые `boxers.spec.ts` (3) + `applications.spec.ts` (4) = **15 PASS**.

Если падают: использовать `npx playwright show-trace test-results/<...>/trace.zip` для отладки.

---

## Self-review checklist

Пройтись по спеке и убедиться, что покрыто:

- [x] Prisma модели Boxer + Application + enum-ы — Task 1
- [x] BoxersController/Service с правилами (свой/чужой, 409 при активных заявках) — Task 2
- [x] Bash-тест боксёров (8 проверок) — Task 3
- [x] ApplicationsController/Service: пакетная подача с авто-категорией, override, withdraw, approve, reject, DELETE — Task 4
- [x] Bash-тест заявок (≥13 проверок) — Task 5
- [x] shared/types + API-клиенты с маппингом enum-ов — Task 6
- [x] entities/boxer и entities/application — Task 7
- [x] BoxerForm + RegisterBoxerPage + роут — Task 8
- [x] BoxerProfilePage + delete + роут — Task 9
- [x] ApplicationsSubmitDialog (пакет, чекбоксы, авто-категория, override) — Task 10
- [x] TrainerDashboardPage с тремя секциями + диалог подачи — Task 11
- [x] ApplicationsTable + tabs в TournamentManagePage — Task 12
- [x] Playwright-тесты для боксёров (3) и заявок (4) — Task 13

Скоуп v1 НЕ включает: OCR, фото, документы, уведомления, импорт, командные заявки, bulk-actions, передача владения, BOXER-роль, AI-помощник. Это явно отражено в спеке и не появляется в плане.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-boxers-applications.md`. Two execution options:

**1. Subagent-Driven (recommended)** — диспатчу свежего сабагента на каждую таску, ревьюю между ними, быстрые итерации.

**2. Inline Execution** — выполняю задачи в этой же сессии через `executing-plans`, батчем с чекпойнтами на ревью.

Какой подход?
