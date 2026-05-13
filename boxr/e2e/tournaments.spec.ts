import { expect, test } from '@playwright/test';
import {
  clearTokens,
  createTournamentViaApi,
  loginViaApi,
  registerUser,
  seedTokens,
} from './helpers';

test.describe('Tournaments UI (8 сценариев из спеки)', () => {
  test('1. Логин organizer → дашборд → секция «Мои турниры»', async ({ page, request }) => {
    await loginViaApi(page, request, 'ORGANIZER');
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /Мои турниры/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Создать турнир/ })).toBeVisible();
    await expect(page.getByText('У вас пока нет турниров', { exact: false })).toBeVisible();
  });

  test('2. Мастер 5 шагов → создание → редирект на детали', async ({ page, request }) => {
    await loginViaApi(page, request, 'ORGANIZER');
    await page.goto('/tournaments/new');

    // Шаг 1
    await expect(page.getByText('01 / ОСНОВНОЕ')).toBeVisible();
    const uniqueName = `E2E Турнир ${Date.now()}`;
    await page.getByPlaceholder('Кубок города Москвы — 2024').fill(uniqueName);
    await page.getByRole('button', { name: 'Далее →' }).click();

    // Шаг 2
    await expect(page.getByText('02 / ДАТЫ И МЕСТО')).toBeVisible();
    await page.locator('input[type="date"]').first().fill('2099-06-14');
    await page.locator('input[type="date"]').nth(1).fill('2099-06-16');
    await page.getByPlaceholder('Москва').fill('E2E-Город');
    await page.getByRole('button', { name: 'Далее →' }).click();

    // Шаг 3
    await expect(page.getByText('03 / КАТЕГОРИИ')).toBeVisible();
    await page.getByRole('button', { name: 'Далее →' }).click();

    // Шаг 4
    await expect(page.getByText('04 / РЕГЛАМЕНТ')).toBeVisible();
    await page.getByRole('button', { name: 'Далее →' }).click();

    // Шаг 5
    await expect(page.getByText('05 / ПОДТВЕРЖДЕНИЕ')).toBeVisible();
    await page.getByRole('button', { name: /Создать турнир/ }).click();

    await page.waitForURL(/\/tournaments\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible();
    await expect(page.getByText('Черновик', { exact: true })).toBeVisible();
  });

  test('3. «Опубликовать» → бейдж phase=Регистрация (старт в 2099)', async ({ page, request }) => {
    const user = await loginViaApi(page, request, 'ORGANIZER');
    const t = await createTournamentViaApi(request, user);

    await page.goto(`/tournaments/${t.id}`);
    await expect(page.getByRole('heading', { name: t.name })).toBeVisible();
    await expect(page.getByText('Черновик', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^Опубликовать$/ }).click();

    // Опубликован — phase OPEN → бейдж «Регистрация»
    await expect(page.getByText('Регистрация')).toBeVisible();
    await expect(page.getByRole('button', { name: /Отменить турнир/ })).toBeVisible();
  });

  test('4. «Редактировать» → форма, изменения сохраняются', async ({ page, request }) => {
    const user = await loginViaApi(page, request, 'ORGANIZER');
    const t = await createTournamentViaApi(request, user, { name: `Старое имя ${Date.now()}` });

    await page.goto(`/tournaments/${t.id}`);
    await page.getByRole('button', { name: /Редактировать/ }).click();

    // В мастере сразу шаг 1 с предзаполненным именем
    await expect(page.getByText('01 / ОСНОВНОЕ')).toBeVisible();
    const newName = `Новое имя ${Date.now()}`;
    await page.getByPlaceholder('Кубок города Москвы — 2024').fill(newName);

    // Просто прокликаем «Далее» до шага 5
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'Далее →' }).click();
    }
    await page.getByRole('button', { name: /Сохранить/ }).click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible();
  });

  test('5. Логаут → /tournaments — опубликованный турнир в списке', async ({ page, request }) => {
    const user = await loginViaApi(page, request, 'ORGANIZER');
    const uniqueCity = `E2E-City-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const t = await createTournamentViaApi(request, user, {
      city: uniqueCity,
      status: 'PUBLISHED',
      name: `Pub ${Date.now()}`,
    });

    // выходим: чистим токены
    await clearTokens(page);

    await page.goto('/tournaments');
    await expect(page.getByRole('heading', { name: 'Открытые турниры' })).toBeVisible();
    // фильтрация по уникальному городу
    await page.getByPlaceholder('Москва').fill(uniqueCity);
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByRole('heading', { name: t.name, level: 3 })).toBeVisible();
  });

  test('6. Trainer на /tournaments/new → редирект на /', async ({ page, request }) => {
    await loginViaApi(page, request, 'TRAINER');
    await page.goto('/tournaments/new');

    // RequireRole organizer редиректит на /
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page).toHaveURL(/\/$/);
  });

  test('7. Чужой organizer на /tournaments/<чужой> → ошибка/404', async ({ page, request }) => {
    const owner = await registerUser(request, 'ORGANIZER', 'Owner');
    const t = await createTournamentViaApi(request, owner);

    // логинимся под другим organizer
    await loginViaApi(page, request, 'ORGANIZER');
    await page.goto(`/tournaments/${t.id}`);

    await expect(page.getByText(/Турнир не найден|нет доступа/)).toBeVisible();
  });

  test('8. «Отменить» → пропадает из публичного списка', async ({ page, request }) => {
    const user = await loginViaApi(page, request, 'ORGANIZER');
    const uniqueCity = `Cancel-City-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const t = await createTournamentViaApi(request, user, {
      city: uniqueCity,
      status: 'PUBLISHED',
      name: `Cancel ${Date.now()}`,
    });

    // anonymously видим турнир
    await clearTokens(page);
    await page.goto('/tournaments');
    await page.getByPlaceholder('Москва').fill(uniqueCity);
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByRole('heading', { name: t.name, level: 3 })).toBeVisible();

    // Отменяем через UI: возвращаем токены и идём на детали
    await seedTokens(page, user);
    await page.goto(`/tournaments/${t.id}`);
    await page.getByRole('button', { name: /Отменить турнир/ }).click();
    await expect(page.getByText('Отменён')).toBeVisible();

    // Возвращаемся на публичный список без токенов — турнира нет
    await clearTokens(page);
    await page.goto('/tournaments');
    await page.getByPlaceholder('Москва').fill(uniqueCity);
    await page.getByRole('button', { name: 'Найти' }).click();
    await expect(page.getByText(/Пока нет опубликованных турниров/)).toBeVisible();
  });
});
