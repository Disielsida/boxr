import { expect, test } from '@playwright/test';
import { clearTokens, createBoxerViaApi, loginViaApi } from './helpers';

test.describe('Boxers UI', () => {
  test('1. Тренер регистрирует боксёра', async ({ page, request }) => {
    await loginViaApi(page, request, 'TRAINER');
    await page.goto('/boxers/new');

    const name = `Иванов ${Date.now()}`;
    await page.locator('input').nth(0).fill(name);
    await page.locator('input[type="date"]').fill('2000-05-15');
    await page.locator('input[type="number"]').fill('71');

    await page.getByRole('button', { name: /^Создать$/ }).click();
    await page.waitForURL(/\/boxers\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('2. Тренер редактирует боксёра', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const created = await createBoxerViaApi(request, trainer, { fullName: `Старое ${Date.now()}` });

    await page.goto(`/boxers/${created.id}`);
    await page.getByRole('button', { name: /Редактировать/ }).click();
    const newName = `Новое ${Date.now()}`;
    await page.locator('input').nth(0).fill(newName);
    await page.getByRole('button', { name: /^Сохранить$/ }).click();
    await expect(page.getByRole('heading', { name: newName })).toBeVisible();
  });

  test('3. Тренер удаляет боксёра без заявок', async ({ page, request }) => {
    const trainer = await loginViaApi(page, request, 'TRAINER');
    const created = await createBoxerViaApi(request, trainer, { fullName: `Удалить ${Date.now()}` });

    page.on('dialog', (d) => d.accept());
    await page.goto(`/boxers/${created.id}`);
    await page.getByRole('button', { name: /Удалить/ }).click();
    await page.waitForURL('**/trainer');
    await expect(page).toHaveURL(/\/trainer$/);
  });

  test.afterEach(async ({ page }) => {
    await clearTokens(page);
  });
});
