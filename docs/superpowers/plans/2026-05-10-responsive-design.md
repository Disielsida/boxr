# Responsive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать весь UI BOXR адаптивным для телефонов (≤768px) и планшетов (769–1024px) через CSS Modules + условный рендер через matchMedia.

**Architecture:** Создаём `useMediaQuery` хук для условного рендера в JSX. Добавляем `AppShell` виджет с мобильным хедером и drawer-меню. Каждая страница получает `.module.css` файл рядом с `.tsx`, все layout-стили (padding, flex-direction, grid-columns) переносятся в него. Inline-стили остаются только для динамических значений (цвет из переменных).

**Tech Stack:** React 19, CSS Modules (встроены в Vite), Vitest + @testing-library/react, React Router DOM, TypeScript.

---

## Структура файлов

**Создать:**
- `src/shared/lib/useMediaQuery.ts`
- `src/shared/lib/useMediaQuery.test.ts`
- `src/widgets/app-shell/ui/AppShell.tsx`
- `src/widgets/app-shell/ui/AppShell.module.css`
- `src/widgets/app-shell/ui/AppShell.test.tsx`
- `src/widgets/app-shell/index.ts`
- `src/pages/landing/ui/LandingPage.module.css`
- `src/pages/login/ui/LoginPage.module.css`
- `src/pages/dashboard/ui/DashboardPage.module.css`
- `src/pages/trainer-dashboard/ui/TrainerDashboardPage.module.css`
- `src/pages/tournament-manage/ui/TournamentManagePage.module.css`
- `src/pages/public-tournaments/ui/PublicTournamentsPage.module.css`
- `src/pages/public-tournament/ui/PublicTournamentPage.module.css`
- `src/pages/register-boxer/ui/RegisterBoxerPage.module.css`
- `src/pages/boxer-profile/ui/BoxerProfilePage.module.css`
- `src/features/tournament-create/ui/CreateTournamentWizard.module.css`
- `src/features/boxer-form/ui/BoxerForm.module.css`
- `src/widgets/ai-assistant/ui/AiAssistantPanel.module.css`
- `src/pages/live-scoring/ui/LiveScoringPage.module.css`

**Изменить:**
- `vite.config.ts` — добавить `css: true` в test
- `src/app/router/AppRouter.tsx` — обернуть protected routes в `<AppShell>`
- `src/pages/landing/ui/LandingPage.tsx`
- `src/pages/login/ui/LoginPage.tsx`
- `src/pages/dashboard/ui/DashboardPage.tsx`
- `src/pages/trainer-dashboard/ui/TrainerDashboardPage.tsx`
- `src/pages/tournament-manage/ui/TournamentManagePage.tsx`
- `src/pages/public-tournaments/ui/PublicTournamentsPage.tsx`
- `src/pages/public-tournament/ui/PublicTournamentPage.tsx`
- `src/pages/register-boxer/ui/RegisterBoxerPage.tsx`
- `src/pages/boxer-profile/ui/BoxerProfilePage.tsx`
- `src/features/tournament-create/ui/CreateTournamentWizard.tsx`
- `src/features/boxer-form/ui/BoxerForm.tsx`
- `src/widgets/ai-assistant/ui/AiAssistantPanel.tsx`
- `src/pages/live-scoring/ui/LiveScoringPage.tsx`

---

## Task 1: useMediaQuery хук + vite.config.ts

**Files:**
- Create: `src/shared/lib/useMediaQuery.ts`
- Create: `src/shared/lib/useMediaQuery.test.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Обновить vite.config.ts**

```ts
// vite.config.ts — полный файл
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    exclude: ['node_modules', 'dist', 'e2e'],
    css: true,
  },
});
```

- [ ] **Step 2: Написать failing тест**

```ts
// src/shared/lib/useMediaQuery.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

function mockMQ(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mq = {
    matches,
    addEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn)),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: vi.fn(() => mq),
  });
  return listeners;
}

describe('useMediaQuery', () => {
  it('возвращает true когда запрос совпадает', () => {
    mockMQ(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('возвращает false когда запрос не совпадает', () => {
    mockMQ(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('обновляет значение при изменении медиа-запроса', () => {
    const listeners = mockMQ(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 1024px)'));
    expect(result.current).toBe(false);
    act(() => {
      listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent));
    });
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться что FAIL**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npx vitest run src/shared/lib/useMediaQuery.test.ts`
Expected: FAIL — "Cannot find module './useMediaQuery'"

- [ ] **Step 4: Реализовать хук**

```ts
// src/shared/lib/useMediaQuery.ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

- [ ] **Step 5: Запустить тест — убедиться что PASS**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npx vitest run src/shared/lib/useMediaQuery.test.ts`
Expected: 3 passed

- [ ] **Step 6: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add vite.config.ts src/shared/lib/useMediaQuery.ts src/shared/lib/useMediaQuery.test.ts
git commit -m "feat: add useMediaQuery hook and enable css:true in vitest"
```

---

## Task 2: AppShell виджет (TDD)

**Files:**
- Create: `src/widgets/app-shell/ui/AppShell.tsx`
- Create: `src/widgets/app-shell/ui/AppShell.module.css`
- Create: `src/widgets/app-shell/ui/AppShell.test.tsx`
- Create: `src/widgets/app-shell/index.ts`

- [ ] **Step 1: Написать failing тесты**

```tsx
// src/widgets/app-shell/ui/AppShell.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

vi.mock('@/app/providers', () => ({
  useAuthContext: vi.fn(() => ({
    user: { fullName: 'Иван Петров', role: 'organizer', email: 'ivan@test.com' },
    logout: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    register: vi.fn(),
    initializing: false,
  })),
}));

function mockMQ(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: vi.fn((q: string) => ({
      matches,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

const renderShell = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell><div>контент</div></AppShell>
    </MemoryRouter>,
  );

describe('AppShell', () => {
  it('хедер отсутствует в DOM на десктопе (matchMedia → false)', () => {
    mockMQ(false);
    renderShell();
    expect(screen.queryByTestId('mobile-header')).not.toBeInTheDocument();
  });

  it('хедер присутствует в DOM на мобильном (matchMedia → true)', () => {
    mockMQ(true);
    renderShell();
    expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
  });

  it('drawer открывается по клику на кнопку меню', () => {
    mockMQ(true);
    renderShell();
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('drawer закрывается по клику на backdrop', () => {
    mockMQ(true);
    renderShell();
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    fireEvent.click(screen.getByTestId('backdrop'));
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
  });

  it('nav-ссылки для ORGANIZER: Мои турниры и Создать турнир', () => {
    mockMQ(true);
    renderShell();
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(screen.getByText('Мои турниры')).toBeInTheDocument();
    expect(screen.getByText('Создать турнир')).toBeInTheDocument();
  });

  it('nav-ссылки для TRAINER: Мои боксёры и Добавить боксёра', async () => {
    const { useAuthContext } = await import('@/app/providers');
    vi.mocked(useAuthContext).mockReturnValueOnce({
      user: { fullName: 'Тренер', role: 'trainer', email: 't@test.com' },
      logout: vi.fn().mockResolvedValue(undefined),
      login: vi.fn(),
      register: vi.fn(),
      initializing: false,
    });
    mockMQ(true);
    renderShell('/trainer');
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(screen.getByText('Мои боксёры')).toBeInTheDocument();
    expect(screen.getByText('Добавить боксёра')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться что FAIL**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npx vitest run src/widgets/app-shell/ui/AppShell.test.tsx`
Expected: FAIL — "Cannot find module './AppShell'"

- [ ] **Step 3: Создать AppShell.module.css**

```css
/* src/widgets/app-shell/ui/AppShell.module.css */
.root {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: var(--ink-900);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 400;
  flex-shrink: 0;
}

.headerLeft {
  display: flex;
  align-items: center;
  gap: 10px;
}

.headerRight {
  display: flex;
  align-items: center;
  gap: 12px;
}

.backBtn {
  background: none;
  border: none;
  color: var(--ink-300);
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  line-height: 1;
}

.logo {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--paper-100);
  letter-spacing: -0.01em;
}

.roleBadge {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--ink-300);
  background: var(--ink-700);
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.06em;
}

.hamburger {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hamburger span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--paper-100);
  border-radius: 1px;
}

.content {
  padding-top: 48px;
  flex: 1;
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(13, 12, 29, 0.6);
  z-index: 450;
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 70%;
  max-width: 280px;
  background: var(--ink-900);
  z-index: 460;
  display: flex;
  flex-direction: column;
  padding: 20px 16px;
  animation: drawerIn 0.3s var(--ease-out-quart);
}

@keyframes drawerIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawerUser {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--ink-700);
}

.drawerUserName {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--paper-100);
}

.navLink {
  display: block;
  padding: 10px 8px;
  color: var(--ink-300);
  text-decoration: none;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
  margin-bottom: 2px;
  transition: background 0.15s, color 0.15s;
}

.navLink:hover {
  background: var(--ink-700);
  color: var(--paper-100);
}

.navLinkActive {
  background: var(--ink-700);
  color: var(--paper-100);
}

.drawerSpacer {
  flex: 1;
}

.logoutBtn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 8px;
  color: var(--ink-500);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  text-align: left;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}

.logoutBtn:hover {
  color: var(--danger);
}
```

- [ ] **Step 4: Создать AppShell.tsx**

```tsx
// src/widgets/app-shell/ui/AppShell.tsx
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/app/providers';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import s from './AppShell.module.css';

const ROOT_ROUTES: Record<string, string> = {
  organizer: '/dashboard',
  trainer: '/trainer',
  judge: '/scoring',
};

const NAV_LINKS: Record<string, Array<{ label: string; to: string }>> = {
  organizer: [
    { label: 'Мои турниры', to: '/dashboard' },
    { label: 'Создать турнир', to: '/tournaments/new' },
  ],
  trainer: [
    { label: 'Мои боксёры', to: '/trainer' },
    { label: 'Добавить боксёра', to: '/boxers/new' },
  ],
  judge: [],
};

interface Props {
  children: ReactNode;
}

export const AppShell = ({ children }: Props) => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isMobile) return <>{children}</>;

  const role = user?.role ?? 'organizer';
  const rootRoute = ROOT_ROUTES[role] ?? '/dashboard';
  const isRoot = location.pathname === rootRoute;
  const links = NAV_LINKS[role] ?? [];

  const handleLogout = async () => {
    setDrawerOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className={s.root}>
      <header className={s.header} data-testid="mobile-header">
        <div className={s.headerLeft}>
          {!isRoot && (
            <button className={s.backBtn} onClick={() => navigate(-1)}>←</button>
          )}
          <span className={s.logo}>BOXR</span>
        </div>
        <div className={s.headerRight}>
          <span className={s.roleBadge}>{role.toUpperCase()}</span>
          <button
            className={s.hamburger}
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть меню"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main className={s.content}>{children}</main>

      {drawerOpen && (
        <>
          <div
            className={s.backdrop}
            data-testid="backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <nav className={s.drawer} data-testid="drawer">
            <div className={s.drawerUser}>
              <div className={s.drawerUserName}>{user?.fullName}</div>
              <span className={s.roleBadge}>{role.toUpperCase()}</span>
            </div>
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`${s.navLink}${location.pathname === link.to ? ` ${s.navLinkActive}` : ''}`}
                onClick={() => setDrawerOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className={s.drawerSpacer} />
            <button className={s.logoutBtn} onClick={() => void handleLogout()}>
              Выйти
            </button>
          </nav>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Создать index.ts**

```ts
// src/widgets/app-shell/index.ts
export { AppShell } from './ui/AppShell';
```

- [ ] **Step 6: Запустить тесты — убедиться что PASS**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npx vitest run src/widgets/app-shell/ui/AppShell.test.tsx`
Expected: 6 passed

- [ ] **Step 7: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/widgets/app-shell/ src/shared/lib/
git commit -m "feat: add AppShell widget with mobile header and drawer"
```

---

## Task 3: Обернуть protected routes в AppShell

**Files:**
- Modify: `src/app/router/AppRouter.tsx`

- [ ] **Step 1: Обновить AppRouter.tsx**

Добавить импорт AppShell и обернуть им только protected routes (роуты с `RequireAuth` / `RequireRole`). Публичные страницы (LandingPage, LoginPage, PublicTournamentsPage, PublicTournamentPage) AppShell не нужен.

```tsx
// src/app/router/AppRouter.tsx
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuthContext } from '@/app/providers';
import { BoxerProfilePage } from '@/pages/boxer-profile';
import { CreateTournamentPage } from '@/pages/create-tournament';
import { DashboardPage } from '@/pages/dashboard';
import { LandingPage } from '@/pages/landing';
import { LiveScoringPage } from '@/pages/live-scoring';
import { LoginPage } from '@/pages/login';
import { PublicTournamentPage } from '@/pages/public-tournament';
import { PublicTournamentsPage } from '@/pages/public-tournaments';
import { RegisterBoxerPage } from '@/pages/register-boxer';
import { TournamentManagePage } from '@/pages/tournament-manage';
import { TrainerDashboardPage } from '@/pages/trainer-dashboard';
import { AiAssistantPanel, AiFloatingButton } from '@/widgets/ai-assistant';
import { AppShell } from '@/widgets/app-shell';
import { RequireAuth, RequireRole } from './guards';

export const AppRouter = () => {
  const { user } = useAuthContext();
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/tournaments" element={<PublicTournamentsPage />} />
        <Route path="/public/tournaments/:id" element={<PublicTournamentPage />} />

        <Route
          path="/tournaments/new"
          element={
            <RequireRole role="organizer">
              <AppShell><CreateTournamentPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            <RequireRole role="organizer">
              <AppShell><TournamentManagePage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireRole role={['organizer', 'judge']}>
              <AppShell><DashboardPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/trainer"
          element={
            <RequireRole role="trainer">
              <AppShell><TrainerDashboardPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/boxers/new"
          element={
            <RequireRole role="trainer">
              <AppShell><RegisterBoxerPage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/boxers/:id"
          element={
            <RequireRole role="trainer">
              <AppShell><BoxerProfilePage /></AppShell>
            </RequireRole>
          }
        />
        <Route
          path="/me"
          element={
            <RequireAuth>
              <AppShell><DashboardPage /></AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/scoring/:matchId"
          element={
            <RequireRole role="organizer">
              <AppShell><LiveScoringPage /></AppShell>
            </RequireRole>
          }
        />
        <Route path="*" element={<LandingPage />} />
      </Routes>

      {user && (
        <>
          {aiOpen && (
            <>
              <div
                onClick={() => setAiOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(26,20,61,0.35)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 490,
                }}
              />
              <AiAssistantPanel onClose={() => setAiOpen(false)} />
            </>
          )}
          {!aiOpen && <AiFloatingButton onClick={() => setAiOpen(true)} />}
        </>
      )}
    </BrowserRouter>
  );
};
```

- [ ] **Step 2: Запустить build для проверки типов**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 3: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/app/router/AppRouter.tsx
git commit -m "feat: wrap protected routes in AppShell"
```

---

## Task 4: LandingPage адаптивность

**Files:**
- Create: `src/pages/landing/ui/LandingPage.module.css`
- Modify: `src/pages/landing/ui/LandingPage.tsx`

- [ ] **Step 1: Создать LandingPage.module.css**

```css
/* src/pages/landing/ui/LandingPage.module.css */

/* Navbar */
.nav {
  padding: 0 48px;
}
.navLinks {
  display: flex;
  gap: 40px;
  align-items: center;
}

/* Hero section */
.heroSection {
  padding: 120px 48px 80px;
}
.heroInner {
  display: flex;
  gap: 64px;
  align-items: center;
  width: 100%;
  max-width: 1344px;
  margin: 0 auto;
}
.heroContent {
  flex: 0 0 58%;
}
.heroIllustration {
  flex: 0 0 38%;
}

/* Features strip */
.featuresStrip {
  display: flex;
  max-width: 1344px;
  margin: 0 auto;
  padding: 0 48px;
}
.featureItem {
  flex: 1;
  padding: 48px 40px 48px 0;
}
.featureItem:first-child {
  padding-left: 0;
}

/* How it works */
.howSection {
  padding: 120px 48px;
  max-width: 1344px;
  margin: 0 auto;
}
.step {
  display: flex;
  gap: 64px;
  align-items: flex-start;
}

/* Quote */
.quoteSection {
  padding: 100px 48px;
}

/* CTA */
.ctaSection {
  padding: 120px 48px;
}

/* Footer */
.footer {
  padding: 40px 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footerLinks {
  display: flex;
  gap: 24px;
}

/* Tablet (≤1024px) */
@media (max-width: 1024px) {
  .nav { padding: 0 32px; }
  .heroSection { padding: 100px 32px 60px; }
  .heroContent { flex: 0 0 55%; }
  .heroIllustration { flex: 0 0 42%; }
  .featuresStrip { padding: 0 32px; }
  .howSection { padding: 80px 32px; }
  .quoteSection { padding: 72px 32px; }
  .ctaSection { padding: 80px 32px; }
  .footer { padding: 32px; }
}

/* Phone (≤768px) */
@media (max-width: 768px) {
  .nav { padding: 0 16px; }
  .navLinks { display: none; }

  .heroSection { padding: 80px 16px 48px; }
  .heroInner {
    flex-direction: column;
    gap: 32px;
    text-align: center;
    align-items: center;
  }
  .heroContent { flex: none; width: 100%; }
  .heroIllustration { display: none; }

  .featuresStrip {
    flex-direction: column;
    padding: 0 16px;
  }
  .featureItem {
    padding: 32px 0;
    border-right: none !important;
    border-bottom: 1px solid var(--paper-300);
  }
  .featureItem:last-child { border-bottom: none; }

  .howSection { padding: 48px 16px; }
  .step { flex-direction: column; gap: 16px; }

  .quoteSection { padding: 48px 16px; }
  .ctaSection { padding: 64px 16px; }

  .footer {
    padding: 24px 16px;
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  .footerLinks { justify-content: center; }
}
```

- [ ] **Step 2: Обновить LandingPage.tsx — добавить import и className**

Добавить после существующих импортов:
```tsx
import s from './LandingPage.module.css';
```

Затем заменить ключевые layout-элементы:

Navbar (`<nav>`):
```tsx
<nav
  className={s.nav}
  style={{
    position: 'sticky',
    top: 0,
    zIndex: 200,
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: scrolled ? 'rgba(247,243,236,0.85)' : 'transparent',
    backdropFilter: scrolled ? 'blur(12px)' : 'none',
    borderBottom: `1px solid ${scrolled ? 'var(--paper-300)' : 'transparent'}`,
    transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
  }}
>
  {/* левая часть — без изменений */}
  <div className={s.navLinks}>
    {/* nav buttons — без изменений */}
  </div>
  {/* кнопка Войти — без изменений */}
</nav>
```

Hero section (`<section>`):
```tsx
<section
  className={s.heroSection}
  style={{
    minHeight: '100vh',
    marginTop: -72,
    background: 'var(--ink-900)',
    color: 'var(--paper-100)',
    position: 'relative',
    overflow: 'hidden',
  }}
>
  <div className={s.heroInner}>
    <div className={s.heroContent}>
      {/* содержимое без изменений */}
    </div>
    <div
      className={s.heroIllustration}
      style={{ ...animBase, transform: loaded ? 'rotate(-2deg)' : 'rotate(-6deg) translateY(20px)', position: 'relative', transitionDelay: '0.55s' }}
    >
      {/* карточка без изменений */}
    </div>
  </div>
</section>
```

Features strip:
```tsx
<div className={s.featuresStrip}>
  {FEATURES.map((f, i) => (
    <div
      key={i}
      className={s.featureItem}
      style={{
        borderRight: i < FEATURES.length - 1 ? '1px solid var(--paper-300)' : 'none',
        paddingLeft: i > 0 ? 40 : 0,
      }}
    >
```

How section:
```tsx
<section className={s.howSection}>
```

Каждый step:
```tsx
<div key={i} className={s.step} style={{ paddingBottom: 60, marginBottom: 60, borderBottom: ... }}>
```

Quote section:
```tsx
<section className={s.quoteSection} style={{ background: 'var(--paper-200)', borderTop: ..., borderBottom: ... }}>
```

CTA section:
```tsx
<section className={s.ctaSection} style={{ background: 'var(--ink-900)', color: 'var(--paper-100)', textAlign: 'center' }}>
```

Footer:
```tsx
<footer className={s.footer} style={{ background: 'var(--ink-900)', color: 'var(--paper-100)', borderTop: '1px solid rgba(242,238,229,0.1)' }}>
  {/* logo+name */}
  {/* copyright */}
  <div className={s.footerLinks}>
```

- [ ] **Step 3: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 4: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/landing/
git commit -m "feat: responsive LandingPage with CSS Modules"
```

---

## Task 5: LoginPage адаптивность

**Files:**
- Create: `src/pages/login/ui/LoginPage.module.css`
- Modify: `src/pages/login/ui/LoginPage.tsx`

- [ ] **Step 1: Создать LoginPage.module.css**

```css
/* src/pages/login/ui/LoginPage.module.css */
.root {
  display: flex;
  min-height: 100vh;
}

.left {
  flex: 0 0 50%;
  padding: 48px 64px;
  display: flex;
  flex-direction: column;
}

.right {
  flex: 0 0 50%;
  padding: 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.mobileLogo {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}

@media (max-width: 1024px) {
  .left { flex: 0 0 55%; padding: 40px 48px; }
  .right { flex: 0 0 45%; padding: 48px 40px; }
}

@media (max-width: 768px) {
  .right { display: none; }
  .left {
    flex: 1;
    padding: 32px 20px;
    align-items: stretch;
  }
  .mobileLogo { display: flex; }
}
```

- [ ] **Step 2: Обновить LoginPage.tsx**

Добавить: `import s from './LoginPage.module.css';`

Заменить корневой `<div>` и панели:
```tsx
return (
  <div className={s.root} style={{ background: 'var(--paper-100)' }}>
    {/* LEFT: Form */}
    <div className={s.left} style={{ ...anim(0.1) }}>
      {/* Существующая кнопка с лого — скрыть на мобильном через .mobileLogo */}
      <button
        onClick={() => navigate('/')}
        className={s.mobileLogo}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <FBRLogo size={32} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>
          BOXR
        </span>
      </button>
      {/* Существующая кнопка с лого (для десктопа, без класса) — оставить как есть */}
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64, padding: 0 }}
      >
        <FBRLogo size={32} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>BOXR</span>
      </button>
      {/* форма — без изменений */}
    </div>

    {/* RIGHT: Editorial */}
    <div className={s.right} style={{ background: 'var(--ink-900)', ...anim(0.2) }}>
      {/* содержимое без изменений */}
    </div>
  </div>
);
```

**Важно:** на мобильном лого показывается через `.mobileLogo` (display: flex через CSS), а существующая кнопка-лого (без класса) — скрывается через inline `display`. Чтобы не дублировать кнопку, упрости: удали дублирование, используй `.mobileLogo` с медиа-запросом, а для десктопа — обычный inline `display: flex`. Итоговый вариант:

```tsx
<button
  onClick={() => navigate('/')}
  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64, padding: 0 }}
>
  <FBRLogo size={32} />
  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>BOXR</span>
</button>
```

(Кнопка уже существует с `display: flex` inline — CSS Module `.right { display: none }` на мобильном скроет правую панель, а левая растянется на весь экран. Дополнительный мобильный лого не нужен.)

- [ ] **Step 3: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 4: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/login/
git commit -m "feat: responsive LoginPage — hide right panel on mobile"
```

---

## Task 6: DashboardPage + TrainerDashboardPage адаптивность

**Files:**
- Create: `src/pages/dashboard/ui/DashboardPage.module.css`
- Create: `src/pages/trainer-dashboard/ui/TrainerDashboardPage.module.css`
- Modify: `src/pages/dashboard/ui/DashboardPage.tsx`
- Modify: `src/pages/trainer-dashboard/ui/TrainerDashboardPage.tsx`

- [ ] **Step 1: Создать DashboardPage.module.css**

```css
/* src/pages/dashboard/ui/DashboardPage.module.css */
.page {
  min-height: 100vh;
  padding: 64px 48px;
}
.inner {
  max-width: 1200px;
  margin: 0 auto;
}
.pageHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 48px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

@media (max-width: 1024px) {
  .page { padding: 40px 32px; }
}

@media (max-width: 768px) {
  .page { padding: 24px 16px; }
  .pageHeader {
    flex-direction: column;
    align-items: flex-start;
  }
  .grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Обновить DashboardPage.tsx**

Добавить: `import s from './DashboardPage.module.css';`

```tsx
// Заменить:
<div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 48 }}>
// На:
<div className={s.page} style={{ background: 'var(--paper-100)' }}>
  <div className={s.inner}>
    <header className={s.pageHeader}>
```

```tsx
// Заменить grid div:
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
// На:
<div className={s.grid}>
```

- [ ] **Step 3: Создать TrainerDashboardPage.module.css**

```css
/* src/pages/trainer-dashboard/ui/TrainerDashboardPage.module.css */
.page { min-height: 100vh; padding: 64px 48px; }
.inner { max-width: 1200px; margin: 0 auto; }
.pageHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 48px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

@media (max-width: 1024px) {
  .page { padding: 40px 32px; }
}

@media (max-width: 768px) {
  .page { padding: 24px 16px; }
  .pageHeader { flex-direction: column; gap: 16px; }
  .grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Обновить TrainerDashboardPage.tsx**

Добавить: `import s from './TrainerDashboardPage.module.css';`

```tsx
// Заменить:
<div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
// На:
<div className={s.page} style={{ background: 'var(--paper-100)' }}>
  <div className={s.inner}>
    <header className={s.pageHeader}>
```

```tsx
// Компонент Grid внутри файла заменить с:
const Grid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
    {children}
  </div>
);
// На:
const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className={gridClass}>{children}</div>
);
```

Импорт в TrainerDashboardPage.tsx уже будет добавлен в шаге Step 4. Класс `gridClass` нужно передавать как `s.grid` из импортированного модуля. Так как `Grid` — локальный компонент в том же файле, он имеет доступ к `s`:

```tsx
const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className={s.grid}>{children}</div>
);
```

- [ ] **Step 5: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 6: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/dashboard/ src/pages/trainer-dashboard/
git commit -m "feat: responsive Dashboard and TrainerDashboard pages"
```

---

## Task 7: TournamentManagePage адаптивность

**Files:**
- Create: `src/pages/tournament-manage/ui/TournamentManagePage.module.css`
- Modify: `src/pages/tournament-manage/ui/TournamentManagePage.tsx`

- [ ] **Step 1: Создать TournamentManagePage.module.css**

```css
/* src/pages/tournament-manage/ui/TournamentManagePage.module.css */
.page { min-height: 100vh; }
.inner { padding: 32px 40px; max-width: 1100px; margin: 0 auto; }

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--paper-300);
  margin-top: 32px;
}

.tableWrapper {
  width: 100%;
}

@media (max-width: 1024px) {
  .inner { padding: 24px 24px; }
}

@media (max-width: 768px) {
  .inner { padding: 16px 12px; }

  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    border-bottom: 1px solid var(--paper-300);
    flex-wrap: nowrap;
  }
  .tabs::-webkit-scrollbar { display: none; }

  .tableWrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
```

- [ ] **Step 2: Обновить TournamentManagePage.tsx**

Добавить: `import s from './TournamentManagePage.module.css';`

```tsx
// Заменить:
<div style={{ minHeight: '100vh', background: 'var(--paper-100)' }}>
  <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
// На:
<div className={s.page} style={{ background: 'var(--paper-100)' }}>
  <div className={s.inner}>
```

```tsx
// Заменить div с табами:
<div style={{ marginTop: 32, display: 'flex', gap: 0, borderBottom: '1px solid var(--paper-300)' }}>
// На:
<div className={s.tabs}>
```

```tsx
// В tab === 'participants': обернуть ApplicationsTable:
<div className={s.tableWrapper}>
  <ApplicationsTable tournamentId={tournament.id} frozen={frozen} />
</div>
```

- [ ] **Step 3: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 4: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/tournament-manage/
git commit -m "feat: responsive TournamentManagePage — scrollable tabs and table"
```

---

## Task 8: PublicTournamentsPage + PublicTournamentPage адаптивность

**Files:**
- Create: `src/pages/public-tournaments/ui/PublicTournamentsPage.module.css`
- Create: `src/pages/public-tournament/ui/PublicTournamentPage.module.css`
- Modify: `src/pages/public-tournaments/ui/PublicTournamentsPage.tsx`
- Modify: `src/pages/public-tournament/ui/PublicTournamentPage.tsx`

- [ ] **Step 1: Создать PublicTournamentsPage.module.css**

```css
/* src/pages/public-tournaments/ui/PublicTournamentsPage.module.css */
.page { min-height: 100vh; padding: 64px 48px; }
.inner { max-width: 1200px; margin: 0 auto; }
.filters {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 32px;
  max-width: 480px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

@media (max-width: 1024px) {
  .page { padding: 40px 32px; }
}

@media (max-width: 768px) {
  .page { padding: 24px 16px; }
  .filters { flex-direction: column; align-items: stretch; max-width: 100%; }
  .grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Обновить PublicTournamentsPage.tsx**

Добавить: `import s from './PublicTournamentsPage.module.css';`

```tsx
// Заменить:
<div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
  <div style={{ maxWidth: 1200, margin: '0 auto' }}>
// На:
<div className={s.page} style={{ background: 'var(--paper-100)' }}>
  <div className={s.inner}>
```

```tsx
// Заменить filters div:
<div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 32, maxWidth: 480 }}>
// На:
<div className={s.filters}>
```

```tsx
// Заменить grid div:
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
// На:
<div className={s.grid}>
```

- [ ] **Step 3: Создать PublicTournamentPage.module.css**

```css
/* src/pages/public-tournament/ui/PublicTournamentPage.module.css */
.page { max-width: 1200px; margin: 0 auto; padding: 32px; }

@media (max-width: 1024px) {
  .page { padding: 24px; }
}

@media (max-width: 768px) {
  .page { padding: 16px 12px; }
}
```

- [ ] **Step 4: Обновить PublicTournamentPage.tsx**

Добавить: `import s from './PublicTournamentPage.module.css';`

```tsx
// Заменить:
<div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
// На:
<div className={s.page}>
```

- [ ] **Step 5: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 6: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/public-tournaments/ src/pages/public-tournament/
git commit -m "feat: responsive public tournament pages"
```

---

## Task 9: RegisterBoxerPage + BoxerProfilePage + BoxerForm адаптивность

**Files:**
- Create: `src/pages/register-boxer/ui/RegisterBoxerPage.module.css`
- Create: `src/pages/boxer-profile/ui/BoxerProfilePage.module.css`
- Create: `src/features/boxer-form/ui/BoxerForm.module.css`
- Modify: `src/pages/register-boxer/ui/RegisterBoxerPage.tsx`
- Modify: `src/pages/boxer-profile/ui/BoxerProfilePage.tsx`
- Modify: `src/features/boxer-form/ui/BoxerForm.tsx`

- [ ] **Step 1: Создать RegisterBoxerPage.module.css**

```css
/* src/pages/register-boxer/ui/RegisterBoxerPage.module.css */
.page { min-height: 100vh; padding: 64px 48px; }
.inner { max-width: 720px; margin: 0 auto; }

@media (max-width: 1024px) {
  .page { padding: 40px 32px; }
}

@media (max-width: 768px) {
  .page { padding: 24px 16px; }
}
```

- [ ] **Step 2: Обновить RegisterBoxerPage.tsx**

Добавить: `import s from './RegisterBoxerPage.module.css';`

```tsx
// Заменить:
<div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
  <div style={{ maxWidth: 720, margin: '0 auto' }}>
// На:
<div className={s.page} style={{ background: 'var(--paper-100)' }}>
  <div className={s.inner}>
```

- [ ] **Step 3: Создать BoxerProfilePage.module.css**

```css
/* src/pages/boxer-profile/ui/BoxerProfilePage.module.css */
.page { min-height: 100vh; padding: 64px 48px; }
.inner { max-width: 960px; margin: 0 auto; }
.innerNarrow { max-width: 720px; margin: 0 auto; }

@media (max-width: 1024px) {
  .page { padding: 40px 32px; }
}

@media (max-width: 768px) {
  .page { padding: 24px 16px; }
}
```

- [ ] **Step 4: Обновить BoxerProfilePage.tsx**

Добавить: `import s from './BoxerProfilePage.module.css';`

```tsx
// Заменить в обоих вхождениях (mode === 'edit' и view):
<div style={{ minHeight: '100vh', background: 'var(--paper-100)', padding: '64px 48px' }}>
  <div style={{ maxWidth: 720 (или 960), margin: '0 auto' }}>
// На (edit):
<div className={s.page} style={{ background: 'var(--paper-100)' }}>
  <div className={s.innerNarrow}>
// На (view):
<div className={s.page} style={{ background: 'var(--paper-100)' }}>
  <div className={s.inner}>
```

- [ ] **Step 5: Создать BoxerForm.module.css**

```css
/* src/features/boxer-form/ui/BoxerForm.module.css */
.root {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 560px;
}

@media (max-width: 768px) {
  .root { max-width: 100%; }
}
```

- [ ] **Step 6: Обновить BoxerForm.tsx**

Добавить: `import s from './BoxerForm.module.css';`

```tsx
// Заменить:
<div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>
// На:
<div className={s.root}>
```

- [ ] **Step 7: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 8: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/register-boxer/ src/pages/boxer-profile/ src/features/boxer-form/
git commit -m "feat: responsive boxer pages and form"
```

---

## Task 10: CreateTournamentWizard адаптивность

**Files:**
- Create: `src/features/tournament-create/ui/CreateTournamentWizard.module.css`
- Modify: `src/features/tournament-create/ui/CreateTournamentWizard.tsx`

- [ ] **Step 1: Создать CreateTournamentWizard.module.css**

```css
/* src/features/tournament-create/ui/CreateTournamentWizard.module.css */
.wizardHeader {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  border-bottom: 1px solid var(--paper-300);
  position: sticky;
  top: 0;
  background: var(--paper-100);
  z-index: 5;
}

.body {
  flex: 1;
  padding: 40px;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 1024px) {
  .wizardHeader { padding: 0 24px; }
  .body { padding: 32px 24px; }
}

@media (max-width: 768px) {
  .wizardHeader { padding: 0 12px; height: 56px; }
  .body { padding: 20px 12px; }
}
```

- [ ] **Step 2: Обновить CreateTournamentWizard.tsx**

Добавить: `import s from './CreateTournamentWizard.module.css';`

```tsx
// Заменить header:
<header style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', borderBottom: '1px solid var(--paper-300)', position: 'sticky', top: 0, background: 'var(--paper-100)', zIndex: 5 }}>
// На:
<header className={s.wizardHeader}>
```

Найти `<div style={{ flex: 1, ... padding: 40 ... }}>` — основной блок контента после header (в файле это `<div style={{ flex: 1, overflowY: 'auto', padding: 40, ... }}>`) и заменить padding на className:

```tsx
// Было (примерно строка ~140):
<div style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
// Стало:
<div className={s.body} style={{ flex: 1, overflowY: 'auto' }}>
```

- [ ] **Step 3: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 4: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/features/tournament-create/
git commit -m "feat: responsive CreateTournamentWizard"
```

---

## Task 11: AiAssistantPanel — bottom sheet на мобильном (TDD)

**Files:**
- Create: `src/widgets/ai-assistant/ui/AiAssistantPanel.module.css`
- Modify: `src/widgets/ai-assistant/ui/AiAssistantPanel.tsx`
- Create (или расширить): `src/widgets/ai-assistant/ui/AiAssistantPanel.test.tsx`

- [ ] **Step 1: Написать failing тесты**

```tsx
// src/widgets/ai-assistant/ui/AiAssistantPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiAssistantPanel } from './AiAssistantPanel';

vi.mock('@/app/providers', () => ({
  useAuthContext: vi.fn(() => ({
    user: { fullName: 'Тест', role: 'organizer', email: 'test@test.com' },
  })),
}));

vi.mock('../model/useAiChat', () => ({
  useAiChat: vi.fn(() => ({
    messages: [{ role: 'assistant', content: 'Привет!' }],
    loading: false,
    sendMessage: vi.fn(),
    clearHistory: vi.fn(),
  })),
}));

function mockMQ(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: vi.fn((q: string) => ({
      matches,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('AiAssistantPanel', () => {
  it('drag handle отсутствует на десктопе (matchMedia → false)', () => {
    mockMQ(false);
    render(<AiAssistantPanel onClose={vi.fn()} />);
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
  });

  it('drag handle присутствует на мобильном (matchMedia → true)', () => {
    mockMQ(true);
    render(<AiAssistantPanel onClose={vi.fn()} />);
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться что FAIL**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npx vitest run src/widgets/ai-assistant/ui/AiAssistantPanel.test.tsx`
Expected: FAIL (drag-handle не существует)

- [ ] **Step 3: Создать AiAssistantPanel.module.css**

```css
/* src/widgets/ai-assistant/ui/AiAssistantPanel.module.css */
.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 480px;
  background: var(--paper-100);
  border-left: 1px solid var(--paper-300);
  box-shadow: var(--shadow-elevated);
  display: flex;
  flex-direction: column;
  z-index: 500;
  animation: aiPanelIn 0.4s var(--ease-out-expo);
}

@keyframes aiPanelIn {
  from { transform: translateX(40px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@media (max-width: 768px) {
  .panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 85vh;
    border-left: none;
    border-top: 1px solid var(--paper-300);
    border-radius: 12px 12px 0 0;
    animation: aiPanelUp 0.35s var(--ease-out-quart);
  }
}

@keyframes aiPanelUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.dragHandle {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  flex-shrink: 0;
}

.dragHandle::after {
  content: '';
  display: block;
  width: 32px;
  height: 3px;
  background: var(--paper-300);
  border-radius: 2px;
}
```

- [ ] **Step 4: Обновить AiAssistantPanel.tsx**

Добавить импорты:
```tsx
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import s from './AiAssistantPanel.module.css';
```

Заменить корневой `<div>` панели:
```tsx
// Было:
<div
  style={{
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
    background: 'var(--paper-100)', borderLeft: '1px solid var(--paper-300)',
    boxShadow: 'var(--shadow-elevated)', display: 'flex', flexDirection: 'column',
    zIndex: 500, animation: 'aiPanelIn 0.4s var(--ease-out-expo)',
  }}
>
// Стало:
<div className={s.panel}>
```

Добавить drag handle в начало панели (перед Header):
```tsx
const isMobile = useMediaQuery('(max-width: 768px)');

// ... внутри return:
<div className={s.panel}>
  {isMobile && <div className={s.dragHandle} data-testid="drag-handle" />}
  {/* существующий Header */}
  {/* существующие Suggestions */}
  {/* существующий Messages */}
  {/* существующий Input */}
</div>
```

Удалить `<style>` тег с `@keyframes aiPanelIn` из JSX — анимации теперь в CSS Module. Остальные keyframes (msgFadeIn, typing, aiPulse) оставить в `<style>` или перенести в module — на выбор.

- [ ] **Step 5: Запустить тесты — убедиться что PASS**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npx vitest run src/widgets/ai-assistant/ui/AiAssistantPanel.test.tsx`
Expected: 2 passed

- [ ] **Step 6: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 7: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/widgets/ai-assistant/
git commit -m "feat: AiAssistantPanel as bottom sheet on mobile"
```

---

## Task 12: LiveScoringPage — landscape hint на телефоне

**Files:**
- Create: `src/pages/live-scoring/ui/LiveScoringPage.module.css`
- Modify: `src/pages/live-scoring/ui/LiveScoringPage.tsx`

- [ ] **Step 1: Создать LiveScoringPage.module.css**

```css
/* src/pages/live-scoring/ui/LiveScoringPage.module.css */
.landscapeHint {
  display: none;
}

@media (max-width: 768px) and (orientation: portrait) {
  .landscapeHint {
    display: flex;
    position: fixed;
    inset: 0;
    background: var(--ink-dark-bg);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 9999;
  }
}

.hintIcon {
  font-size: 48px;
}

.hintText {
  font-family: var(--font-mono);
  font-size: 12px;
  color: rgba(242, 238, 229, 0.5);
  letter-spacing: 0.06em;
  text-align: center;
  line-height: 1.8;
  text-transform: uppercase;
}
```

- [ ] **Step 2: Обновить LiveScoringPage.tsx**

Добавить: `import s from './LiveScoringPage.module.css';`

В компоненте `ActiveLiveScoring`, в конце JSX перед закрывающим тегом `</div>` — добавить overlay:

```tsx
// Внутри return ActiveLiveScoring, вставить сразу после открывающего <div style={{ height: '100vh', ... }}>:
<div className={s.landscapeHint}>
  <div className={s.hintIcon}>📱</div>
  <div className={s.hintText}>
    Поверни устройство<br />для удобного<br />судейства
  </div>
</div>
```

- [ ] **Step 3: Проверить типы**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npm run build`
Expected: ✓ built

- [ ] **Step 4: Запустить все тесты**

Run: `cd /Users/andreisidorcenko/diplom/boxr && npx vitest run`
Expected: все тесты проходят

- [ ] **Step 5: Коммит**

```bash
cd /Users/andreisidorcenko/diplom/boxr
git add src/pages/live-scoring/
git commit -m "feat: LiveScoringPage landscape hint on portrait phone"
```
