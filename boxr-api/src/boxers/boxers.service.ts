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
    const { passportIssuedAt, ...rest } = dto;
    return this.prisma.boxer.create({
      data: {
        ...rest,
        dob: new Date(dto.dob),
        passportIssuedAt: passportIssuedAt ? new Date(passportIssuedAt) : undefined,
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
    const { passportIssuedAt, ...rest } = dto;
    const data: Prisma.BoxerUpdateInput = { ...rest };
    if (dto.dob) data.dob = new Date(dto.dob);
    if (passportIssuedAt) data.passportIssuedAt = new Date(passportIssuedAt);
    return this.prisma.boxer.update({ where: { id }, data });
  }

  async remove(trainerId: string, id: string): Promise<void> {
    const b = await this.findMine(trainerId, id);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const active = await this.prisma.application.count({
      where: {
        boxerId: b.id,
        status: { in: [ApplicationStatus.PENDING, ApplicationStatus.APPROVED] },
        tournament: { dateStart: { gte: today } },
      },
    });
    if (active > 0) {
      throw new ConflictException(
        'Нельзя удалить боксёра с активными заявками на текущие или будущие турниры',
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
