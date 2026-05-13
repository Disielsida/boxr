import { expect, test } from '@playwright/test';
import {
  approveApplicationViaApi,
  createBoxerViaApi,
  createTournamentViaApi,
  registerUser,
  seedTokens,
  submitApplicationViaApi,
} from './helpers';

test('организатор генерирует сетку и доводит турнир до пьедестала', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');

  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [71],
  });

  // 4 боксёра в категории 71
  const boxers = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      createBoxerViaApi(request, trainer, { fullName: `E2E Boxer ${i}`, weight: 71 }),
    ),
  );
  for (const b of boxers) {
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 71);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  await seedTokens(page, organizer);
  await page.goto(`/tournaments/${tournament.id}`);

  await page.getByRole('button', { name: 'Жеребьёвка' }).click();
  await page.getByRole('button', { name: 'Сгенерировать сетку' }).click();

  await expect(page.getByText('71 кг')).toBeVisible();

  // Фиксируем 3 матча (2 полуфинала + финал) — каждый раз кликаем по READY-карточке
  for (let i = 0; i < 3; i++) {
    const readyCard = page.locator('button:not([disabled])', { hasText: '🔴' }).first();
    await readyCard.click();
    await page.getByRole('button', { name: 'Утвердить' }).click();
    await page.waitForTimeout(500); // дать время BracketResponse прийти
  }

  await page.getByRole('button', { name: 'Результаты' }).click();
  await expect(page.getByText('ЗАВЕРШЕНА')).toBeVisible();
});

test('публичная страница турнира показывает сетку и результаты', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');
  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [60],
  });

  const b1 = await createBoxerViaApi(request, trainer, { fullName: 'P1', weight: 60 });
  const b2 = await createBoxerViaApi(request, trainer, { fullName: 'P2', weight: 60 });
  for (const b of [b1, b2]) {
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 60);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  // Генерируем сетку через API — после этого статус турнира IN_PROGRESS
  const apiPort = process.env.E2E_API_PORT ?? 3000;
  const r = await request.post(
    `http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/bracket`,
    { headers: { Authorization: `Bearer ${organizer.accessToken}` } },
  );
  expect(r.ok()).toBeTruthy();

  // Без логина идём на публичную страницу — она должна показать сетку и результаты
  await page.goto(`/public/tournaments/${tournament.id}`);
  await expect(page.getByRole('heading', { name: tournament.name })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Сетка' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Результаты' })).toBeVisible();
  await expect(page.getByText('60 кг').first()).toBeVisible();
});
