import { useCallback, useEffect, useState } from 'react';

import { ApiError, applicationsApi } from '@/shared/api';

import type { Application, ApplicationStatus } from '@/shared/types';

interface Result {
  items: Application[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
}

export const useApplicationsReview = (
  tournamentId: string,
  status?: ApplicationStatus,
): Result => {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await applicationsApi.listForTournament(tournamentId, { status });
      setItems(page.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, status]);

  useEffect(() => { void refresh(); }, [refresh]);

  const approve = useCallback(async (id: string) => {
    try {
      const updated = await applicationsApi.approve(id);
      setItems((arr) => arr.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось одобрить');
    }
  }, []);

  const reject = useCallback(async (id: string, reason?: string) => {
    try {
      const updated = await applicationsApi.reject(id, reason);
      setItems((arr) => arr.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отклонить');
    }
  }, []);

  return { items, loading, error, refresh, approve, reject };
};
