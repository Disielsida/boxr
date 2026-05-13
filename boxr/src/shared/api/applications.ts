import { request } from './client';

import type {
  Application,
  ApplicationStatus,
  Boxer,
  Tournament,
} from '@/shared/types';

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
  if (raw.boxer) {
    const b = raw.boxer as Record<string, unknown>;
    const RANK_MAP: Record<string, string> = {
      NONE: 'none', THIRD_CLASS: 'third_class', SECOND_CLASS: 'second_class',
      FIRST_CLASS: 'first_class', CMS: 'cms', MS: 'ms', MSIC: 'msic',
    };
    a.boxer = {
      ...b,
      dob: typeof b.dob === 'string' ? b.dob.slice(0, 10) : b.dob,
      rank: typeof b.rank === 'string' ? (RANK_MAP[b.rank] ?? b.rank) : b.rank,
    } as Boxer;
  }
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
