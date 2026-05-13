import { request } from './client';

import type {
  PublicTournament,
  Tournament,
  TournamentLevel,
  TournamentPhase,
  TournamentStatus,
  TournamentType,
} from '@/shared/types';

interface RawTournament {
  id: string;
  name: string;
  type: string;
  level: string;
  status: string;
  dateStart: string;
  dateEnd: string;
  city: string;
  address: string | null;
  categories: number[];
  rounds: number;
  roundDuration: number;
  helmets: boolean;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  ringCount: number;
  dayStartTime: string;
  slotMinutes: number;
  minRestMinutes: number;
}

interface RawPublicTournament extends RawTournament {
  phase: string;
}

interface RawPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTournamentInput {
  name: string;
  type: TournamentType;
  level: TournamentLevel;
  dateStart: string;
  dateEnd: string;
  city: string;
  address?: string;
  categories: number[];
  rounds: number;
  roundDuration: number;
  helmets: boolean;
  ringCount?: number;
}

export type UpdateTournamentInput = Partial<CreateTournamentInput>;

export interface ListPublicQuery {
  city?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ListMineQuery {
  status?: TournamentStatus;
  page?: number;
  limit?: number;
}

const TYPE_TO_API: Record<TournamentType, string> = {
  regional: 'REGIONAL',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
};
const LEVEL_TO_API: Record<TournamentLevel, string> = {
  amateur: 'AMATEUR',
  professional: 'PROFESSIONAL',
  mixed: 'MIXED',
};
const STATUS_TO_API: Record<TournamentStatus, string> = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  in_progress: 'IN_PROGRESS',
  finished: 'FINISHED',
  cancelled: 'CANCELLED',
};

const TYPE_FROM_API: Record<string, TournamentType> = {
  REGIONAL: 'regional',
  NATIONAL: 'national',
  INTERNATIONAL: 'international',
};
const LEVEL_FROM_API: Record<string, TournamentLevel> = {
  AMATEUR: 'amateur',
  PROFESSIONAL: 'professional',
  MIXED: 'mixed',
};
const STATUS_FROM_API: Record<string, TournamentStatus> = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  IN_PROGRESS: 'in_progress',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
};
const PHASE_FROM_API: Record<string, TournamentPhase> = {
  OPEN: 'open',
  ACTIVE: 'active',
  FINISHED: 'finished',
};

function mapTournament(raw: RawTournament): Tournament {
  return {
    ...raw,
    type: TYPE_FROM_API[raw.type],
    level: LEVEL_FROM_API[raw.level],
    status: STATUS_FROM_API[raw.status],
    dateStart: raw.dateStart.slice(0, 10),
    dateEnd: raw.dateEnd.slice(0, 10),
  };
}

function mapPublic(raw: RawPublicTournament): PublicTournament {
  return { ...mapTournament(raw), phase: PHASE_FROM_API[raw.phase] };
}

function mapInput(input: CreateTournamentInput | UpdateTournamentInput): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if (input.type) out.type = TYPE_TO_API[input.type];
  if (input.level) out.level = LEVEL_TO_API[input.level];
  return out;
}

function buildQuery(params: Record<string, string | number | undefined> | object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const tournamentsApi = {
  async listPublic(query: ListPublicQuery = {}): Promise<Page<PublicTournament>> {
    const raw = await request<RawPage<RawPublicTournament>>(
      `/tournaments/public${buildQuery(query)}`,
      { auth: false },
    );
    return { ...raw, items: raw.items.map(mapPublic) };
  },

  async findPublic(id: string): Promise<PublicTournament> {
    const raw = await request<RawPublicTournament>(`/tournaments/public/${id}`, {
      auth: false,
    });
    return mapPublic(raw);
  },

  async listMine(query: ListMineQuery = {}): Promise<Page<Tournament>> {
    const apiQuery: Record<string, string | number | undefined> = {
      page: query.page,
      limit: query.limit,
    };
    if (query.status) apiQuery.status = STATUS_TO_API[query.status];
    const raw = await request<RawPage<RawTournament>>(
      `/tournaments/mine${buildQuery(apiQuery)}`,
    );
    return { ...raw, items: raw.items.map(mapTournament) };
  },

  async findOne(id: string): Promise<Tournament> {
    const raw = await request<RawTournament>(`/tournaments/${id}`);
    return mapTournament(raw);
  },

  async create(input: CreateTournamentInput): Promise<Tournament> {
    const raw = await request<RawTournament>('/tournaments', {
      method: 'POST',
      body: mapInput(input),
    });
    return mapTournament(raw);
  },

  async update(id: string, input: UpdateTournamentInput): Promise<Tournament> {
    const raw = await request<RawTournament>(`/tournaments/${id}`, {
      method: 'PATCH',
      body: mapInput(input),
    });
    return mapTournament(raw);
  },

  async publish(id: string): Promise<Tournament> {
    const raw = await request<RawTournament>(`/tournaments/${id}/publish`, {
      method: 'POST',
    });
    return mapTournament(raw);
  },

  async cancel(id: string): Promise<Tournament> {
    const raw = await request<RawTournament>(`/tournaments/${id}/cancel`, {
      method: 'POST',
    });
    return mapTournament(raw);
  },

  async remove(id: string): Promise<void> {
    await request<void>(`/tournaments/${id}`, { method: 'DELETE' });
  },

  async listAll(): Promise<Tournament[]> {
    const raw = await request<RawTournament[]>('/tournaments/admin/all');
    return raw.map(mapTournament);
  },
};
