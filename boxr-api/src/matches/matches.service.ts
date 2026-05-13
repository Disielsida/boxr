import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MatchOutcome, MatchStatus, Prisma, Role, TournamentStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { buildCategoryBracket } from './bracket-builder';
import { planSchedule, PlannerInputMatch } from './schedule-builder';

/**
 * Match считается «реально зафиксированным» (а не bye-результатом),
 * если он COMPLETED и НЕ является walkover-ом из-за пустого слота.
 */
const nonByeCompletedFilter: Prisma.MatchWhereInput = {
  status: MatchStatus.COMPLETED,
  NOT: {
    AND: [
      { outcome: MatchOutcome.WO },
      { OR: [{ redBoxerId: null }, { blueBoxerId: null }] },
    ],
  },
};

function computeMatchDuration(rounds: number, roundDuration: number): number {
  return rounds * roundDuration + Math.max(0, rounds - 1);
}

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

export interface BracketResponseCategory {
  weight: number;
  rounds: number;
  matches: BracketResponseMatch[];
}

export interface BracketResponse {
  tournament: { id: string; name: string; status: TournamentStatus };
  categories: BracketResponseCategory[];
}

export interface SetResultInput {
  winner: 'RED' | 'BLUE';
  outcome: 'KO' | 'WP' | 'RSC' | 'DSQ' | 'WO';
  endRound?: number;
}

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

export interface MatchForScoringBoxer {
  boxerId: string;
  fullName: string;
  club: string | null;
  rank: string;
}

export interface MatchForScoringResponse {
  match: {
    id: string;
    round: number;
    position: number;
    status: 'PENDING' | 'READY' | 'COMPLETED';
    red: MatchForScoringBoxer | null;
    blue: MatchForScoringBoxer | null;
    ring: number | null;
    scheduledAt: string | null;
  };
  tournament: {
    id: string;
    name: string;
    rounds: number;
    roundDuration: number;
  };
}

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

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async generateBracket(userId: string, tournamentId: string): Promise<BracketResponse> {
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
          where: { tournamentId, ...nonByeCompletedFilter },
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
    return this.buildBracketResponse(tournamentId);
  }

  async getBracketForOwner(userId: string, tournamentId: string): Promise<BracketResponse> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');
    if (tournament.organizerId !== userId) throw new ForbiddenException('Доступ запрещён');
    return this.buildBracketResponse(tournamentId);
  }

  async getPublicBracket(tournamentId: string): Promise<BracketResponse> {
    await this.assertPublicVisibility(tournamentId);
    return this.buildBracketResponse(tournamentId);
  }

  private async assertPublicVisibility(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');
    if (
      tournament.status === TournamentStatus.DRAFT ||
      tournament.status === TournamentStatus.CANCELLED
    ) {
      throw new NotFoundException('Турнир не найден');
    }
    return tournament;
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
          scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
          ring: m.ring,
          judgeId: m.judgeId,
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

  async setResult(
    user: AuthUser,
    matchId: string,
    input: SetResultInput,
  ): Promise<BracketResponse> {
    const tournamentId = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { tournament: true },
      });
      if (!match) throw new NotFoundException('Матч не найден');
      if (user.role === Role.ORGANIZER && match.tournament.organizerId !== user.id) {
        throw new ForbiddenException('Доступ запрещён');
      } else if (user.role === Role.JUDGE && match.judgeId !== user.id) {
        throw new ForbiddenException('Доступ запрещён');
      } else if (user.role !== Role.ORGANIZER && user.role !== Role.JUDGE) {
        throw new ForbiddenException('Доступ запрещён');
      }
      if (match.status === MatchStatus.COMPLETED) {
        // Разрешаем перезапись в 10-минутное окно
        const EDIT_WINDOW_SEC = 600;
        const elapsed = match.decidedAt
          ? (Date.now() - match.decidedAt.getTime()) / 1000
          : Infinity;
        if (elapsed > EDIT_WINDOW_SEC) {
          throw new UnprocessableEntityException('Окно редактирования закрыто (10 минут)');
        }
        // Следующий матч не должен быть уже проведён
        if (match.nextMatchId) {
          const next = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
          if (next.status === MatchStatus.COMPLETED) {
            throw new UnprocessableEntityException('Следующий матч уже проведён, редактирование невозможно');
          }
        }
        // Откатываем предыдущий каскад
        if (match.nextMatchId && match.nextSlot) {
          const slotData: Prisma.MatchUpdateInput =
            match.nextSlot === 'RED'
              ? { redBoxer: { disconnect: true } }
              : { blueBoxer: { disconnect: true } };
          await tx.match.update({
            where: { id: match.nextMatchId },
            data: { ...slotData, status: MatchStatus.PENDING },
          });
        }
        // Если турнир стал FINISHED из-за этого матча — возвращаем в IN_PROGRESS
        const tournamentStatus = (
          await tx.tournament.findUniqueOrThrow({ where: { id: match.tournamentId }, select: { status: true } })
        ).status;
        if (tournamentStatus === TournamentStatus.FINISHED) {
          await tx.tournament.update({
            where: { id: match.tournamentId },
            data: { status: TournamentStatus.IN_PROGRESS },
          });
        }
        await tx.match.update({
          where: { id: matchId },
          data: { winnerId: null, outcome: null, endRound: null, decidedAt: null, status: MatchStatus.READY },
        });
      } else {
        if (match.tournament.status !== TournamentStatus.IN_PROGRESS) {
          throw new UnprocessableEntityException('Турнир не в активной фазе');
        }
        if (match.status !== MatchStatus.READY) {
          throw new UnprocessableEntityException('Матч ещё не готов к фиксации');
        }
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

      if (!match.redBoxerId || !match.blueBoxerId) {
        // Невозможно при status === READY, но защищаемся от инварианта
        throw new UnprocessableEntityException('Матч ещё не готов к фиксации');
      }
      const winnerId = input.winner === 'RED' ? match.redBoxerId : match.blueBoxerId;

      // 1) фиксируем результат в текущем матче
      await tx.match.update({
        where: { id: matchId },
        data: {
          winnerId,
          outcome: input.outcome,
          endRound: requiresEndRound ? input.endRound! : null,
          status: MatchStatus.COMPLETED,
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
          data: { ...nextData, status: willBeReady ? MatchStatus.READY : MatchStatus.PENDING },
        });
      }

      // 3) если все финалы во всех категориях COMPLETED — переводим турнир в FINISHED
      const remaining = await tx.match.count({
        where: {
          tournamentId: match.tournamentId,
          nextMatchId: null,
          status: { not: MatchStatus.COMPLETED },
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
      if (match.status !== MatchStatus.COMPLETED) {
        throw new UnprocessableEntityException('Матч не зафиксирован');
      }
      // Запрет на откат bye-матчей
      const isBye =
        match.outcome === MatchOutcome.WO &&
        (match.redBoxerId === null || match.blueBoxerId === null);
      if (isBye) {
        throw new UnprocessableEntityException(
          'Bye-матч не редактируется, перегенерируйте сетку',
        );
      }
      // nextMatch не должен быть COMPLETED
      if (match.nextMatchId) {
        const next = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
        if (next.status === MatchStatus.COMPLETED) {
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
          status: MatchStatus.READY,
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
          data: { ...slotData, status: MatchStatus.PENDING },
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

  async generateSchedule(userId: string, tournamentId: string): Promise<BracketResponse> {
    await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw new NotFoundException('Турнир не найден');
      if (tournament.organizerId !== userId) throw new ForbiddenException('Доступ запрещён');
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        throw new UnprocessableEntityException('Расписание можно строить только для активного турнира');
      }

      // Прошедшие завершённые матчи (не bye) — те, что уже отыграны и не трогаем
      const todayStr = new Date().toISOString().slice(0, 10);
      const pastCompleted = await tx.match.findMany({
        where: {
          tournamentId,
          scheduledAt: { lt: new Date(todayStr) },
          ...nonByeCompletedFilter,
        },
        select: { id: true },
      });
      const pastCompletedIds = new Set(pastCompleted.map((m) => m.id));

      const all = await tx.match.findMany({
        where: { tournamentId },
        orderBy: [{ round: 'asc' }, { position: 'asc' }],
      });
      const isBye = (m: typeof all[number]) =>
        m.outcome === MatchOutcome.WO && (m.redBoxerId === null || m.blueBoxerId === null);
      const nonBye = all.filter((m) => !isBye(m));
      if (nonBye.length === 0) {
        throw new UnprocessableEntityException('Нет матчей для расписания');
      }

      // Планируем только матчи, не входящие в прошедшие завершённые
      const toSchedule = nonBye.filter((m) => !pastCompletedIds.has(m.id));

      const prevByNext = new Map<string, string[]>();
      for (const m of all) {
        if (m.nextMatchId) {
          const arr = prevByNext.get(m.nextMatchId) ?? [];
          arr.push(m.id);
          prevByNext.set(m.nextMatchId, arr);
        }
      }
      const input: PlannerInputMatch[] = toSchedule.map((m) => ({
        id: m.id,
        category: m.category,
        round: m.round,
        position: m.position,
        redBoxerId: m.redBoxerId,
        blueBoxerId: m.blueBoxerId,
        prevMatchIds: (prevByNext.get(m.id) ?? []).filter((pid) => {
          const p = all.find((x) => x.id === pid);
          return p && !isBye(p);
        }),
      }));

      // Начинаем расписание с сегодня (или с dateStart, если турнир ещё не начался)
      const dateStartStr = tournament.dateStart.toISOString().slice(0, 10);
      const effectiveDateStart = todayStr > dateStartStr ? todayStr : dateStartStr;

      const result = planSchedule(input, {
        dateStart: effectiveDateStart,
        dateEnd: tournament.dateEnd.toISOString().slice(0, 10),
        ringCount: tournament.ringCount,
        dayStartTime: tournament.dayStartTime,
        dayEndTime: '22:00',
        slotMinutes: tournament.slotMinutes,
        minRestMinutes: tournament.minRestMinutes,
        matchDuration: computeMatchDuration(tournament.rounds, tournament.roundDuration),
      });
      if ('error' in result) {
        throw new UnprocessableEntityException(result.error);
      }

      // Сбрасываем расписание только у матчей, не входящих в прошедшие завершённые
      const excludeIds = [...pastCompletedIds];
      await tx.match.updateMany({
        where: {
          tournamentId,
          ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        },
        data: { scheduledAt: null, ring: null },
      });
      for (const a of result.assignments) {
        await tx.match.update({
          where: { id: a.matchId },
          data: { scheduledAt: new Date(a.scheduledAt), ring: a.ring },
        });
      }
    });
    return this.buildBracketResponse(tournamentId);
  }

  async clearSchedule(userId: string, tournamentId: string): Promise<BracketResponse> {
    await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
      if (!tournament) throw new NotFoundException('Турнир не найден');
      if (tournament.organizerId !== userId) throw new ForbiddenException('Доступ запрещён');
      if (tournament.status !== TournamentStatus.IN_PROGRESS) {
        throw new UnprocessableEntityException('Расписание можно сбрасывать только у активного турнира');
      }
      const blocking = await tx.match.findFirst({
        where: { tournamentId, ...nonByeCompletedFilter },
      });
      if (blocking) {
        throw new UnprocessableEntityException('Нельзя сбросить расписание: есть зафиксированные результаты');
      }
      await tx.match.updateMany({
        where: { tournamentId },
        data: { scheduledAt: null, ring: null },
      });
    });
    return this.buildBracketResponse(tournamentId);
  }

  async setSchedule(
    userId: string,
    matchId: string,
    scheduledAtIso: string,
    ring: number,
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
      if (match.status === MatchStatus.COMPLETED) {
        throw new UnprocessableEntityException('Зафиксированный матч не редактируется');
      }
      if (ring < 1 || ring > match.tournament.ringCount) {
        throw new UnprocessableEntityException(`Ринг ${ring} не существует у этого турнира`);
      }
      const newDate = new Date(scheduledAtIso);
      if (Number.isNaN(newDate.getTime())) {
        throw new UnprocessableEntityException('Невалидное время');
      }
      const tournamentStart = new Date(match.tournament.dateStart);
      const tournamentEndPlus = new Date(match.tournament.dateEnd);
      tournamentEndPlus.setUTCHours(22, 0, 0, 0);
      if (newDate < tournamentStart || newDate > tournamentEndPlus) {
        throw new UnprocessableEntityException('Время вне диапазона дат турнира');
      }
      const conflict = await tx.match.findFirst({
        where: {
          tournamentId: match.tournamentId,
          scheduledAt: newDate,
          ring,
          NOT: { id: matchId },
        },
      });
      if (conflict) {
        throw new UnprocessableEntityException(`Ринг ${ring} занят в это время другим боем`);
      }
      const matchDuration = computeMatchDuration(match.tournament.rounds, match.tournament.roundDuration);
      const predecessors = await tx.match.findMany({
        where: { nextMatchId: matchId, scheduledAt: { not: null } },
      });
      for (const p of predecessors) {
        const pEnd = new Date(p.scheduledAt!.getTime() + matchDuration * 60_000);
        if (newDate < pEnd) {
          throw new UnprocessableEntityException(
            'Полуфинал/четвертьфинал, питающий этот матч, ещё не закончится к этому времени',
          );
        }
      }
      const boxerIds = [match.redBoxerId, match.blueBoxerId].filter((x): x is string => x !== null);
      if (boxerIds.length > 0) {
        const others = await tx.match.findMany({
          where: {
            tournamentId: match.tournamentId,
            scheduledAt: { not: null },
            NOT: { id: matchId },
            OR: [
              { redBoxerId: { in: boxerIds } },
              { blueBoxerId: { in: boxerIds } },
            ],
          },
        });
        const restMs = match.tournament.minRestMinutes * 60_000;
        for (const o of others) {
          const oStart = o.scheduledAt!.getTime();
          const oEnd = oStart + matchDuration * 60_000;
          const newStart = newDate.getTime();
          const newEnd = newStart + matchDuration * 60_000;
          if (newStart < oEnd + restMs && oStart < newEnd + restMs) {
            throw new UnprocessableEntityException(
              `Боксёр должен отдыхать минимум ${match.tournament.minRestMinutes} минут между боями`,
            );
          }
        }
      }
      await tx.match.update({
        where: { id: matchId },
        data: { scheduledAt: newDate, ring },
      });
      return match.tournamentId;
    });
    return this.buildBracketResponse(tournamentId);
  }

  async getPublicResults(tournamentId: string): Promise<ResultsResponse> {
    const tournament = await this.assertPublicVisibility(tournamentId);

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
      const finished = final?.status === MatchStatus.COMPLETED;

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
        const semis = list.filter(
          (m) => m.round === rounds - 1 && m.status === MatchStatus.COMPLETED,
        );
        for (const s of semis) {
          const loser = s.winnerId === s.redBoxerId ? s.blueBoxer : s.redBoxer;
          if (loser) bronze.push({ boxerId: loser.id, fullName: loser.fullName, club: loser.club });
        }
      }

      const finals: ResultsResponseFinal[] = [];
      for (const m of list) {
        if (m.status !== MatchStatus.COMPLETED) continue;
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
    if (user.role === Role.ORGANIZER && match.tournament.organizerId !== user.id) {
      throw new ForbiddenException('Доступ запрещён');
    } else if (user.role === Role.JUDGE && match.judgeId !== user.id) {
      throw new ForbiddenException('Доступ запрещён');
    } else if (user.role !== Role.ORGANIZER && user.role !== Role.JUDGE) {
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

  async assignJudge(
    organizerId: string,
    tournamentId: string,
    matchId: string,
    judgeId: string,
  ): Promise<{ matchId: string; judgeId: string; judgeName: string }> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Турнир не найден');
    if (tournament.organizerId !== organizerId) throw new ForbiddenException('Доступ запрещён');
    if (
      tournament.status === TournamentStatus.CANCELLED ||
      tournament.status === TournamentStatus.FINISHED
    ) {
      throw new UnprocessableEntityException('Турнир уже завершён или отменён');
    }

    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Матч не найден');
    if (match.tournamentId !== tournamentId) throw new NotFoundException('Матч не найден');
    if (match.status === MatchStatus.COMPLETED) {
      throw new UnprocessableEntityException('Нельзя изменить судью завершённого матча');
    }

    const judge = await this.prisma.user.findUnique({ where: { id: judgeId } });
    if (!judge || judge.role !== Role.JUDGE) throw new NotFoundException('Судья не найден');

    await this.prisma.match.update({ where: { id: matchId }, data: { judgeId } });

    return { matchId, judgeId, judgeName: judge.fullName };
  }

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
