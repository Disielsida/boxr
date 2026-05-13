import { request } from './client';

import type { UserRole } from '@/shared/types';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

interface AuthResponse {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
}

const ROLE_TO_API: Record<UserRole, string> = {
  organizer: 'ORGANIZER',
  trainer: 'TRAINER',
  judge: 'JUDGE',
};

const ROLE_FROM_API: Record<string, UserRole> = {
  ORGANIZER: 'organizer',
  TRAINER: 'trainer',
  JUDGE: 'judge',
};

interface RawUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

interface RawAuthResponse {
  user: RawUser;
  accessToken: string;
  refreshToken: string;
}

function mapUser(raw: RawUser): CurrentUser {
  return { ...raw, role: ROLE_FROM_API[raw.role] };
}

function mapAuth(raw: RawAuthResponse): AuthResponse {
  return { ...raw, user: mapUser(raw.user) };
}

export const authApi = {
  async register(input: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
  }): Promise<AuthResponse> {
    const raw = await request<RawAuthResponse>('/auth/register', {
      method: 'POST',
      auth: false,
      body: { ...input, role: ROLE_TO_API[input.role] },
    });
    return mapAuth(raw);
  },

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const raw = await request<RawAuthResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: input,
    });
    return mapAuth(raw);
  },

  async logout(refreshToken: string): Promise<void> {
    await request<void>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });
  },

  async me(): Promise<CurrentUser> {
    const raw = await request<RawUser>('/auth/me');
    return mapUser(raw);
  },
};
