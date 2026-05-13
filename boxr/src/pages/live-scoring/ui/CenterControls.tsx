import type { LiveScoringState, LiveScoringAction } from '../model/types';

interface Props {
  state: LiveScoringState;
  dispatch: (a: LiveScoringAction) => void;
  totalRounds: number;
}

const formatTime = (s: number): string => {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
};

export const CenterControls = ({ state, dispatch, totalRounds }: Props) => (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'var(--ink-dark-surface)',
        borderLeft: '1px solid rgba(242,238,229,0.08)',
        borderRight: '1px solid rgba(242,238,229,0.08)',
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(40px,6vw,72px)',
          fontWeight: 300,
          color: state.time < 30 ? 'var(--ring-600)' : 'var(--ink-dark-text)',
          letterSpacing: '-0.02em',
          transition: 'color 0.5s',
        }}
      >
        {formatTime(state.time)}
      </div>

      {state.fightState === 'prefight' && (
        <button
          onClick={() => dispatch({ type: 'START_FIGHT' })}
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'var(--ring-600)',
            border: 'none',
            cursor: 'pointer',
            color: 'white',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            letterSpacing: '0.08em',
          }}
        >
          СТАРТ
        </button>
      )}

      {state.fightState === 'active' && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_TIMER' })}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: state.isRunning ? 'rgba(242,238,229,0.1)' : 'var(--ring-600)',
            border: '1px solid rgba(242,238,229,0.08)',
            cursor: 'pointer',
            color: 'var(--ink-dark-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          {state.isRunning ? 'ПАУЗА' : 'СТАРТ'}
        </button>
      )}

      {state.fightState === 'break' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              color: 'rgba(242,238,229,0.4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}
          >
            ПЕРЕРЫВ
          </div>
          <button
            onClick={() => dispatch({ type: 'START_ROUND' })}
            style={{
              padding: '12px 24px',
              background: 'var(--ring-600)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            СЛЕД. РАУНД
          </button>
        </div>
      )}

      {state.fightState === 'ended' && (
        <div
          style={{
            color: 'rgba(242,238,229,0.4)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
          }}
        >
          БОЙ ОКОНЧЕН
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'rgba(242,238,229,0.4)',
          letterSpacing: '0.08em',
        }}
      >
        РАУНД {state.round} / {totalRounds}
      </div>
    </div>
  );
