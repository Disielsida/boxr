// src/widgets/app-shell/ui/AppShell.tsx
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import { Logo } from '@/shared/ui';

import s from './AppShell.module.css';

const ROOT_ROUTES: Record<string, string> = {
  organizer: '/dashboard',
  trainer: '/trainer',
  judge: '/judge',
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
  judge: [
    { label: 'Мои бои', to: '/judge' },
  ],
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
          <Logo height={22} />
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
