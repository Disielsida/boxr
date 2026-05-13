// boxr/src/widgets/bracket-view/ui/MatchCard.tsx
import { Link } from 'react-router-dom';

import type { BracketMatch } from '@/shared/types';

interface Props {
  match: BracketMatch;
  onClick?: (match: BracketMatch) => void;
  onAssignJudge?: (match: BracketMatch) => void;
}

const outcomeLabel: Record<string, string> = {
  ko: 'KO', wp: 'WP', rsc: 'RSC', dsq: 'DSQ', wo: 'WO',
};

export const MatchCard = ({ match, onClick, onAssignJudge }: Props) => {
  const clickable = match.status === 'ready' && onClick !== undefined;
  const showLive = match.status === 'ready' && onClick !== undefined;
  const winnerSlot =
    match.result?.winnerId === match.red?.boxerId
      ? 'red'
      : match.result?.winnerId === match.blue?.boxerId
        ? 'blue'
        : null;

  const slotStyle = (isWinner: boolean) => ({
    padding: '8px 12px',
    fontSize: 'var(--text-sm)',
    fontWeight: isWinner ? 600 : 500,
    opacity: match.result && !isWinner ? 0.5 : 1,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={clickable ? () => onClick(match) : undefined}
        disabled={!clickable}
        style={{
          all: 'unset',
          display: 'block',
          width: '100%',
          border: '1px solid var(--paper-300)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          cursor: clickable ? 'pointer' : 'default',
          background: 'var(--paper-100)',
        }}
      >
        <div
          style={{
            ...slotStyle(winnerSlot === 'red'),
            background: 'rgba(178,58,47,0.05)',
            borderBottom: '1px solid var(--paper-300)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          <span style={{ flexShrink: 0, fontSize: 12, lineHeight: 1 }}>🔴</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {match.red?.fullName ?? <em style={{ color: 'var(--ink-300)' }}>BYE</em>}
          </span>
        </div>
        <div style={{ ...slotStyle(winnerSlot === 'blue'), display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ flexShrink: 0, fontSize: 12, lineHeight: 1 }}>🔵</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {match.blue?.fullName ?? <em style={{ color: 'var(--ink-300)' }}>BYE</em>}
          </span>
        </div>
        {match.result && (
          <div
            style={{
              padding: '4px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-500)',
              borderTop: '1px solid var(--paper-300)',
              background: 'var(--paper-200)',
            }}
          >
            {outcomeLabel[match.result.outcome]}
            {match.result.endRound ? ` · Р${match.result.endRound}` : ''}
          </div>
        )}
      </button>
      {showLive && (
        <Link
          to={`/scoring/${match.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            background: 'var(--ring-600)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
          }}
        >
          LIVE →
        </Link>
      )}
      {onAssignJudge && match.status !== 'completed' && (
        <button
          type="button"
          onClick={() => onAssignJudge(match)}
          style={{
            all: 'unset',
            display: 'inline-block',
            padding: '4px 10px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            background: 'transparent',
            color: 'var(--ink-500)',
            border: '1px solid var(--paper-300)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            textAlign: 'center',
            marginTop: 2,
          }}
        >
          {match.judgeId ? '✓ Судья' : 'Назначить судью'}
        </button>
      )}
    </div>
  );
};
