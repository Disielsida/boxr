import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { ApplicationStatusPill } from '@/entities/application';
import { BoxerCard } from '@/entities/boxer';
import { ApplicationsSubmitDialog } from '@/features/applications-submit';
import { ApiError, applicationsApi, boxersApi, tournamentsApi } from '@/shared/api';
import { Button, Input, MonoLabel } from '@/shared/ui';

import s from './TrainerDashboardPage.module.css';

import type { Application, Boxer, PublicTournament } from '@/shared/types';

type Tab = 'boxers' | 'applications' | 'tournaments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'boxers',       label: 'Мои боксёры' },
  { id: 'applications', label: 'Заявки' },
  { id: 'tournaments',  label: 'Турниры' },
];

const PHASE_LABEL: Record<string, string> = {
  open:   'Регистрация',
  active: 'Идёт',
};

export const TrainerDashboardPage = () => {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('boxers');
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [activeTournaments, setActiveTournaments] = useState<PublicTournament[]>([]);
  const [openTournaments, setOpenTournaments] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitFor, setSubmitFor] = useState<PublicTournament | null>(null);
  const [boxerSearch, setBoxerSearch] = useState('');
  const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null);
  const [tournamentSearch, setTournamentSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, a, t] = await Promise.all([
        boxersApi.list(),
        applicationsApi.listMine({}),
        tournamentsApi.listPublic({ limit: 100 }),
      ]);
      setBoxers(b.items);
      setApps(a.items);
      setOpenTournaments(t.items.filter((x) => x.phase === 'open'));
      setActiveTournaments(t.items.filter((x) => x.phase === 'open' || x.phase === 'active'));
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

  // Турниры, по которым есть хотя бы одна заявка
  const tournamentsWithApps = activeTournaments.filter((t) =>
    apps.some((a) => a.tournamentId === t.id),
  );

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
              Кабинет тренера.
            </h1>
            <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-base)' }}>
              {user?.fullName} · {user?.email}
            </p>
          </div>
          <Button variant="ghost" onClick={handleLogout} style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>Выйти</Button>
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

        <div>
          {/* ── Боксёры ── */}
          {tab === 'boxers' && (
            <>
              <div className={s.sectionHeader}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 2.5vw, 32px)', fontWeight: 600, letterSpacing: '-0.02em' }}>
                  Мои боксёры
                </h2>
                <Button onClick={() => navigate('/boxers/new')}>Добавить боксёра</Button>
              </div>
              {!loading && boxers.length > 0 && (
                <div style={{ maxWidth: 360, marginBottom: 24 }}>
                  <Input
                    label="Поиск по имени"
                    placeholder="Иванов Иван..."
                    value={boxerSearch}
                    onChange={(e) => setBoxerSearch(e.target.value)}
                  />
                </div>
              )}
              {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
              {!loading && boxers.length === 0 && <Empty text="Пока нет боксёров. Добавьте первого." />}
              {!loading && boxers.length > 0 && boxerSearch.trim() &&
                boxers.filter((b) => b.fullName.toLowerCase().includes(boxerSearch.trim().toLowerCase())).length === 0 && (
                  <Empty text="Нет боксёров с таким именем." />
                )}
              <div className={s.grid}>
                {boxers
                  .filter((b) => !boxerSearch.trim() || b.fullName.toLowerCase().includes(boxerSearch.trim().toLowerCase()))
                  .map((b) => (
                    <BoxerCard key={b.id} boxer={b} onClick={() => navigate(`/boxers/${b.id}`)} />
                  ))}
              </div>
            </>
          )}

          {/* ── Заявки ── */}
          {tab === 'applications' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 2.5vw, 32px)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 24 }}>
                Заявки
              </h2>
              {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
              {!loading && tournamentsWithApps.length === 0 && (
                <Empty text="Заявок пока нет. Подайте боксёров на турнир во вкладке «Турниры»." />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tournamentsWithApps.map((t) => {
                  const tournamentApps = apps.filter((a) => a.tournamentId === t.id);
                  const isExpanded = expandedTournamentId === t.id;
                  return (
                    <div
                      key={t.id}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--paper-300)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Заголовок турнира */}
                      <button
                        type="button"
                        onClick={() => setExpandedTournamentId(isExpanded ? null : t.id)}
                        style={{
                          all: 'unset',
                          display: 'flex',
                          width: '100%',
                          boxSizing: 'border-box',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          background: isExpanded ? 'var(--ink-900)' : 'var(--paper-200)',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: 'var(--text-base)',
                            color: isExpanded ? 'var(--paper-100)' : 'var(--ink-900)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {t.name}
                          </div>
                          <div style={{
                            fontSize: 12,
                            marginTop: 3,
                            color: isExpanded ? 'rgba(255,255,255,0.55)' : 'var(--ink-500)',
                          }}>
                            {t.dateStart} — {t.dateEnd} · {t.city}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            letterSpacing: '0.06em',
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: isExpanded ? 'rgba(255,255,255,0.15)' : 'var(--paper-300)',
                            color: isExpanded ? 'white' : 'var(--ink-500)',
                          }}>
                            {PHASE_LABEL[t.phase] ?? t.phase}
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: isExpanded ? 'rgba(255,255,255,0.7)' : 'var(--ink-500)',
                          }}>
                            {tournamentApps.length} заявок
                          </span>
                          <span style={{
                            fontSize: 16,
                            color: isExpanded ? 'rgba(255,255,255,0.7)' : 'var(--ink-400)',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            display: 'inline-block',
                          }}>
                            ↓
                          </span>
                        </div>
                      </button>

                      {/* Список заявок */}
                      {isExpanded && (
                        <div style={{ background: 'var(--paper-100)' }}>
                          {tournamentApps.map((a, i) => (
                            <div
                              key={a.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 20px',
                                borderTop: i === 0 ? 'none' : '1px solid var(--paper-300)',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                                  {boxers.find((b) => b.id === a.boxerId)?.fullName ?? '—'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                                  {a.category} кг
                                  {a.rejectReason ? ` · ${a.rejectReason}` : ''}
                                </div>
                              </div>
                              <ApplicationStatusPill status={a.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Турниры ── */}
          {tab === 'tournaments' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 2.5vw, 32px)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 24 }}>
                Открытые турниры
              </h2>
              {!loading && openTournaments.length > 0 && (
                <div style={{ maxWidth: 360, marginBottom: 24 }}>
                  <Input
                    label="Поиск по названию"
                    placeholder="Кубок России..."
                    value={tournamentSearch}
                    onChange={(e) => setTournamentSearch(e.target.value)}
                  />
                </div>
              )}
              {!loading && openTournaments.length === 0 && <Empty text="Сейчас нет турниров, открытых для регистрации." />}
              {!loading && openTournaments.length > 0 && tournamentSearch.trim() &&
                openTournaments.filter((t) => t.name.toLowerCase().includes(tournamentSearch.trim().toLowerCase())).length === 0 && (
                  <Empty text="Нет турниров с таким названием." />
                )}
              <div className={s.grid}>
                {openTournaments
                  .filter((t) => !tournamentSearch.trim() || t.name.toLowerCase().includes(tournamentSearch.trim().toLowerCase()))
                  .map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: 24,
                      background: 'var(--paper-200)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: 0 }}>{t.name}</h3>
                    <div style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
                      {t.dateStart} — {t.dateEnd} · {t.city}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>
                      {t.categories.length} категорий
                    </div>
                    <Button onClick={() => setSubmitFor(t)} disabled={boxers.length === 0}>
                      Подать заявку
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {submitFor && (
        <ApplicationsSubmitDialog
          tournament={submitFor}
          onClose={() => setSubmitFor(null)}
          onSubmitted={() => {
            setSubmitFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
};

const Empty = ({ text }: { text: string }) => (
  <div
    style={{
      padding: 32,
      textAlign: 'center',
      background: 'var(--paper-200)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--ink-500)',
    }}
  >
    {text}
  </div>
);
