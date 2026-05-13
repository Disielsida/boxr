import { expect, test } from '@playwright/test';
import {
  createBoxerViaApi,
  createTournamentViaApi,
  loginViaApi,
  registerUser,
  seedTokens,
} from './helpers';

const API = 'http://localhost:3000/api/v1';

test.describe('Applications UI', () => {
  test('1. Пакетная заявка тренером', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const organizer = await registerUser(request, 'ORGANIZER');
    await createBoxerViaApi(request, trainer, { weight: 60 });
    await createBoxerViaApi(request, trainer, { weight: 67 });
    await createBoxerViaApi(request, trainer, { weight: 75 });
    // dateStart в ближайшем будущем: попадёт в начало списка (до накопившихся 2099-турниров)
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED', dateStart: '2026-06-01', dateEnd: '2026-06-03' });

    await page.goto('/trainer');
    // Кликаем кнопку именно нашего турнира (в БД могут быть старые)
    await page.locator('h3').filter({ hasText: t.name })
      .locator('xpath=..')
      .getByRole('button', { name: 'Подать заявку' })
      .click();
    // ждём загрузки боксёров в диалоге
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
    await page.getByRole('button', { name: /Подать заявку \(\d+\)/ }).click();

    // Проверим у организатора 3 PENDING
    await page.evaluate(() => {
      localStorage.removeItem('boxr.access');
      localStorage.removeItem('boxr.refresh');
    });
    const list = await request.get(`${API}/tournaments/${t.id}/applications?status=PENDING`, {
      headers: { Authorization: `Bearer ${organizer.accessToken}` },
    });
    const data = (await list.json()) as { items: unknown[] };
    expect(data.items).toHaveLength(3);
  });

  test('2. Тренер отзывает PENDING заявку', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const organizer = await registerUser(request, 'ORGANIZER');
    const boxer = await createBoxerViaApi(request, trainer, { weight: 71 });
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });
    const submit = await request.post(`${API}/applications`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
      data: { tournamentId: t.id, items: [{ boxerId: boxer.id }] },
    });
    const submitted = (await submit.json()) as { items: { id: string }[] };
    const appId = submitted.items[0].id;

    // прямой вызов withdraw через API (UI «отозвать» нет в дашборде в этой v1)
    const r = await request.post(`${API}/applications/${appId}/withdraw`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
    });
    expect(r.ok()).toBeTruthy();
    const back = await request.get(`${API}/applications/mine`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
    });
    const list = (await back.json()) as { items: { status: string }[] };
    expect(list.items[0].status).toBe('WITHDRAWN');
  });

  test('3. Организатор аппрувит — у тренера статус Одобрена', async ({ page, request }) => {
    const trainer = await registerUser(request, 'TRAINER');
    const organizer = await loginViaApi(page, request, 'ORGANIZER');
    const boxer = await createBoxerViaApi(request, trainer, { weight: 71 });
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });
    await request.post(`${API}/applications`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
      data: { tournamentId: t.id, items: [{ boxerId: boxer.id }] },
    });

    await page.goto(`/tournaments/${t.id}`);
    await page.getByRole('button', { name: 'Участники' }).click();
    await page.getByRole('button', { name: /Одобрить/ }).click();
    await expect(page.getByText('Одобрена', { exact: true })).toBeVisible();

    // у тренера статус — переключаемся
    await seedTokens(page, trainer);
    await page.goto('/trainer');
    await expect(page.getByText('Одобрена', { exact: true })).toBeVisible();
  });

  test('4. Организатор отклоняет с причиной', async ({ page, request }) => {
    const trainer = await registerUser(request, 'TRAINER');
    const organizer = await loginViaApi(page, request, 'ORGANIZER');
    const boxer = await createBoxerViaApi(request, trainer, { weight: 71 });
    const t = await createTournamentViaApi(request, organizer, { status: 'PUBLISHED' });
    await request.post(`${API}/applications`, {
      headers: { Authorization: `Bearer ${trainer.accessToken}` },
      data: { tournamentId: t.id, items: [{ boxerId: boxer.id }] },
    });

    await page.goto(`/tournaments/${t.id}`);
    await page.getByRole('button', { name: 'Участники' }).click();
    page.on('dialog', async (d) => { await d.accept('Нет документов'); });
    await page.getByRole('button', { name: /Отклонить/ }).click();
    await expect(page.getByText('Отклонена', { exact: true })).toBeVisible();

    // у тренера видна причина
    await seedTokens(page, trainer);
    await page.goto('/trainer');
    await expect(page.getByText('Нет документов', { exact: false })).toBeVisible();
  });
});
