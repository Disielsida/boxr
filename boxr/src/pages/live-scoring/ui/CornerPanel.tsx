import { RANK_LABEL } from '@/entities/boxer';

import type { Corner } from '../model/types';
import type { MatchForScoringBoxer } from '@/shared/types';

interface Props {
  side: Corner;
  boxer: MatchForScoringBoxer | null;
  score: number;
  startScore: number;
}

const COLORS = {
  red:  { stripe: 'rgba(178,58,47,0.6)', label: 'var(--ring-600)', mark: '●' },
  blue: { stripe: 'rgba(59,130,246,0.6)', label: '#3b82f6',          mark: '●' },
};

export const CornerPanel = ({ side, boxer, score, startScore }: Props) => {
  const c = COLORS[side];
  const align = side === 'red' ? 'flex-start' : 'flex-end';
  const textAlign = side === 'red' ? ('left' as const) : ('right' as const);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 32px',
        alignItems: align,
        ...(side === 'red'
          ? { borderRight: `4px solid ${c.stripe}` }
          : { borderLeft: `4px solid ${c.stripe}` }),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: c.label,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.15em',
          marginBottom: 8,
        }}
      >
        {side === 'red' ? (
          <>
            <span style={{ lineHeight: 1, fontSize: 10 }}>{c.mark}</span>
            <span>КРАСНЫЙ УГОЛ</span>
          </>
        ) : (
          <>
            <span>СИНИЙ УГОЛ</span>
            <span style={{ lineHeight: 1, fontSize: 10 }}>{c.mark}</span>
          </>
        )}
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 3.5vw, 52px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: 6,
          textAlign,
        }}
      >
        {boxer?.fullName ?? '—'}
      </h2>
      <div
        style={{
          color: 'rgba(242,238,229,0.4)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          marginBottom: 32,
          textAlign,
        }}
      >
        {boxer ? `${boxer.club ?? '—'} · ${RANK_LABEL[boxer.rank]}` : '—'}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(80px, 12vw, 160px)',
          fontWeight: 300,
          lineHeight: 1,
          color: score < startScore ? 'var(--ring-600)' : 'var(--ink-dark-text)',
          letterSpacing: '-0.04em',
          textAlign,
        }}
      >
        {score}
      </div>
    </div>
  );
};
