// boxr/src/widgets/bracket-view/ui/BracketView.tsx
import { useState } from 'react';

import { MonoLabel } from '@/shared/ui';
import { roundLabel } from '@/shared/lib/roundLabel';

import { MatchCard } from './MatchCard';

import type { Bracket, BracketMatch } from '@/shared/types';

interface Props {
  bracket: Bracket;
  readOnly?: boolean;
  onMatchClick?: (match: BracketMatch) => void;
  onAssignJudge?: (match: BracketMatch) => void;
}

export const BracketView = ({ bracket, readOnly, onMatchClick, onAssignJudge }: Props) => {
  const [idx, setIdx] = useState(0);

  if (bracket.categories.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
        Сетка пуста — нет одобренных участников ни в одной категории.
      </div>
    );
  }

  const cats = bracket.categories;
  const total = cats.length;
  const cat = cats[idx];

  return (
    <div>
      {/* Navigator */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            style={{
              width: 36, height: 36,
              background: 'none',
              border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-sm)',
              cursor: idx === 0 ? 'not-allowed' : 'pointer',
              opacity: idx === 0 ? 0.3 : 1,
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s',
            }}
          >
            ←
          </button>

          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 500 }}>
              {cat.weight} кг
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-400)', marginLeft: 10 }}>
              {idx + 1} / {total}
            </span>
          </div>

          <button
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            style={{
              width: 36, height: 36,
              background: 'none',
              border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-sm)',
              cursor: idx === total - 1 ? 'not-allowed' : 'pointer',
              opacity: idx === total - 1 ? 0.3 : 1,
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s',
            }}
          >
            →
          </button>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cats.map((c, i) => (
            <button
              key={c.weight}
              onClick={() => setIdx(i)}
              style={{
                height: 28, padding: '0 12px',
                background: i === idx ? 'var(--ink-900)' : 'transparent',
                color: i === idx ? 'var(--paper-100)' : 'var(--ink-500)',
                border: `1px solid ${i === idx ? 'var(--ink-900)' : 'var(--paper-300)'}`,
                borderRadius: 999,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              }}
            >
              {c.weight} кг
            </button>
          ))}
        </div>
      </div>

      {/* Bracket for selected category */}
      <div
        style={{
          border: '1px solid var(--paper-300)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: 'var(--paper-200)',
            borderBottom: '1px solid var(--paper-300)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)' }}>
              {cat.weight} кг
            </span>
          </div>
          <MonoLabel>
            {cat.matches.filter((m) => m.round === 1).length} матчей в 1-м раунде
          </MonoLabel>
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 16, overflowX: 'auto' }}>
          {Array.from({ length: cat.rounds }, (_, i) => i + 1).map((round) => {
            const matchesInRound = cat.matches
              .filter((m) => m.round === round)
              .sort((a, b) => {
                const pa = a.red !== null && a.blue !== null ? 0 : 1;
                const pb = b.red !== null && b.blue !== null ? 0 : 1;
                if (pa !== pb) return pa - pb;
                return a.position - b.position;
              });
            return (
              <div
                key={round}
                style={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <MonoLabel style={{ textAlign: 'center' }}>{roundLabel(round, cat.rounds)}</MonoLabel>
                {matchesInRound.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    onClick={readOnly ? undefined : onMatchClick}
                    onAssignJudge={readOnly ? undefined : onAssignJudge}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
