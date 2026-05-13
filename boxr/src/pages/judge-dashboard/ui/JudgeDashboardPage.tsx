import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { ApiError, matchesApi } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';

import s from './JudgeDashboardPage.module.css';

import type { JudgeMatch } from '@/shared/types';

const STATUS_LABEL: Record<string, string> = {
  pending:   'Ожидает',
  ready:     'Готов к судейству',
  completed: 'Завершён',
};

export const JudgeDashboardPage = () => {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<JudgeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'current' | 'completed'>('current');

  useEffect(() => {
    matchesApi
      .getMyMatches()
      .then(setMatches)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <div>
            <MonoLabel style={{ marginBottom: 0, fontSize: '0.8rem' }}>ДАШБОРД</MonoLabel>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(36px, 4vw, 56px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginBottom: 8,
              }}
            >
              Кабинет судьи.
            </h1>
            <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-base)' }}>
              {user?.fullName} · {user?.email}
            </p>
          </div>
          <Button variant="ghost" onClick={handleLogout} style={{ alignSelf: 'flex-start' }}>Выйти</Button>
        </header>

        <section>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            Назначенные бои
          </h2>

          <div className={s.filters}>
            <button
              className={`${s.filterBtn} ${filter === 'current' ? s.filterBtnActive : ''}`}
              onClick={() => setFilter('current')}
            >
              Текущие
            </button>
            <button
              className={`${s.filterBtn} ${filter === 'completed' ? s.filterBtnActive : ''}`}
              onClick={() => setFilter('completed')}
            >
              Завершённые
            </button>
          </div>

          {loading && (
            <p style={{ color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              Загрузка…
            </p>
          )}
          {error && <p style={{ color: 'var(--ring-600)' }}>{error}</p>}

          {!loading && !error && (() => {
            const filtered = matches.filter((m) =>
              filter === 'current' ? m.status !== 'completed' : m.status === 'completed',
            );
            if (filtered.length === 0) return (
              <p style={{ color: 'var(--ink-400)' }}>
                {filter === 'current' ? 'Нет текущих боёв.' : 'Нет завершённых боёв.'}
              </p>
            );
            return (
            <div className={s.list}>
              {filtered.map((m) => (
                <div key={m.id} className={s.card}>
                  <div className={s.cardInfo}>
                    <div className={s.matchTitle}>
                      {m.red?.fullName ?? 'BYE'} vs {m.blue?.fullName ?? 'BYE'}
                    </div>
                    <div className={s.matchMeta}>
                      {m.tournamentName.toUpperCase()} · {m.category} кг · Р{m.round}
                      {m.scheduledAt
                        ? ` · ${new Date(m.scheduledAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
                        : ''}
                      {m.ring ? ` · Ринг ${m.ring}` : ''}
                    </div>
                    <div
                      className={
                        m.status === 'ready'
                          ? s.statusReady
                          : m.status === 'completed'
                            ? s.statusCompleted
                            : s.statusPending
                      }
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {STATUS_LABEL[m.status]}
                    </div>
                  </div>

                  {m.status === 'ready' && (
                    <Link to={`/scoring/${m.id}`} className={s.startButton}>
                      НАЧАТЬ →
                    </Link>
                  )}
                </div>
              ))}
            </div>
            );
          })()}
        </section>
      </div>
    </div>
  );
};
