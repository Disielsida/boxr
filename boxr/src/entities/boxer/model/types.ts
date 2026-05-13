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
