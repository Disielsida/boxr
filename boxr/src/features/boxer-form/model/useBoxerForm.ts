import { useState } from 'react';

import {
  ApiError,
  boxersApi,
  type CreateBoxerInput,
  type UpdateBoxerInput,
} from '@/shared/api';

import type { Boxer } from '@/shared/types';

interface Result {
  submitting: boolean;
  error: string | null;
  create: (input: CreateBoxerInput) => Promise<Boxer>;
  update: (id: string, input: UpdateBoxerInput) => Promise<Boxer>;
}

export const useBoxerForm = (): Result => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSubmitting(true);
    setError(null);
    try { return await fn(); }
    catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить боксёра');
      throw e;
    } finally { setSubmitting(false); }
  };
  return {
    submitting,
    error,
    create: (input) => run(() => boxersApi.create(input)),
    update: (id, input) => run(() => boxersApi.update(id, input)),
  };
};
