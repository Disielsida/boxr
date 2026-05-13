import { request, BASE_URL, tokenStorage } from './client';

import type { Boxer, BoxerRank, Gender, PassportOcrResult } from '@/shared/types';

interface RawBoxer {
  id: string;
  fullName: string;
  dob: string;
  gender: string;
  weight: number;
  club: string | null;
  rank: string;
  passportSeries: string | null;
  passportNumber: string | null;
  passportIssuedBy: string | null;
  passportIssuedAt: string | null;
  passportDivisionCode: string | null;
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
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssuedAt?: string;
  passportDivisionCode?: string;
}
export type UpdateBoxerInput = Partial<CreateBoxerInput>;

function mapBoxer(raw: RawBoxer): Boxer {
  return {
    ...raw,
    gender: GENDER_FROM_API[raw.gender],
    rank: RANK_FROM_API[raw.rank] ?? 'none',
    dob: raw.dob.slice(0, 10),
    passportIssuedAt: raw.passportIssuedAt ? raw.passportIssuedAt.slice(0, 10) : null,
  };
}

function mapInput(input: CreateBoxerInput | UpdateBoxerInput): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if (input.gender) out.gender = GENDER_TO_API[input.gender];
  if (input.rank) out.rank = RANK_TO_API[input.rank];
  return out;
}

async function ocrPassport(file: File): Promise<PassportOcrResult> {
  const form = new FormData();
  form.append('image', file);
  const token = tokenStorage.getAccess();
  const res = await fetch(`${BASE_URL}/boxers/ocr-passport`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? 'Ошибка OCR');
  }
  return res.json() as Promise<PassportOcrResult>;
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
  ocrPassport,
};
