import { useState } from 'react';

import {
  ApiError,
  tournamentsApi,
  type CreateTournamentInput,
  type UpdateTournamentInput,
} from '@/shared/api';

import type { Tournament } from '@/shared/types';

interface UseCreateTournamentResult {
  submitting: boolean;
  error: string | null;
  create: (input: CreateTournamentInput) => Promise<Tournament>;
  update: (id: string, input: UpdateTournamentInput) => Promise<Tournament>;
  reset: () => void;
}

export const useCreateTournament = (): UseCreateTournamentResult => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSubmitting(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Не удалось сохранить турнир';
      setError(message);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    error,
    create: (input) => run(() => tournamentsApi.create(input)),
    update: (id, input) => run(() => tournamentsApi.update(id, input)),
    reset: () => setError(null),
  };
};
