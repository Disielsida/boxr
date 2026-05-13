import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  LEVEL_LABEL,
  StatusPill,
  TYPE_LABEL,
  formatDateRange,
} from '@/entities/tournament';
import { ApplicationsTable } from '@/features/applications-review';
import { CreateTournamentWizard } from '@/features/tournament-create';
import { ApiError, matchesApi, tournamentsApi } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';
import { Icon } from '@/shared/ui/icon/Icon';
import { AssignJudgeDialog, BracketView, MatchResultDialog } from '@/widgets/bracket-view';
import { ResultsView } from '@/widgets/results-view';
import { ScheduleView, MatchScheduleDialog } from '@/widgets/schedule-view';

import s from './TournamentManagePage.module.css';

import type { Bracket, BracketMatch, Results, Tournament } from '@/shared/types';

type Mode = 'view' | 'edit';
type Tab = 'info' | 'participants' | 'bracket' | 'schedule' | 'results';

export const TournamentManagePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [tab, setTab] = useState<Tab>('info');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [bracketError, setBracketError] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [activeMatch, setActiveMatch] = useState<BracketMatch | null>(null);
  const [scheduleMatch, setScheduleMatch] = useState<BracketMatch | null>(null);
  const [assignJudgeMatch, setAssignJudgeMatch] = useState<BracketMatch | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const t = await tournamentsApi.findOne(id);
      setTournament(t);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'Турнир не найден или у вас нет доступа'
          : 'Не удалось загрузить турнир',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!tournament) return;
    if (tournament.status !== 'in_progress' && tournament.status !== 'finished') return;
    setBracketLoading(true);
    matchesApi
      .getBracket(tournament.id)
      .then((b) => setBracket(b))
      .catch((e) => setBracketError(e instanceof ApiError ? e.message : 'Ошибка'))
      .finally(() => setBracketLoading(false));
    matchesApi
      .getPublicResults(tournament.id)
      .then((r) => setResults(r))
      .catch(() => {});
  }, [tournament?.id, tournament?.status]);

  const runAction = async (fn: () => Promise<Tournament | void>) => {
    setActionPending(true);
    setActionError(null);
    try {
      const r = await fn();
      if (r) setTournament(r);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Не удалось выполнить');
    } finally {
      setActionPending(false);
    }
  };

  if (loading) return <Centered text="Загрузка…" />;
  if (error || !tournament) return <Centered text={error ?? 'Не найдено'} action={() => navigate('/dashboard')} />;

  if (mode === 'edit') {
    return (
      <CreateTournamentWizard
        initial={tournament}
        onSubmitted={(t) => { setTournament(t); setMode('view'); }}
        onCancel={() => setMode('view')}
      />
    );
  }

  const isDraft = tournament.status === 'draft';
  const isPublished = tournament.status === 'published';
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const start = new Date(`${tournament.dateStart}T00:00:00Z`);
  const frozen = !isPublished || start.getTime() <= today.getTime();

  return (
    <div className={s.page} style={{ background: 'var(--paper-100)' }}>
      <div className={s.inner}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>← К дашборду</Button>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <MonoLabel>{TYPE_LABEL[tournament.type]} · {LEVEL_LABEL[tournament.level]}</MonoLabel>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(32px, 4vw, 52px)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginTop: 8,
              }}
            >
              {tournament.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-500)' }}>
                {formatDateRange(tournament.dateStart, tournament.dateEnd)} · {tournament.city}
                {tournament.address ? ` · ${tournament.address}` : ''}
              </span>
              <StatusPill tournament={tournament} showPhase={isPublished} />
            </div>
          </div>
        </div>

        <div className={s.tabs}>
          {(['info', 'participants', 'bracket', 'schedule', 'results'] as Tab[]).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`${s.tabBtn} ${tab === id ? s.tabBtnActive : ''}`}
            >
              {id === 'info'
                ? 'Информация'
                : id === 'participants'
                  ? 'Участники'
                  : id === 'bracket'
                    ? 'Жеребьёвка'
                    : id === 'schedule'
                      ? 'Расписание'
                      : 'Результаты'}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 32 }}>
          {tab === 'info' && (
            <>
              <div
                style={{
                  padding: 24,
                  background: 'var(--paper-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                }}
              >
                <Stat label="Категории">{tournament.categories.length}</Stat>
                <Stat label="Раунды">{tournament.rounds} × {tournament.roundDuration} мин</Stat>
                <Stat label="Шлемы">{tournament.helmets ? 'Да' : 'Нет'}</Stat>
                <Stat label="Статус">{tournament.status}</Stat>
                <Stat label="Опубликован">
                  {tournament.publishedAt ? new Date(tournament.publishedAt).toLocaleDateString('ru-RU') : '—'}
                </Stat>
                <Stat label="Веса">{tournament.categories.map((c) => `${c}кг`).join(', ')}</Stat>
              </div>
              {actionError && (
                <div style={{ marginTop: 16, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                  {actionError}
                </div>
              )}
              <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {tournament.status !== 'cancelled' && (
                  <Button variant="secondary" onClick={() => setMode('edit')} disabled={actionPending}>
                    Редактировать
                  </Button>
                )}
                {isDraft && (
                  <Button onClick={() => runAction(() => tournamentsApi.publish(tournament.id))} disabled={actionPending}>
                    Опубликовать
                  </Button>
                )}
                {isPublished && (
                  <Button
                    variant="secondary"
                    onClick={() => runAction(() => tournamentsApi.cancel(tournament.id))}
                    disabled={actionPending}
                  >
                    Отменить турнир
                  </Button>
                )}
                {isDraft && (
                  <Button
                    variant="danger"
                    disabled={actionPending}
                    onClick={() =>
                      runAction(async () => {
                        if (!confirm('Удалить черновик безвозвратно?')) return;
                        await tournamentsApi.remove(tournament.id);
                        navigate('/dashboard', { replace: true });
                      })
                    }
                  >
                    Удалить черновик
                  </Button>
                )}
              </div>
            </>
          )}
          {tab === 'participants' && (
            <div className={s.tableWrapper}>
              <ApplicationsTable tournamentId={tournament.id} frozen={frozen} />
            </div>
          )}
          {tab === 'bracket' && tournament && bracket && (
            <div style={{ marginBottom: 16 }}>
              <PrintButton onClick={() => window.open(`/tournaments/${tournament.id}/print/bracket`, '_blank')}>
                Распечатать
              </PrintButton>
            </div>
          )}
          {tab === 'bracket' && tournament && (
            <BracketTab
              tournament={tournament}
              bracket={bracket}
              loading={bracketLoading}
              error={bracketError}
              onMatchClick={setActiveMatch}
              onAssignJudge={setAssignJudgeMatch}
              onGenerate={async () => {
                try {
                  const b = await matchesApi.generateBracket(tournament.id);
                  setBracket(b);
                  setTournament({ ...tournament, status: b.tournament.status });
                } catch (e) {
                  setBracketError(e instanceof ApiError ? e.message : 'Ошибка генерации');
                }
              }}
            />
          )}
          {tab === 'schedule' && tournament && bracket && bracket.categories.some((c) => c.matches.some((m) => m.scheduledAt !== null)) && (
            <div style={{ marginBottom: 16 }}>
              <PrintButton onClick={() => window.open(`/tournaments/${tournament.id}/print/schedule`, '_blank')}>
                Распечатать
              </PrintButton>
            </div>
          )}
          {tab === 'schedule' && tournament && bracket && (
            <ScheduleTab
              tournament={tournament}
              bracket={bracket}
              onMatchClick={setScheduleMatch}
              onGenerate={async () => {
                try {
                  const b = await matchesApi.generateSchedule(tournament.id);
                  setBracket(b);
                } catch (e) {
                  setBracketError(e instanceof ApiError ? e.message : 'Ошибка');
                }
              }}
              onClear={async () => {
                try {
                  const b = await matchesApi.clearSchedule(tournament.id);
                  setBracket(b);
                } catch (e) {
                  setBracketError(e instanceof ApiError ? e.message : 'Ошибка');
                }
              }}
            />
          )}
          {tab === 'schedule' && tournament && !bracket && (
            <div style={{ padding: 24, color: 'var(--ink-500)' }}>
              Сначала сгенерируйте сетку.
            </div>
          )}
          {tab === 'results' && results && (
            <>
              <div style={{ marginBottom: 16 }}>
                <PrintButton onClick={() => window.open(`/tournaments/${tournament.id}/print/results`, '_blank')}>
                  Распечатать
                </PrintButton>
              </div>
              <ResultsView results={results} />
            </>
          )}
          {activeMatch && tournament && (
            <MatchResultDialog
              match={activeMatch}
              tournamentRounds={tournament.rounds}
              onClose={() => setActiveMatch(null)}
              onResult={(b) => {
                setBracket(b);
                setTournament({ ...tournament, status: b.tournament.status });
                matchesApi.getPublicResults(tournament.id).then(setResults).catch(() => {});
              }}
            />
          )}
          {scheduleMatch && tournament && (
            <MatchScheduleDialog
              match={scheduleMatch}
              tournament={tournament}
              onClose={() => setScheduleMatch(null)}
              onResult={(b) => setBracket(b)}
            />
          )}
          {assignJudgeMatch && tournament && (
            <AssignJudgeDialog
              match={assignJudgeMatch}
              tournamentId={tournament.id}
              onClose={() => setAssignJudgeMatch(null)}
              onAssigned={() => {
                setAssignJudgeMatch(null);
                matchesApi
                  .getBracket(tournament.id)
                  .then(setBracket)
                  .catch((e) => setBracketError(e instanceof ApiError ? e.message : 'Ошибка'));
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <MonoLabel>{label}</MonoLabel>
    <div style={{ marginTop: 6, fontSize: 'var(--text-base)', fontWeight: 500 }}>{children}</div>
  </div>
);

const Centered = ({ text, action }: { text: string; action?: () => void }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <MonoLabel>{text}</MonoLabel>
    {action && <Button onClick={action}>На дашборд</Button>}
  </div>
);

const BracketTab = ({
  tournament, bracket, loading, error, onMatchClick, onAssignJudge, onGenerate,
}: {
  tournament: { id: string; status: string };
  bracket: Bracket | null;
  loading: boolean;
  error: string | null;
  onMatchClick: (m: BracketMatch) => void;
  onAssignJudge: (m: BracketMatch) => void;
  onGenerate: () => void;
}) => {
  const canGenerate = tournament.status === 'published';
  const canRegenerate =
    tournament.status === 'in_progress' &&
    bracket !== null &&
    bracket.categories
      .flatMap((c) => c.matches)
      .every(
        (m) =>
          m.status !== 'completed' ||
          (m.result?.outcome === 'wo' && (m.red === null || m.blue === null)),
      );

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>{error}</div>;

  if (!bracket) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ marginBottom: 16, color: 'var(--ink-500)' }}>
          Сетка ещё не сгенерирована. Сетка строится из одобренных заявок.
        </p>
        {canGenerate && <Button onClick={onGenerate}>Сгенерировать сетку</Button>}
        {!canGenerate && (
          <div style={{ color: 'var(--ink-500)' }}>
            Сначала опубликуйте турнир, чтобы сгенерировать сетку.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {canRegenerate && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-start' }}>
          <Button variant="ghost" onClick={onGenerate}>Перегенерировать сетку</Button>
        </div>
      )}
      <BracketView bracket={bracket} onMatchClick={onMatchClick} onAssignJudge={onAssignJudge} />
    </div>
  );
};

const ScheduleTab = ({
  tournament, bracket, onMatchClick, onGenerate, onClear,
}: {
  tournament: Tournament;
  bracket: Bracket;
  onMatchClick: (m: BracketMatch) => void;
  onGenerate: () => void;
  onClear: () => void;
}) => {
  const hasSchedule = bracket.categories.some((c) => c.matches.some((m) => m.scheduledAt !== null));
  const canMutate =
    tournament.status === 'in_progress' &&
    bracket.categories
      .flatMap((c) => c.matches)
      .every(
        (m) =>
          m.status !== 'completed' ||
          (m.result?.outcome === 'wo' && (m.red === null || m.blue === null)),
      );

  if (!hasSchedule) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ marginBottom: 16, color: 'var(--ink-500)' }}>
          Расписание ещё не построено. Алгоритм распределит матчи по дням, рингам и времени.
        </p>
        {canMutate && <Button onClick={onGenerate}>Авто-расставить</Button>}
        {!canMutate && (
          <div style={{ color: 'var(--ink-500)' }}>
            Турнир должен быть активным и без зафиксированных результатов.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {canMutate && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onGenerate}>Перерасставить</Button>
          <Button variant="ghost" onClick={onClear}>Очистить расписание</Button>
        </div>
      )}
      <ScheduleView bracket={bracket} tournament={tournament} onMatchClick={onMatchClick} />
    </div>
  );
};

const PrintButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        padding: '0 16px',
        background: hovered ? 'var(--ink-900)' : 'transparent',
        color: hovered ? 'var(--paper-100)' : 'var(--ink-700)',
        border: `1px solid ${hovered ? 'var(--ink-900)' : 'var(--ink-300)'}`,
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <Icon name="printer" size={15} />
      {children}
    </button>
  );
};
