import { expect, test } from '@playwright/test';
import {
  approveApplicationViaApi,
  createBoxerViaApi,
  createTournamentViaApi,
  registerUser,
  seedTokens,
  submitApplicationViaApi,
} from './helpers';

test('организатор проводит бой через Live Scoring и фиксирует WP', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');

  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [60],
  });

  // 2 боксёра в категории 60 → 1 матч (финал)
  for (let i = 0; i < 2; i++) {
    const b = await createBoxerViaApi(request, trainer, { fullName: `LS ${i + 1}`, weight: 60 });
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 60);
    await approveApplicationViaApi(request, organizer, app.id);
  }

  const apiPort = process.env.E2E_API_PORT ?? 3000;
  const headers = { Authorization: `Bearer ${organizer.accessToken}` };
  const r = await request.post(
    `http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/bracket`,
    { headers },
  );
  expect(r.ok()).toBeTruthy();
  const bracket = (await r.json()) as {
    categories: Array<{ matches: Array<{ id: string; status: string }> }>;
  };
  const readyMatch = bracket.categories[0].matches.find((m) => m.status === 'READY')!;

  await seedTokens(page, organizer);
  await page.goto(`/scoring/${readyMatch.id}`);

  // Проверяем prefight UI
  await expect(page.getByText('LS 1')).toBeVisible();
  await expect(page.getByText('LS 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'СТАРТ' })).toBeVisible();

  // Запускаем бой
  await page.getByRole('button', { name: 'СТАРТ' }).click();

  // Останавливаем бой через RSC (красный угол) — немедленно переводит в ended
  const stopBtn = page.getByRole('button', { name: /Стоп бой/ }).filter({ hasText: 'КР' });
  await expect(stopBtn).toBeVisible();
  await stopBtn.click();

  // Должен показаться EndFightPanel (outcome по умолчанию RSC, winner = красный)
  await expect(page.getByRole('button', { name: 'УТВЕРДИТЬ РЕЗУЛЬТАТ' })).toBeVisible({ timeout: 5000 });

  // Утверждаем
  await page.getByRole('button', { name: 'УТВЕРДИТЬ РЕЗУЛЬТАТ' }).click();

  // Редирект на страницу турнира
  await expect(page).toHaveURL(new RegExp(`/tournaments/${tournament.id}$`));
});

test('Live Scoring: state восстанавливается из localStorage после reload', async ({ page, request }) => {
  const organizer = await registerUser(request, 'ORGANIZER');
  const trainer = await registerUser(request, 'TRAINER');

  const tournament = await createTournamentViaApi(request, organizer, {
    status: 'PUBLISHED',
    categories: [60],
  });
  for (let i = 0; i < 2; i++) {
    const b = await createBoxerViaApi(request, trainer, { fullName: `LS-R ${i + 1}`, weight: 60 });
    const app = await submitApplicationViaApi(request, trainer, tournament.id, b.id, 60);
    await approveApplicationViaApi(request, organizer, app.id);
  }
  const apiPort = process.env.E2E_API_PORT ?? 3000;
  const headers = { Authorization: `Bearer ${organizer.accessToken}` };
  const r = await request.post(
    `http://localhost:${apiPort}/api/v1/tournaments/${tournament.id}/bracket`,
    { headers },
  );
  const bracket = (await r.json()) as {
    categories: Array<{ matches: Array<{ id: string; status: string }> }>;
  };
  const readyMatch = bracket.categories[0].matches.find((m) => m.status === 'READY')!;

  await seedTokens(page, organizer);
  await page.goto(`/scoring/${readyMatch.id}`);
  await page.getByRole('button', { name: 'СТАРТ' }).click();

  // Дать 2 предупреждения красному → счёт 8-10
  // Кнопки имеют текст «Предупреждение» с подписью «🔴 КР» или «🔵 СИ»
  const redWarning = page.getByRole('button', { name: /Предупреждение/ }).filter({ hasText: 'КР' });
  await redWarning.click();
  await redWarning.click();

  await expect(page.getByText('8', { exact: true })).toBeVisible();

  // Перезагрузка страницы
  await page.reload();

  // После перезагрузки 8 должно остаться (восстановление из localStorage)
  await expect(page.getByText('8', { exact: true })).toBeVisible();
});
