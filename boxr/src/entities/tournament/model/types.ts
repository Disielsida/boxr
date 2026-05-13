import type {
  PublicTournament,
  Tournament,
  TournamentLevel,
  TournamentPhase,
  TournamentStatus,
  TournamentType,
} from '@/shared/types';

export type {
  Tournament,
  PublicTournament,
  TournamentType,
  TournamentLevel,
  TournamentStatus,
  TournamentPhase,
};

export const TYPE_LABEL: Record<TournamentType, string> = {
  regional: 'Региональный',
  national: 'Всероссийский',
  international: 'Международный',
};

export const LEVEL_LABEL: Record<TournamentLevel, string> = {
  amateur: 'Любители',
  professional: 'Профессионалы',
  mixed: 'Смешанный',
};

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  in_progress: 'Идёт',
  finished: 'Завершён',
  cancelled: 'Отменён',
};

export const PHASE_LABEL: Record<TournamentPhase, string> = {
  open: 'Регистрация',
  active: 'Идёт',
  finished: 'Завершён',
};

export function computePhase(t: Tournament, now: Date = new Date()): TournamentPhase {
  const today = startOfDay(now).getTime();
  const start = startOfDay(parseDate(t.dateStart)).getTime();
  const end = startOfDay(parseDate(t.dateEnd)).getTime();
  if (today < start) return 'open';
  if (today > end) return 'finished';
  return 'active';
}

export function formatDateRange(start: string, end: string): string {
  const a = parseDate(start);
  const b = parseDate(end);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(d);
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(b)} ${b.getUTCFullYear()}`;
  }
  return `${fmt(a)} — ${fmt(b)} ${b.getUTCFullYear()}`;
}

function parseDate(value: string): Date {
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  return new Date(iso);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
