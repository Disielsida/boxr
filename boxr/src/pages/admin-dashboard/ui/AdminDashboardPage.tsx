import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { ApiError, tournamentsApi, usersApi } from '@/shared/api';
import type { AdminUser } from '@/shared/api';
import { Button, Input, MonoLabel } from '@/shared/ui';

import s from './AdminDashboardPage.module.css';

import type { Tournament, TournamentStatus, UserRole } from '@/shared/types';

type Tab = 'users' | 'tournaments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Пользователи' },
  { id: 'tournaments', label: 'Турниры' },
];

const ROLE_LABEL: Record<UserRole, string> = {
  organizer: 'Организатор',
  trainer: 'Тренер',
  judge: 'Судья',
  admin: 'Администратор',
};

const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  in_progress: 'Идёт',
  finished: 'Завершён',
  cancelled: 'Отменён',
};

const STATUS_CLASS: Record<TournamentStatus, string> = {
  draft: s.statusDraft,
  published: s.statusPublished,
  in_progress: s.statusProgress,
  finished: s.statusFinished,
  cancelled: s.statusCancelled,
};

export const AdminDashboardPage = () => {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('users');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentSearch, setTournamentSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, t] = await Promise.all([
        usersApi.listAll(),
        tournamentsApi.listAll(),
      ]);
      setUsers(u);
      setTournaments(t);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleRoleChange = async (id: string, role: UserRole) => {
    try {
      await usersApi.updateRole(id, role);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить пользователя «${name}»? Это действие необратимо.`)) return;
    try {
      await usersApi.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  };

  const filteredUsers = users.filter((u) =>
    !userSearch.trim() ||
    u.fullName.toLowerCase().includes(userSearch.trim().toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.trim().toLowerCase()),
  );

  const filteredTournaments = tournaments.filter((t) =>
    !tournamentSearch.trim() ||
    t.name.toLowerCase().includes(tournamentSearch.trim().toLowerCase()),
  );

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.pageHeader}>
          <div>
            <MonoLabel style={{ marginBottom: 5, fontSize: '0.8rem' }}>ДАШБОРД</MonoLabel>
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
              Кабинет администратора.
            </h1>
            <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-base)' }}>
              {user?.fullName} · {user?.email}
            </p>
          </div>
          <button className={s.logoutBtn} onClick={() => void handleLogout()}>Выйти</button>
        </header>

        {error && <div style={{ color: 'var(--danger)', marginBottom: 24 }}>{error}</div>}

        <div className={s.tabs}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`${s.tabBtn} ${tab === id ? s.tabBtnActive : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Пользователи ── */}
        {tab === 'users' && (
          <>
            <div className={s.sectionHeader}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 2.5vw, 32px)', fontWeight: 600, letterSpacing: '-0.02em' }}>
                Пользователи
                {!loading && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 400, color: 'var(--ink-400)', marginLeft: 12 }}>{users.length}</span>}
              </h2>
              <Button onClick={() => void load()}>Обновить</Button>
            </div>

            <div style={{ maxWidth: 360, marginBottom: 24 }}>
              <Input
                label="Поиск по имени или email"
                placeholder="Иванов или ivan@..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
            {!loading && (
              <div style={{ overflowX: 'auto' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>ИМЯ</th>
                      <th>EMAIL</th>
                      <th>РОЛЬ</th>
                      <th>ДАТА</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500 }}>{u.fullName}</td>
                        <td style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.email}</td>
                        <td>
                          {u.id === user?.id ? (
                            <span className={s.roleBadge}>{ROLE_LABEL[u.role]}</span>
                          ) : (
                            <select
                              className={s.roleSelect}
                              value={u.role}
                              onChange={(e) => void handleRoleChange(u.id, e.target.value as UserRole)}
                            >
                              <option value="organizer">Организатор</option>
                              <option value="trainer">Тренер</option>
                              <option value="judge">Судья</option>
                              <option value="admin">Администратор</option>
                            </select>
                          )}
                        </td>
                        <td style={{ color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td>
                          {u.id !== user?.id && (
                            <button
                              className={s.deleteBtn}
                              onClick={() => void handleDelete(u.id, u.fullName)}
                            >
                              Удалить
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-400)', padding: 32 }}>
                          Нет пользователей
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Турниры ── */}
        {tab === 'tournaments' && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 2.5vw, 32px)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 24 }}>
              Все турниры
              {!loading && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 400, color: 'var(--ink-400)', marginLeft: 12 }}>{tournaments.length}</span>}
            </h2>

            <div style={{ maxWidth: 360, marginBottom: 24 }}>
              <Input
                label="Поиск по названию"
                placeholder="Кубок России..."
                value={tournamentSearch}
                onChange={(e) => setTournamentSearch(e.target.value)}
              />
            </div>

            {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
            {!loading && (
              <div style={{ overflowX: 'auto' }}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>НАЗВАНИЕ</th>
                      <th>ГОРОД</th>
                      <th>ДАТЫ</th>
                      <th>СТАТУС</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTournaments.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500 }}>{t.name}</td>
                        <td style={{ color: 'var(--ink-500)' }}>{t.city}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>
                          {t.dateStart} — {t.dateEnd}
                        </td>
                        <td>
                          <span className={`${s.statusBadge} ${STATUS_CLASS[t.status]}`}>
                            {STATUS_LABEL[t.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredTournaments.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-400)', padding: 32 }}>
                          Нет турниров
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
