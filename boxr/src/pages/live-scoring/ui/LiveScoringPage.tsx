import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuthContext } from '@/app/providers';
import { matchesApi, ApiError } from '@/shared/api';

import { CenterControls } from './CenterControls';
import { CornerPanel } from './CornerPanel';
import { EndFightPanel } from './EndFightPanel';
import { EventActionsPanel } from './EventActionsPanel';
import s from './LiveScoringPage.module.css';
import { RoundScorecardModal } from './RoundScorecardModal';
import { DEFAULT_PARAMS } from '../model/types';
import { useLiveScoring, clearStorage } from '../model/use-live-scoring';

import type { MatchForScoring } from '@/shared/types';

export const LiveScoringPage = () => {
  const { matchId = '' } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [match, setMatch] = useState<MatchForScoring | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    matchesApi
      .getMatchForScoring(matchId)
      .then(setMatch)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  }, [matchId]);

  if (error) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--ink-dark-bg)',
          color: 'var(--ink-dark-text)',
          gap: 16,
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{error}</h1>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 24px',
            background: 'rgba(242,238,229,0.1)',
            border: '1px solid rgba(242,238,229,0.2)',
            color: 'var(--ink-dark-text)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          ← НАЗАД
        </button>
      </div>
    );
  }
  if (!match) return null;

  return (
    <ActiveLiveScoring
      match={match}
      onFinished={(tournamentId) => {
        clearStorage(matchId);
        if (user?.role === 'judge') {
          navigate('/judge');
        } else {
          navigate(`/tournaments/${tournamentId}`);
        }
      }}
    />
  );
};

interface ActiveProps {
  match: MatchForScoring;
  onFinished: (tournamentId: string) => void;
}

const ActiveLiveScoring = ({ match, onFinished }: ActiveProps) => {
  const params = {
    rounds: match.tournament.rounds,
    roundDurationSec: match.tournament.roundDuration * 60,
    ...DEFAULT_PARAMS,
  };
  const { state, dispatch } = useLiveScoring(match.match.id, params);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ink-dark-bg)',
        color: 'var(--ink-dark-text)',
        fontFamily: 'var(--font-body)',
        overflow: 'hidden',
      }}
    >
      <div className={s.landscapeHint}>
        <div className={s.hintIcon}>📱</div>
        <div className={s.hintText}>
          Поверни устройство<br />для удобного<br />судейства
        </div>
      </div>

      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid rgba(242,238,229,0.08)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(242,238,229,0.4)',
            letterSpacing: '0.1em',
          }}
        >
          {match.tournament.name.toUpperCase()}{match.match.ring ? ` · РИНГ ${match.match.ring}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: match.tournament.rounds }, (_, i) => i + 1).map((r) => (
            <div
              key={r}
              style={{
                width: 32,
                height: 6,
                borderRadius: 3,
                background:
                  r < state.round
                    ? 'var(--ring-600)'
                    : r === state.round
                      ? state.isRunning
                        ? 'var(--ring-600)'
                        : 'rgba(178,58,47,0.4)'
                      : 'rgba(242,238,229,0.08)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(242,238,229,0.4)',
            letterSpacing: '0.1em',
          }}
        >
          БОЙ {match.match.position + 1} · РАУНД {state.round}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <CornerPanel side="red"  boxer={match.match.red}  score={state.redScore}  startScore={params.startScore} />
        <CenterControls state={state} dispatch={dispatch} totalRounds={params.rounds} />
        <CornerPanel side="blue" boxer={match.match.blue} score={state.blueScore} startScore={params.startScore} />
      </div>

      {state.fightState === 'ended' ? (
        <EndFightPanel state={state} match={match} onFinished={onFinished} />
      ) : (
        <EventActionsPanel
          events={state.events}
          dispatch={dispatch}
          disabled={state.fightState === 'prefight' || state.fightState === 'scoring'}
        />
      )}
      {state.fightState === 'scoring' && (
        <RoundScorecardModal
          state={state}
          params={params}
          dispatch={dispatch}
          redName={match.match.red?.fullName ?? '—'}
          blueName={match.match.blue?.fullName ?? '—'}
        />
      )}
    </div>
  );
};
