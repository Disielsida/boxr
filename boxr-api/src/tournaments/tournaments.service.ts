import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Tournament,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import {
  ListMineTournamentsDto,
  ListPublicTournamentsDto,
} from './dto/list-tournaments.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

export type TournamentPhase = 'OPEN' | 'ACTIVE' | 'FINISHED';

export interface PublicTournament extends Tournament {
  phase: TournamentPhase;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizerId: string,
    dto: CreateTournamentDto,
  ): Promise<Tournament> {
    this.assertDateRange(dto.dateStart, dto.dateEnd);
    return this.prisma.tournament.create({
      data: {
        ...dto,
        dateStart: new Date(dto.dateStart),
        dateEnd: new Date(dto.dateEnd),
        organizerId,
      },
    });
  }

  async listAll(): Promise<Tournament[]> {
    return this.prisma.tournament.findMany({
      orderBy: [{ dateStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async listMine(
    organizerId: string,
    query: ListMineTournamentsDto,
  ): Promise<PageResult<Tournament>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TournamentWhereInput = {
      organizerId,
      status: query.status ?? { not: TournamentStatus.CANCELLED },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({
        where,
        orderBy: [{ dateStart: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findMine(organizerId: string, id: string): Promise<Tournament> {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t || t.organizerId !== organizerId) {
      throw new NotFoundException('Турнир не найден');
    }
    return t;
  }

  async listPublic(
    query: ListPublicTournamentsDto,
  ): Promise<PageResult<PublicTournament>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TournamentWhereInput = {
      status: {
        in: [
          TournamentStatus.PUBLISHED,
          TournamentStatus.IN_PROGRESS,
          TournamentStatus.FINISHED,
        ],
      },
    };
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.from || query.to) {
      where.dateStart = {};
      if (query.from) (where.dateStart as Prisma.DateTimeFilter).gte = new Date(query.from);
      if (query.to) (where.dateStart as Prisma.DateTimeFilter).lte = new Date(query.to);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({
        where,
        orderBy: [{ dateStart: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tournament.count({ where }),
    ]);

    const now = new Date();
    return {
      items: items.map((t) => ({ ...t, phase: computePhase(t, now) })),
      total,
      page,
      limit,
    };
  }

  async findPublic(id: string): Promise<PublicTournament> {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (
      !t ||
      t.status === TournamentStatus.DRAFT ||
      t.status === TournamentStatus.CANCELLED
    ) {
      throw new NotFoundException('Турнир не найден');
    }
    return { ...t, phase: computePhase(t, new Date()) };
  }

  async update(
    organizerId: string,
    id: string,
    dto: UpdateTournamentDto,
  ): Promise<Tournament> {
    const current = await this.findMine(organizerId, id);

    if (current.status === TournamentStatus.CANCELLED) {
      throw new ConflictException('Нельзя редактировать отменённый турнир');
    }
    if (
      current.status === TournamentStatus.PUBLISHED &&
      current.dateStart.getTime() <= startOfDay(new Date()).getTime()
    ) {
      throw new ConflictException(
        'Нельзя редактировать опубликованный турнир после даты начала',
      );
    }

    const dateStart = dto.dateStart ?? current.dateStart.toISOString();
    const dateEnd = dto.dateEnd ?? current.dateEnd.toISOString();
    this.assertDateRange(dateStart, dateEnd);

    const data: Prisma.TournamentUpdateInput = { ...dto };
    if (dto.dateStart) data.dateStart = new Date(dto.dateStart);
    if (dto.dateEnd) data.dateEnd = new Date(dto.dateEnd);

    return this.prisma.tournament.update({ where: { id }, data });
  }

  async publish(organizerId: string, id: string): Promise<Tournament> {
    const t = await this.findMine(organizerId, id);
    if (t.status === TournamentStatus.PUBLISHED) {
      throw new ConflictException('Турнир уже опубликован');
    }
    if (t.status === TournamentStatus.CANCELLED) {
      throw new ConflictException('Нельзя опубликовать отменённый турнир');
    }
    if (!t.categories.length) {
      throw new ConflictException('Укажите хотя бы одну весовую категорию');
    }
    if (t.dateEnd.getTime() < t.dateStart.getTime()) {
      throw new ConflictException('Некорректные даты турнира');
    }
    return this.prisma.tournament.update({
      where: { id },
      data: {
        status: TournamentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  async cancel(organizerId: string, id: string): Promise<Tournament> {
    const t = await this.findMine(organizerId, id);
    if (t.status !== TournamentStatus.PUBLISHED) {
      throw new ConflictException(
        'Отменить можно только опубликованный турнир. Черновик удалите через DELETE.',
      );
    }
    return this.prisma.tournament.update({
      where: { id },
      data: { status: TournamentStatus.CANCELLED },
    });
  }

  async remove(organizerId: string, id: string): Promise<void> {
    const t = await this.findMine(organizerId, id);
    if (t.status !== TournamentStatus.DRAFT) {
      throw new ConflictException(
        'Удалить можно только черновик. Опубликованный турнир отмените через /cancel.',
      );
    }
    await this.prisma.tournament.delete({ where: { id } });
  }

  private assertDateRange(start: string, end: string): void {
    if (new Date(end).getTime() < new Date(start).getTime()) {
      throw new BadRequestException('dateEnd не может быть раньше dateStart');
    }
  }
}

export function computePhase(t: Tournament, _now: Date): TournamentPhase {
  if (t.status === TournamentStatus.PUBLISHED) return 'OPEN';
  if (t.status === TournamentStatus.IN_PROGRESS) return 'ACTIVE';
  return 'FINISHED';
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
