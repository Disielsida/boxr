# Responsive UI Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Сделать весь UI BOXR адаптивным для телефонов и планшетов без потери визуальных качеств десктопной версии.

---

## Брейкпоинты

| Имя | Диапазон | CSS |
|---|---|---|
| desktop | > 1024px | (базовые стили, без медиазапросов) |
| tablet | 769px – 1024px | `@media (max-width: 1024px)` |
| phone | ≤ 768px | `@media (max-width: 768px)` |

---

## Архитектура

### CSS Modules

Каждый компонент с адаптивным layout получает файл `.module.css` рядом с `.tsx`. Inline-стили остаются только для динамических значений (цвет из CSS-переменных, вычисляемые размеры). Layout (padding, flex-direction, grid-template-columns, width, display) — в CSS Modules.

CSS-переменные из `tokens.css` (`var(--space-8)`, `var(--ring-600)` и т.д.) доступны во всех `.module.css` без импорта.

### Тестирование CSS Modules в Vitest

Для корректной работы `import s from './X.module.css'` в тестах добавить в `vite.config.ts`:

```ts
test: {
  css: true,          // обрабатывает CSS Modules в тестах
}
```

---

## Компонент AppShell

**Файлы:**
- `src/widgets/app-shell/ui/AppShell.tsx`
- `src/widgets/app-shell/ui/AppShell.module.css`
- `src/widgets/app-shell/ui/AppShell.test.tsx`
- `src/widgets/app-shell/index.ts`

**Определение мобильного режима:**

AppShell использует `window.matchMedia('(max-width: 1024px)')` для условного рендера хедера в JSX — не просто CSS. Это делает поведение тестируемым:

```ts
const [isMobile, setIsMobile] = useState(() =>
  window.matchMedia('(max-width: 1024px)').matches
);

useEffect(() => {
  const mq = window.matchMedia('(max-width: 1024px)');
  const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}, []);
```

**Поведение:**
- `isMobile === false` (> 1024px): рендерит только `children`, хедер отсутствует в DOM
- `isMobile === true` (≤ 1024px): рендерит хедер 48px + `<div className={s.content}>children</div>` с `padding-top: 48px`

**Мобильный хедер:**
- Слева: кнопка `←` (видна только если текущий роут не корневой для данной роли) + логотип BOXR
- Справа: бейдж роли + кнопка гамбургер `☰`
- Фон: `var(--ink-900)` (`#1a143d`)

**Drawer:**
- Выезжает справа, ширина 70% экрана
- Backdrop (`rgba(13,12,29,0.6)`) закрывает контент; тап по backdrop закрывает drawer
- Анимация: `transform: translateX(100%)` → `translateX(0)` за 300ms
- Содержимое: имя пользователя + бейдж роли, список nav-ссылок, кнопка «Выйти» внизу
- Активный роут подсвечивается фоном `var(--paper-200)`

**Nav-ссылки по ролям:**

| Роль | Ссылки |
|---|---|
| ORGANIZER | Мои турниры (`/dashboard`), Создать турнир (`/tournaments/create`) |
| TRAINER | Мои боксёры (`/trainer`), Добавить боксёра (`/boxers/register`) |
| JUDGE | — (судья попадает напрямую на LiveScoringPage) |

**AppRouter.tsx:** все защищённые роуты оборачиваются в `<AppShell>`.

**Корневые роуты по ролям** (кнопка `←` скрыта на этих страницах):
- ORGANIZER: `/dashboard`
- TRAINER: `/trainer`
- JUDGE: `/tournaments/:id/live`

**Тесты (`AppShell.test.tsx`):**

В тестах мокаем `window.matchMedia`:
```ts
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}
```

Тест-кейсы:
- хедер (`data-testid="mobile-header"`) отсутствует в DOM при `matchMedia → matches: false`
- хедер присутствует в DOM при `matchMedia → matches: true`
- drawer открывается по клику на `☰` (появляется `data-testid="drawer"`)
- drawer закрывается по клику на backdrop
- nav-ссылки соответствуют роли ORGANIZER (есть `/dashboard` и `/tournaments/create`)
- nav-ссылки соответствуют роли TRAINER (есть `/trainer` и `/boxers/register`)

---

## Страницы

### LandingPage

**Файл:** `src/pages/landing/ui/LandingPage.module.css`

- `.container`: `padding: 0` (паддинги внутри секций)
- `.hero`: `display: flex; flex-direction: row` → tablet: `flex-direction: column; text-align: center` → phone: то же
- `.heroContent`: `flex: 0 0 58%` → tablet/phone: `flex: none; width: 100%`
- `.heroIllustration`: `flex: 0 0 42%` → tablet: `width: 100%; height: 200px` → phone: скрывается (`display: none`)
- `.section`: `padding: 64px 48px` → tablet: `40px 32px` → phone: `24px 16px`
- `.featureGrid`: `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` → phone: `1fr`

### LoginPage

**Файл:** `src/pages/login/ui/LoginPage.module.css`

- `.root`: `display: flex; flex-direction: row; height: 100vh`
- `.left` (иллюстрация): `flex: 0 0 50%` → tablet: `flex: 0 0 40%` → phone: `display: none`
- `.right` (форма): `flex: 0 0 50%; padding: 48px` → tablet: `flex: 1; padding: 40px 32px` → phone: `flex: 1; padding: 32px 16px`
- На phone в `.right` добавляется логотип BOXR сверху формы (`display: block` для `.mobileLogo`)

### DashboardPage

**Файл:** `src/pages/dashboard/ui/DashboardPage.module.css`

- `.container`: `padding: 64px 48px; max-width: 1200px` → tablet: `padding: 40px 32px` → phone: `padding: 24px 16px`
- `.header`: `display: flex; flex-direction: row; justify-content: space-between; align-items: center` → phone: `flex-direction: column; align-items: flex-start; gap: 16px`
- `.grid`: `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` → phone: `grid-template-columns: 1fr`

### TrainerDashboardPage

**Файл:** `src/pages/trainer-dashboard/ui/TrainerDashboardPage.module.css`

Те же паттерны что у DashboardPage: container padding, header flex, grid columns.

### TournamentManagePage

**Файл:** `src/pages/tournament-manage/ui/TournamentManagePage.module.css`

- `.container`: `padding: 32px 40px` → tablet: `24px 24px` → phone: `16px 12px`
- `.tabs`: `display: flex; flex-direction: row; gap: 8px` → phone: `overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; scrollbar-width: none`
- `.tab` → phone: `flex-shrink: 0` (запрет переноса)
- `.tableWrapper`: phone: `overflow-x: auto; -webkit-overflow-scrolling: touch`

### PublicTournamentsPage

**Файл:** `src/pages/public-tournaments/ui/PublicTournamentsPage.module.css`

- `.container` padding: аналогично DashboardPage
- `.filters`: `display: flex; flex-direction: row; gap: 16px` → phone: `flex-direction: column`
- `.grid`: аналогично DashboardPage

### PublicTournamentPage

**Файл:** `src/pages/public-tournament/ui/PublicTournamentPage.module.css`

- `.container` padding: аналогично
- `.tabs` и `.tableWrapper`: аналогично TournamentManagePage

### CreateTournamentPage / CreateTournamentWizard

**Файл:** `src/features/tournament-create/ui/CreateTournamentWizard.module.css`

- `.root`: `max-width: 720px; padding: 40px` → tablet: `padding: 32px 24px` → phone: `padding: 20px 16px`
- `.stepRow` (горизонтальные шаги): phone: `flex-direction: column; gap: 8px`

### RegisterBoxerPage / BoxerForm

**Файл:** `src/features/boxer-form/ui/BoxerForm.module.css`

- `.root`: `max-width: 540px; padding: 40px` → phone: `padding: 20px 16px`
- `.row` (два поля в ряд): phone: `flex-direction: column`

### BoxerProfilePage

**Файл:** `src/pages/boxer-profile/ui/BoxerProfilePage.module.css`

- `.container` padding: аналогично DashboardPage
- `.profile`: `display: flex; flex-direction: row; gap: 32px` → phone: `flex-direction: column`

---

## AI-ассистент — AiAssistantPanel

**Файл:** `src/widgets/ai-assistant/ui/AiAssistantPanel.module.css`

**Десктоп (> 768px):**
```css
.panel {
  position: fixed;
  right: 0; top: 0; bottom: 0;
  width: 480px;
  /* текущий вид */
}
```

**Мобильный (≤ 768px) — bottom sheet:**
```css
@media (max-width: 768px) {
  .panel {
    top: auto;
    left: 0; right: 0; bottom: 0;
    width: 100%;
    height: 85vh;
    border-radius: 12px 12px 0 0;
    animation: slideUp 300ms var(--ease-out-quart);
  }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

Drag handle (32px × 3px, цвет `var(--paper-300)`) рендерится в JSX условно — только когда `window.matchMedia('(max-width: 768px)').matches === true`. Использует тот же паттерн с `useState` + `useEffect` что и AppShell, но с брейкпоинтом 768px.

---

## LiveScoringPage

**Файл:** `src/pages/live-scoring/ui/LiveScoringPage.module.css`

На планшете (≥ 768px): горизонтальная раскладка сохраняется без изменений.

На телефоне в portrait (`≤ 768px` + `orientation: portrait`): поверх страницы рендерится overlay с подсказкой:

```css
.landscapeHint {
  display: none;
}

@media (max-width: 768px) and (orientation: portrait) {
  .landscapeHint {
    display: flex;
    position: fixed;
    inset: 0;
    background: #0d0c1d;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 9999;
  }
}
```

JSX добавляет `<div className={s.landscapeHint}>` с иконкой 📱 и текстом «Поверни устройство для удобного судейства».

---

## Тесты

**AppShell.test.tsx** — 6 тестов (описаны выше в секции AppShell).

**AiAssistantPanel.test.tsx** — 2 теста (используют тот же мок `window.matchMedia` что и AppShell тесты):
- при `matchMedia('(max-width: 768px)') → matches: true` — в DOM присутствует `data-testid="drag-handle"`
- при `matchMedia('(max-width: 768px)') → matches: false` — `data-testid="drag-handle"` отсутствует в DOM

Все тесты используют Vitest + `@testing-library/react` + `jsdom`.
