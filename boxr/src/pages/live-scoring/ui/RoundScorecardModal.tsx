import { useState } from 'react';
import type { LiveScoringAction, LiveScoringState, ReducerParams } from '../model/types';

interface Props {
  state: LiveScoringState;
  params: ReducerParams;
  dispatch: (a: LiveScoringAction) => void;
  redName: string;
  blueName: string;
}

const SCORE_OPTIONS = [10, 9, 8, 7] as const;
type ScoreOption = (typeof SCORE_OPTIONS)[number];

export const RoundScorecardModal = ({ state, params, dispatch, redName, blueName }: Props) => {
  const [redScore, setRedScore] = useState<ScoreOption>(
    Math.max(params.minScore, Math.min(params.startScore, state.redScore)) as ScoreOption,
  );
  const [blueScore, setBlueScore] = useState<ScoreOption>(
    Math.max(params.minScore, Math.min(params.startScore, state.blueScore)) as ScoreOption,
  );

  const commit = () => {
    dispatch({ type: 'COMMIT_ROUND_SCORE', red: redScore, blue: blueScore });
  };

  const scoreBtn = (
    value: ScoreOption,
    selected: ScoreOption,
    onSelect: (v: ScoreOption) => void,
    color: string,
  ) => (
    <button
      key={value}
      type="button"
      onClick={() => onSelect(value)}
      style={{
        width: 52,
        height: 52,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${selected === value ? color : 'rgba(242,238,229,0.15)'}`,
        background: selected === value ? `${color}33` : 'transparent',
        color: selected === value ? color : 'rgba(242,238,229,0.6)',
        fontFamily: 'var(--font-mono)',
        fontSize: 18,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {value}
    </button>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 600,
        background: 'rgba(10,10,10,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--ink-dark-surface)',
          border: '1px solid rgba(242,238,229,0.12)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '28px 24px',
          maxWidth: 600,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.15em',
              color: 'rgba(242,238,229,0.4)',
              marginBottom: 6,
            }}
          >
            ОЦЕНКА РАУНДА
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Раунд {state.round}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
          {/* Красный угол */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: 'var(--ring-600)',
              }}
            >
              ● КРАСНЫЙ
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'rgba(242,238,229,0.6)',
                textAlign: 'center',
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {redName}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SCORE_OPTIONS.map((v) => scoreBtn(v, redScore, setRedScore, 'var(--ring-600)'))}
            </div>
          </div>

          <div
            style={{
              width: 1,
              background: 'rgba(242,238,229,0.08)',
              alignSelf: 'stretch',
            }}
          />

          {/* Синий угол */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: '#3b82f6',
              }}
            >
              ● СИНИЙ
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'rgba(242,238,229,0.6)',
                textAlign: 'center',
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {blueName}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {SCORE_OPTIONS.map((v) => scoreBtn(v, blueScore, setBlueScore, '#3b82f6'))}
            </div>
          </div>
        </div>

        {redScore === blueScore && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'rgba(242,238,229,0.5)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ⚠ Счёт равный — в IBA один боксёр всегда получает 10
          </div>
        )}

        <button
          type="button"
          onClick={commit}
          style={{
            padding: '14px 28px',
            background: 'var(--ring-600)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.08em',
            alignSelf: 'stretch',
          }}
        >
          ПОДТВЕРДИТЬ ОЦЕНКУ РАУНДА {state.round}
        </button>
      </div>
    </div>
  );
};
