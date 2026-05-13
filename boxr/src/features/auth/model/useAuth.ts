import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { ApiError } from '@/shared/api';

import type { UserRole } from '@/shared/types';

export type AuthMode = 'login' | 'register';

interface SubmitInput {
  mode: AuthMode;
  email: string;
  password: string;
  name?: string;
  role: UserRole;
}

const ROLE_HOME: Record<UserRole, string> = {
  organizer: '/dashboard',
  trainer: '/trainer',
  judge: '/judge',
};

export const useAuth = () => {
  const navigate = useNavigate();
  const { login, register } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async ({ mode, email, password, name, role }: SubmitInput): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const user =
        mode === 'login'
          ? await login(email, password)
          : await register({ email, password, fullName: name ?? '', role });
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить запрос');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, submit };
};
