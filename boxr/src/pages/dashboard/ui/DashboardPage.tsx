import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { TournamentCard } from '@/entities/tournament';
import { ApiError, tournamentsApi } from '@/shared/api';
import { Button, Input, MonoLabel } from '@/shared/ui';

import s from './DashboardPage.module.css';

import type { Tournament, TournamentStatus } from '@/shared/types';

const ROLE_GENITIVE: Record<string, string> = {
  organizer: 'организатора',
  trainer: 'тренера',
  judge: 'судьи',
};

const STATUS_TABS: { status: TournamentStatus | 'all'; label: string }[] = [
  { status: 'all',         label: 'Все' },
  { status: 'in_progress', label: 'Идут' },
  { status: 'published',   label: 'Регистрация' },
  { status: 'finished',    label: 'Завершены' },
  { status: 'draft',       label: 'Черновики' },
];

export const DashboardPage = () => {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<TournamentStatus | 'all'>('in_progress');
  const [search, setSearch] = useState('');

  const isOrganizer = user?.role === 'organizer';

  const load = useCallback(async () => {
    if (!isOrganizer) return;
    setLoading(true);
    setError(null);
    try {
      const page = await tournamentsApi.listMine({ limit: 50 });
      setTournaments(page.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить турниры');
    } finally {
      setLoading(false);
    }
  }, [isOrganizer]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = tournaments
    .filter((t) => activeStatus === 'all' || t.status === activeStatus)
    .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.trim().toLowerCase()));

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className={s.page} style={{ background: 'var(--paper-100)' }}>
      <div className={s.inner}>
        <header className={s.pageHeader}>
          <div>
            <MonoLabel style={{ marginBottom: 0, fontSize: '0.8rem' }}>ДАШБОРД</MonoLabel>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4vw, 56px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                marginBottom: 8,
              }}
            >
              Кабинет {user ? ROLE_GENITIVE[user.role] : ''}.
            </h1>
            <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-base)' }}>
              {user?.fullName} · {user?.email}
            </p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>Выйти</Button>
        </header>

        {isOrganizer && (
          <section>
            <div className={s.sectionHeader}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(24px, 2.5vw, 32px)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                }}
              >
                Мои турниры
              </h2>
              <Button onClick={() => navigate('/tournaments/new')} icon="plus">
                Создать турнир
              </Button>
            </div>

            <div className={s.phaseFilters}>
              {STATUS_TABS.map(({ status, label }) => (
                <button
                  key={status}
                  className={`${s.phaseBtn} ${activeStatus === status ? s.phaseBtnActive : ''}`}
                  onClick={() => setActiveStatus(status)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ maxWidth: 360, marginBottom: 24 }}>
              <Input
                label="Поиск по названию"
                placeholder="Кубок России..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
            {error && (
              <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{error}</div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div
                style={{
                  padding: 48,
                  textAlign: 'center',
                  background: 'var(--paper-200)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--ink-500)',
                }}
              >
                {tournaments.length === 0
                  ? 'У вас пока нет турниров. Создайте первый — это займёт пару минут.'
                  : 'Нет турниров с выбранным статусом.'}
              </div>
            )}
            <div className={s.grid}>
              {filtered.map((t) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  showPhase
                  onClick={() => navigate(`/tournaments/${t.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
