import type { Page, APIRequestContext } from '@playwright/test';

const API_URL = `http://localhost:${process.env.E2E_API_PORT ?? 3000}/api/v1`;

export interface RegisteredUser {
  email: string;
  password: string;
  fullName: string;
  role: 'ORGANIZER' | 'TRAINER' | 'JUDGE';
  id: string;
  accessToken: string;
  refreshToken: string;
}

export const PASSWORD = 'Strong1pw';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@boxr.test`;
}

export async function registerUser(
  request: APIRequestContext,
  role: RegisteredUser['role'],
  fullName = 'E2E User',
): Promise<RegisteredUser> {
  const email = uniqueEmail(role.toLowerCase());
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password: PASSWORD, fullName, role },
  });
  if (!res.ok()) {
    throw new Error(`register failed ${res.status()}: ${await res.text()}`);
  }
  const body = (await res.json()) as {
    user: { id: string };
    accessToken: string;
    refreshToken: string;
  };
  return {
    email,
    password: PASSWORD,
    fullName,
    role,
    id: body.user.id,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };
}

export async function seedTokens(page: Page, user: RegisteredUser): Promise<void> {
  if (page.url() === 'about:blank') {
    await page.goto('/');
  }
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem('boxr.access', access);
      localStorage.setItem('boxr.refresh', refresh);
    },
    { access: user.accessToken, refresh: user.refreshToken },
  );
}

export async function clearTokens(page: Page): Promise<void> {
  if (page.url() === 'about:blank') {
    await page.goto('/');
  }
  await page.evaluate(() => {
    localStorage.removeItem('boxr.access');
    localStorage.removeItem('boxr.refresh');
  });
}

export async function loginViaApi(
  page: Page,
  request: APIRequestContext,
  role: RegisteredUser['role'] = 'ORGANIZER',
): Promise<RegisteredUser> {
  const user = await registerUser(request, role);
  await seedTokens(page, user);
  return user;
}

export interface CreateTournamentApiInput {
  name?: string;
  status?: 'DRAFT' | 'PUBLISHED';
  dateStart?: string;
  dateEnd?: string;
  city?: string;
  categories?: number[];
}

export async function createTournamentViaApi(
  request: APIRequestContext,
  user: RegisteredUser,
  input: CreateTournamentApiInput = {},
): Promise<{ id: string; name: string; status: string }> {
  const body = {
    name: input.name ?? `Тест-турнир ${Date.now()}`,
    type: 'REGIONAL',
    level: 'AMATEUR',
    dateStart: input.dateStart ?? '2099-06-14',
    dateEnd: input.dateEnd ?? '2099-06-16',
    city: input.city ?? 'Москва',
    categories: input.categories ?? [60, 67, 75],
    rounds: 3,
    roundDuration: 3,
    helmets: false,
  };
  const res = await request.post(`${API_URL}/tournaments`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: body,
  });
  if (!res.ok()) {
    throw new Error(`create failed ${res.status()}: ${await res.text()}`);
  }
  const t = (await res.json()) as { id: string; name: string; status: string };
  if (input.status === 'PUBLISHED') {
    const pub = await request.post(`${API_URL}/tournaments/${t.id}/publish`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    if (!pub.ok()) {
      throw new Error(`publish failed ${pub.status()}: ${await pub.text()}`);
    }
    return { ...t, status: 'PUBLISHED' };
  }
  return t;
}

export interface CreateBoxerApiInput {
  fullName?: string;
  weight?: number;
  dob?: string;
  gender?: 'MALE' | 'FEMALE';
}

export async function createBoxerViaApi(
  request: APIRequestContext,
  trainer: RegisteredUser,
  input: CreateBoxerApiInput = {},
): Promise<{ id: string; fullName: string }> {
  const res = await request.post(`${API_URL}/boxers`, {
    headers: { Authorization: `Bearer ${trainer.accessToken}` },
    data: {
      fullName: input.fullName ?? `Боксёр ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      dob: input.dob ?? '2000-01-15',
      gender: input.gender ?? 'MALE',
      weight: input.weight ?? 71,
    },
  });
  if (!res.ok()) throw new Error(`createBoxer failed ${res.status()}: ${await res.text()}`);
  return (await res.json()) as { id: string; fullName: string };
}

export async function submitApplicationViaApi(
  request: APIRequestContext,
  trainer: RegisteredUser,
  tournamentId: string,
  boxerId: string,
  category: number,
): Promise<{ id: string }> {
  const res = await request.post(`${API_URL}/applications`, {
    headers: { Authorization: `Bearer ${trainer.accessToken}` },
    data: { tournamentId, items: [{ boxerId, category }] },
  });
  if (!res.ok()) throw new Error(`submit failed ${res.status()}: ${await res.text()}`);
  const body = (await res.json()) as { items: Array<{ id: string }> };
  return body.items[0];
}

export async function approveApplicationViaApi(
  request: APIRequestContext,
  organizer: RegisteredUser,
  applicationId: string,
): Promise<void> {
  const res = await request.post(`${API_URL}/applications/${applicationId}/approve`, {
    headers: { Authorization: `Bearer ${organizer.accessToken}` },
  });
  if (!res.ok()) throw new Error(`approve failed ${res.status()}: ${await res.text()}`);
}
