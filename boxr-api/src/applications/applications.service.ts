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

    let created: Application[];
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const ids: string[] = [];
        for (const data of toCreate) {
          const a = await tx.application.create({ data });
          ids.push(a.id);
        }
        return tx.application.findMany({ where: { id: { in: ids } } });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Заявка для одного из боксёров уже создана параллельно. Повторите попытку.',
        );
      }
      throw e;
    }

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
    this.assertTournamentOpen(a.tournament);
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
