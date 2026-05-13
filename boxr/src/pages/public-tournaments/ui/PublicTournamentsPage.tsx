import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { TournamentCard } from '@/entities/tournament';
import { ApiError, tournamentsApi } from '@/shared/api';
import { Input, MonoLabel } from '@/shared/ui';

import s from './PublicTournamentsPage.module.css';

import { computePhase } from '@/entities/tournament';

import type { PublicTournament, TournamentPhase } from '@/shared/types';

const PHASE_TABS: { phase: TournamentPhase; label: string }[] = [
  { phase: 'active',   label: 'Идут' },
  { phase: 'open',     label: 'Регистрация' },
  { phase: 'finished', label: 'Завершены' },
];

function displayPhase(t: PublicTournament): TournamentPhase {
  if (t.status === 'finished' || t.status === 'cancelled') return 'finished';
  if (t.status === 'in_progress') return 'active';
  return computePhase(t);
}

export const PublicTournamentsPage = () => {
  const [items, setItems] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState('');
  const [phase, setPhase] = useState<TournamentPhase>('active');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await tournamentsApi.listPublic({ limit: 100 });
      setItems(page.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить турниры');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = items
    .filter((t) => displayPhase(t) === phase)
    .filter((t) => !nameSearch.trim() || t.name.toLowerCase().includes(nameSearch.trim().toLowerCase()));

  return (
    <div className={s.page} style={{ background: 'var(--paper-100)' }}>
      <div className={s.inner}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--ink-500)',
            padding: '0 0 24px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-900)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-500)')}
        >
          ← На главную
        </button>

        <header style={{ marginBottom: 40 }}>
          <MonoLabel style={{ marginBottom: 16 }}>КАТАЛОГ</MonoLabel>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(36px, 4vw, 56px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: 8,
            }}
          >
            Турниры
          </h1>
        </header>

        <div className={s.phaseFilters}>
          {PHASE_TABS.map(({ phase: p, label }) => (
            <button
              key={p}
              className={`${s.phaseBtn} ${phase === p ? s.phaseBtnActive : ''}`}
              onClick={() => setPhase(p)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={s.filters}>
          <div style={{ flex: 1, maxWidth: 400 }}>
            <Input
              label="Поиск по названию"
              placeholder="Кубок России..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
            />
          </div>
        </div>

        {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
        {error && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{error}</div>}
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
            {phase === 'active' && 'Сейчас нет активных турниров'}
            {phase === 'open' && 'Нет турниров с открытой регистрацией'}
            {phase === 'finished' && 'Нет завершённых турниров'}
            {nameSearch.trim() && ` по запросу «${nameSearch.trim()}»`}.
          </div>
        )}
        <div className={s.grid}>
          {filtered.map((t) => (
            <Link
              key={t.id}
              to={`/public/tournaments/${t.id}`}
              style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
            >
              <TournamentCard tournament={t} showPhase />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
