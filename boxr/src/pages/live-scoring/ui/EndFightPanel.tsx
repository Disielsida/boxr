import { useEffect, useState } from 'react';

import { matchesApi, ApiError } from '@/shared/api';

import type { LiveScoringState } from '../model/types';
import type { MatchForScoring, MatchOutcome } from '@/shared/types';

interface Props {
  state: LiveScoringState;
  match: MatchForScoring;
  onFinished: (tournamentId: string) => void;
}

const OUTCOMES: Array<{ value: MatchOutcome; label: string }> = [
  { value: 'wp',  label: 'WP — по очкам' },
  { value: 'ko',  label: 'KO — нокаут' },
  { value: 'rsc', label: 'RSC — рефери остановил' },
  { value: 'dsq', label: 'DSQ — дисквалификация' },
  { value: 'wo',  label: 'WO — неявка / отказ' },
];

const EDIT_WINDOW_SEC = 600;
const requiresEndRound = (o: MatchOutcome) => o === 'ko' || o === 'rsc';

function calcTotals(roundScores: import('../model/types').RoundScore[]) {
  return roundScores.reduce(
    (acc, r) => ({ red: acc.red + r.red, blue: acc.blue + r.blue }),
    { red: 0, blue: 0 },
  );
}

export const EndFightPanel = ({ state, match, onFinished }: Props) => {
  const totals = calcTotals(state.roundScores);
  const stopEvent = state.events.find((e) => e.type === 'stop');
  const stoppedByEvent = !!stopEvent;
  const [outcome, setOutcome] = useState<MatchOutcome>(stoppedByEvent ? 'rsc' : 'wp');
  const [winner, setWinner] = useState<'red' | 'blue'>(() => {
    if (stopEvent) {
      // stopped corner loses → opposite corner wins
      return stopEvent.corner === 'red' ? 'blue' : 'red';
    }
    return state.roundScores.length > 0
      ? totals.red >= totals.blue ? 'red' : 'blue'
      : state.redScore >= state.blueScore ? 'red' : 'blue';
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!submittedAt) return;
    const tick = () => {
      const elapsed = (Date.now() - submittedAt) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(EDIT_WINDOW_SEC - elapsed)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [submittedAt]);

  const tied = outcome === 'wp' && (
    state.roundScores.length > 0
      ? totals.red === totals.blue
      : state.redScore === state.blueScore
  );

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await matchesApi.setResult(match.match.id, {
        winner,
        outcome,
        ...(requiresEndRound(outcome) ? { endRound: state.round } : {}),
      });
      setSubmittedAt(Date.now());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    } finally {
      setSubmitting(false);
    }
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const winnerName = winner === 'red'
    ? (match.match.red?.fullName ?? '—')
    : (match.match.blue?.fullName ?? '—');
  const outcomeLabel = OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome;

  const cornerBtn = (side: 'red' | 'blue', name: string) => (
    <button
      key={side}
      type="button"
      onClick={() => setWinner(side)}
      disabled={submitting}
      style={{
        flex: 1,
        padding: '14px 16px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${winner === side
          ? (side === 'red' ? 'var(--ring-600)' : '#3b82f6')
          : 'rgba(242,238,229,0.15)'}`,
        background:
          winner === side
            ? side === 'red'
              ? 'rgba(178,58,47,0.25)'
              : 'rgba(59,130,246,0.20)'
            : 'transparent',
        color: 'var(--ink-dark-text)',
        cursor: submitting ? 'not-allowed' : 'pointer',
        fontWeight: 600,
      }}
    >
      {side === 'red' ? '🔴' : '🔵'} {name}
    </button>
  );

  const panelStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 500,
    flexShrink: 0,
    borderTop: '1px solid rgba(242,238,229,0.08)',
    background: 'var(--ink-dark-surface)',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };
  const anchorProps = { 'data-bottom-anchor': true } as React.HTMLAttributes<HTMLDivElement>;

  if (submittedAt !== null) {
    return (
      <div {...anchorProps} style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>✓</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.1em',
              color: '#4ade80',
            }}
          >
            РЕЗУЛЬТАТ ЗАФИКСИРОВАН
          </span>
        </div>

        <div
          style={{
            background: 'rgba(242,238,229,0.04)',
            border: '1px solid rgba(242,238,229,0.10)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ color: winner === 'red' ? 'var(--ring-600)' : '#3b82f6', fontWeight: 700 }}>
            {winner === 'red' ? '🔴' : '🔵'} {winnerName}
          </div>
          <div style={{ color: 'rgba(242,238,229,0.5)', fontSize: 12 }}>{outcomeLabel}</div>
          {state.roundScores.length > 0 && (
            <div style={{ color: 'rgba(242,238,229,0.4)', fontSize: 11, marginTop: 4 }}>
              Итого очков: {totals.red} : {totals.blue}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {secondsLeft > 0 && (
            <button
              type="button"
              onClick={() => setSubmittedAt(null)}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid rgba(242,238,229,0.25)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--ink-dark-text)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
              }}
            >
              ИЗМЕНИТЬ РЕЗУЛЬТАТ ({mins}:{secs})
            </button>
          )}
          <button
            type="button"
            onClick={() => onFinished(match.tournament.id)}
            style={{
              marginLeft: 'auto',
              padding: '12px 28px',
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
            К ДАШБОРДУ →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            color: 'var(--ink-dark-text)',
            minWidth: 220,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(242,238,229,0.4)' }}>
            ИСХОД
          </span>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as MatchOutcome)}
            disabled={submitting}
            style={{
              padding: 8,
              background: 'rgba(242,238,229,0.05)',
              border: '1px solid rgba(242,238,229,0.15)',
              color: 'var(--ink-dark-text)',
            }}
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value} style={{ color: '#000' }}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 240 }}>
          {cornerBtn('red',  match.match.red?.fullName  ?? '—')}
          {cornerBtn('blue', match.match.blue?.fullName ?? '—')}
        </div>
      </div>

      {state.roundScores.length > 0 && (
        <div
          style={{
            background: 'rgba(242,238,229,0.03)',
            border: '1px solid rgba(242,238,229,0.08)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'rgba(242,238,229,0.4)',
              marginBottom: 4,
            }}
          >
            ПРОТОКОЛ РАУНДОВ
          </div>
          {state.roundScores.map((rs) => (
            <div
              key={rs.round}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'rgba(242,238,229,0.4)', minWidth: 64 }}>Раунд {rs.round}</span>
              <span
                style={{
                  color: rs.red > rs.blue ? 'var(--ring-600)' : 'rgba(242,238,229,0.6)',
                  fontWeight: rs.red > rs.blue ? 700 : 400,
                }}
              >
                {rs.red}
              </span>
              <span style={{ color: 'rgba(242,238,229,0.2)', margin: '0 8px' }}>:</span>
              <span
                style={{
                  color: rs.blue > rs.red ? '#3b82f6' : 'rgba(242,238,229,0.6)',
                  fontWeight: rs.blue > rs.red ? 700 : 400,
                }}
              >
                {rs.blue}
              </span>
            </div>
          ))}
          <div
            style={{
              borderTop: '1px solid rgba(242,238,229,0.08)',
              paddingTop: 8,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span style={{ color: 'rgba(242,238,229,0.4)' }}>ИТОГО</span>
            <span style={{ color: totals.red > totals.blue ? 'var(--ring-600)' : 'rgba(242,238,229,0.8)' }}>
              {totals.red}
            </span>
            <span style={{ color: 'rgba(242,238,229,0.2)', margin: '0 8px' }}>:</span>
            <span style={{ color: totals.blue > totals.red ? '#3b82f6' : 'rgba(242,238,229,0.8)' }}>
              {totals.blue}
            </span>
          </div>
        </div>
      )}

      {tied && (
        <div style={{ color: 'var(--warning)', fontSize: 13 }}>
          ⚠️ Очки равны — выберите победителя вручную
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          style={{
            padding: '12px 28px',
            background: 'var(--ring-600)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'white',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.08em',
          }}
        >
          {submitting ? 'СОХРАНЯЕМ…' : 'УТВЕРДИТЬ РЕЗУЛЬТАТ'}
        </button>
      </div>
    </div>
  );
};
