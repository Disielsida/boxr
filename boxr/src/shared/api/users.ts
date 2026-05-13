import { request } from './client';

import type { JudgeInfo, UserRole } from '../types';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

const ROLE_FROM_API: Record<string, UserRole> = {
  ORGANIZER: 'organizer',
  TRAINER: 'trainer',
  JUDGE: 'judge',
  ADMIN: 'admin',
};

const ROLE_TO_API: Record<UserRole, string> = {
  organizer: 'ORGANIZER',
  trainer: 'TRAINER',
  judge: 'JUDGE',
  admin: 'ADMIN',
};

export const usersApi = {
  listJudges: () => request<JudgeInfo[]>('/users/judges'),

  async listAll(search?: string): Promise<AdminUser[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const raw = await request<Array<{ id: string; fullName: string; email: string; role: string; createdAt: string }>>(`/users${params}`);
    return raw.map((u) => ({ ...u, role: ROLE_FROM_API[u.role] ?? (u.role as UserRole) }));
  },

  updateRole: (id: string, role: UserRole) =>
    request<{ ok: boolean }>(`/users/${id}/role`, {
      method: 'PATCH',
      body: { role: ROLE_TO_API[role] },
    }),

  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
};
