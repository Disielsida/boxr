import { expect, test } from '@playwright/test';
import {
  approveApplicationViaApi,
  createBoxerViaApi,
  createTournamentViaApi,
  registerUser,
  seedTokens,
  submitApplicationViaApi,
} from './helpers';

test('организатор автогенерирует расписание и видит его на вкладке', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');

  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [71],
  });

  for (let i = 1; i <= 4; i++) {
    const b = await createBoxerViaApi(request, trainer, { fullName: `Sched ${i}`, weight: 71 });
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 71);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  // Сетку генерим через API
  const apiPort = process.env.E2E_API_PORT ?? 3000;
  const r = await request.post(
    `http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/bracket`,
    { headers: { Authorization: `Bearer ${organizer.accessToken}` } },
  );
  expect(r.ok()).toBeTruthy();

  await seedTokens(page, organizer);
  await page.goto(`/tournaments/${tournament.id}`);

  await page.getByRole('button', { name: 'Расписание' }).click();
  await page.getByRole('button', { name: 'Авто-расставить' }).click();

  await expect(page.getByText(/\d{2}:\d{2}/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /июня|июля|января|февраля/ }).first()).toBeVisible();
});

test('публичная страница показывает расписание после автогенерации', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');
  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [60],
  });

  for (let i = 0; i < 2; i++) {
    const b = await createBoxerViaApi(request, trainer, { fullName: `P${i}`, weight: 60 });
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 60);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  const apiPort = process.env.E2E_API_PORT ?? 3000;
  const headers = { Authorization: `Bearer ${organizer.accessToken}` };
  await request.post(`http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/bracket`, { headers });
  await request.post(`http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/schedule`, { headers });

  await page.goto(`/public/tournaments/${tournament.id}`);
  await expect(page.getByRole('heading', { name: 'Расписание' })).toBeVisible();
  await expect(page.getByText(/\d{2}:\d{2}/).first()).toBeVisible();
});
