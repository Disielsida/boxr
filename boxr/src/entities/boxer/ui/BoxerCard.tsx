import { useState } from 'react';

import { MonoLabel, Pill } from '@/shared/ui';

import { GENDER_LABEL, RANK_LABEL, computeAge } from '../model/types';

import type { Boxer } from '@/shared/types';

interface BoxerCardProps {
  boxer: Boxer;
  onClick?: () => void;
}

export const BoxerCard = ({ boxer, onClick }: BoxerCardProps) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--paper-100)',
        border: `1px solid ${hover ? 'var(--ink-900)' : 'var(--paper-300)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color var(--duration-fast) var(--ease-out-quart)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <MonoLabel>{GENDER_LABEL[boxer.gender]} · {computeAge(boxer.dob)} лет</MonoLabel>
        <Pill variant="default">{RANK_LABEL[boxer.rank]}</Pill>
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        {boxer.fullName}
      </h3>
      <div style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
        {boxer.weight} кг{boxer.club ? ` · ${boxer.club}` : ''}
      </div>
    </button>
  );
};
