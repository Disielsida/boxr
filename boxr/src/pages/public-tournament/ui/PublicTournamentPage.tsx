import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { LEVEL_LABEL, StatusPill, TYPE_LABEL, formatDateRange } from '@/entities/tournament';
import { matchesApi, tournamentsApi, ApiError } from '@/shared/api';
import { MonoLabel } from '@/shared/ui';
import { BracketView } from '@/widgets/bracket-view';
import { ResultsView } from '@/widgets/results-view';
import { ScheduleView } from '@/widgets/schedule-view';

import s from './PublicTournamentPage.module.css';

import type { Bracket, PublicTournament, Results } from '@/shared/types';

type Tab = 'bracket' | 'schedule' | 'results';

export const PublicTournamentPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, initializing } = useAuthContext();
  const [tournament, setTournament] = useState<PublicTournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('bracket');

  useEffect(() => {
    tournamentsApi
      .findPublic(id)
      .then((t) => {
        setTournament(t);
        if (t.status === 'finished') setTab('results');
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Турнир не найден'));
  }, [id]);

  useEffect(() => {
    if (!tournament) return;
    if (tournament.status === 'in_progress' || tournament.status === 'finished') {
      matchesApi.getPublicBracket(id).then(setBracket).catch(() => {});
      matchesApi.getPublicResults(id).then(setResults).catch(() => {});
    }
  }, [tournament?.status, id]);

  if (error) {
    return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <h1>Турнир не найден</h1>
      </div>
    );
  }
  if (!tournament) return null;

  const hasSchedule = bracket?.categories.some((c) => c.matches.some((m) => m.scheduledAt !== null)) ?? false;
  const hasData = tournament.status === 'in_progress' || tournament.status === 'finished';

  const TAB_LABELS: Record<Tab, string> = {
    bracket: 'Сетка',
    schedule: 'Расписание',
    results: 'Результаты',
  };

  return (
    <div className={s.page}>
      <button
        onClick={() => navigate('/tournaments')}
        className={s.backBtn}
      >
        ← Все турниры
      </button>

      <MonoLabel>{TYPE_LABEL[tournament.type]} · {LEVEL_LABEL[tournament.level]}</MonoLabel>
      <h1 style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.03em' }}>
        {tournament.name}
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--ink-500)', fontStyle: 'italic' }}>
          {formatDateRange(tournament.dateStart, tournament.dateEnd)} · {tournament.city}
          {tournament.address ? ` · ${tournament.address}` : ''}
        </span>
        <StatusPill tournament={tournament} showPhase />
      </div>

      {tournament.status === 'published' && !initializing && (
        <div style={{ marginTop: 20, marginBottom: 32 }}>
          {user?.role === 'trainer' ? (
            <Link
              to="/trainer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 42,
                padding: '0 24px',
                background: 'var(--ink-900)',
                color: 'var(--paper-100)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '0.02em',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              В кабинет тренера →
            </Link>
          ) : !user ? (
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 42,
                padding: '0 24px',
                background: 'transparent',
                color: 'var(--ink-900)',
                border: '1.5px solid var(--ink-900)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '0.02em',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--ink-900)';
                e.currentTarget.style.color = 'var(--paper-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--ink-900)';
              }}
            >
              Войти для подачи заявки →
            </Link>
          ) : null}
        </div>
      )}

      {tournament.status !== 'published' && <div style={{ marginBottom: 32 }} />}

      <div className={s.tabs}>
        {(['bracket', 'schedule', 'results'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`${s.tabBtn} ${tab === t ? s.tabBtnActive : ''}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        {tab === 'bracket' && (
          hasData && bracket
            ? <BracketView bracket={bracket} readOnly />
            : <Empty text={hasData ? 'Загрузка сетки…' : 'Сетка будет опубликована после жеребьёвки.'} />
        )}

        {tab === 'schedule' && (
          hasData
            ? hasSchedule
              ? <ScheduleView bracket={bracket!} readOnly />
              : <Empty text="Расписание матчей пока не составлено." />
            : <Empty text="Расписание появится после начала турнира." />
        )}

        {tab === 'results' && (
          hasData && results
            ? results.categories.length > 0
              ? <ResultsView results={results} />
              : <Empty text="Результатов пока нет — турнир в процессе." />
            : <Empty text={hasData ? 'Загрузка результатов…' : 'Результаты появятся по ходу турнира.'} />
        )}
      </div>
    </div>
  );
};

const Empty = ({ text }: { text: string }) => (
  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-400)', fontStyle: 'italic' }}>
    {text}
  </div>
);
