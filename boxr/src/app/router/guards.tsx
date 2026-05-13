import { Navigate, useLocation } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';

import type { UserRole } from '@/shared/types';
import type { ReactNode } from 'react';

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, initializing } = useAuthContext();
  const location = useLocation();
  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
};

export const RedirectIfAuth = ({ children }: { children: ReactNode }) => {
  const { user, initializing } = useAuthContext();
  if (initializing) return null;
  if (user) {
    const dest =
      user.role === 'trainer' ? '/trainer' :
      user.role === 'judge' ? '/judge' :
      user.role === 'admin' ? '/admin' :
      '/dashboard';
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
};

export const RequireRole = ({ role, children }: { role: UserRole | UserRole[]; children: ReactNode }) => {
  const { user, initializing } = useAuthContext();
  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(role) ? role.includes(user.role) : user.role === role;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
};
