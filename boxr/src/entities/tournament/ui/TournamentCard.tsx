import { useState } from 'react';

import { MonoLabel } from '@/shared/ui';

import { StatusPill } from './StatusPill';
import { TYPE_LABEL, formatDateRange } from '../model/types';

import type { Tournament } from '@/shared/types';

interface TournamentCardProps {
  tournament: Tournament;
  showPhase?: boolean;
  onClick?: () => void;
}

export const TournamentCard = ({ tournament, showPhase, onClick }: TournamentCardProps) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--paper-100)',
        border: `1px solid ${hover ? 'var(--ink-900)' : 'var(--paper-300)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'border-color var(--duration-fast) var(--ease-out-quart), transform var(--duration-fast) var(--ease-out-quart)',
        transform: hover && onClick ? 'translateY(-2px)' : 'translateY(0)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <MonoLabel>{TYPE_LABEL[tournament.type]}</MonoLabel>
        <StatusPill tournament={tournament} showPhase={showPhase} />
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(20px, 2vw, 26px)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: 'var(--ink-900)',
          margin: 0,
        }}
      >
        {tournament.name}
      </h3>
      <div
        style={{
          color: 'var(--ink-500)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
        }}
      >
        {formatDateRange(tournament.dateStart, tournament.dateEnd)} · {tournament.city}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--ink-500)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span>{tournament.categories.length} КАТЕГОРИЙ</span>
        <span>{tournament.rounds} × {tournament.roundDuration} МИН</span>
        {tournament.helmets && <span>ШЛЕМЫ</span>}
      </div>
    </button>
  );
};
