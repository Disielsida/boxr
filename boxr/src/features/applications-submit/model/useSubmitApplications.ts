import { useState } from 'react';

import {
  ApiError,
  applicationsApi,
  type SubmitApplicationsInput,
  type SubmitErrorResponse,
} from '@/shared/api';

import type { Application } from '@/shared/types';

interface Result {
  submitting: boolean;
  error: string | null;
  perItemErrors: Record<number, string>;
  submit: (input: SubmitApplicationsInput) => Promise<Application[] | null>;
}

export const useSubmitApplications = (): Result => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perItemErrors, setPerItemErrors] = useState<Record<number, string>>({});

  const submit = async (input: SubmitApplicationsInput) => {
    setSubmitting(true);
    setError(null);
    setPerItemErrors({});
    try {
      const res = await applicationsApi.submit(input);
      return res.items;
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && isErrorResponse(e.payload)) {
        const map: Record<number, string> = {};
        for (const x of e.payload.errors) map[x.index] = x.message;
        setPerItemErrors(map);
        setError(e.payload.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'Не удалось подать заявку');
      }
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, perItemErrors, submit };
};

function isErrorResponse(p: unknown): p is SubmitErrorResponse {
  return !!p && typeof p === 'object' && Array.isArray((p as { errors?: unknown }).errors);
}
