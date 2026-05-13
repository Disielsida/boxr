import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { MonoLabel } from '@/shared/ui';

import type { Bracket, BracketMatch, Tournament } from '@/shared/types';

interface Props {
  bracket: Bracket;
  tournament?: Tournament;
  readOnly?: boolean;
  onMatchClick?: (match: BracketMatch) => void;
}

interface FlatMatch {
  match: BracketMatch;
  category: number;
  bout: number;
}

export const ScheduleView = ({ bracket, readOnly, onMatchClick }: Props) => {
  const flat = useMemo<FlatMatch[]>(() => {
    const arr: { match: BracketMatch; category: number }[] = [];
    for (const cat of bracket.categories) {
      for (const m of cat.matches) {
        if (m.scheduledAt !== null) arr.push({ match: m, category: cat.weight });
      }
    }
    arr.sort((a, b) =>
      a.match.scheduledAt!.localeCompare(b.match.scheduledAt!) ||
      (a.match.ring ?? 0) - (b.match.ring ?? 0),
    );
    return arr.map((x, i) => ({ ...x, bout: i + 1 }));
  }, [bracket]);

  const days = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const f of flat) set.add(f.match.scheduledAt!.slice(0, 10));
    return [...set].sort();
  }, [flat]);

  const [activeDay, setActiveDay] = useState<string | null>(null);
  const day = activeDay ?? days[0] ?? null;

  if (flat.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
        Расписание ещё не сгенерировано.
      </div>
    );
  }

  const dayMatches = day ? flat.filter((f) => f.match.scheduledAt!.startsWith(day)) : [];

  const formatTime = (iso: string): string => iso.slice(11, 16);
  const formatDay = (iso: string): string => {
    const d = new Date(iso + 'T00:00:00.000Z');
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--paper-300)' }}>
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDay(d)}
            style={{
              padding: '10px 24px',
              background: 'none',
              border: 'none',
              borderBottom: d === day ? '2px solid var(--ink-900)' : '2px solid transparent',
              color: d === day ? 'var(--ink-900)' : 'var(--ink-500)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              marginBottom: -1,
              letterSpacing: '0.04em',
            }}
          >
            {formatDay(d)}
          </button>
        ))}
      </div>
      <div>
        {dayMatches.map(({ match, category, bout }) => {
          const clickable = !readOnly && onMatchClick && match.status !== 'completed';
          return (
            <div
              key={match.id}
              onClick={clickable ? () => onMatchClick(match) : undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 80px 100px 1fr 30px 1fr 100px 60px',
                alignItems: 'center',
                gap: 16,
                padding: '14px 0',
                borderBottom: '1px solid var(--paper-300)',
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)' }}>
                {formatTime(match.scheduledAt!)}
              </div>
              <MonoLabel>Бой {bout}</MonoLabel>
              <MonoLabel>Ринг {match.ring}</MonoLabel>
              <div style={{ textAlign: 'right', fontWeight: 500 }}>
                {match.red?.fullName ?? <em style={{ color: 'var(--ink-300)' }}>—</em>}
              </div>
              <div style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--ink-300)' }}>vs</div>
              <div style={{ fontWeight: 500 }}>
                {match.blue?.fullName ?? <em style={{ color: 'var(--ink-300)' }}>—</em>}
              </div>
              <MonoLabel>{category} кг</MonoLabel>
              {!readOnly && match.status === 'ready' ? (
                <Link
                  to={`/scoring/${match.id}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                    background: 'var(--ring-600)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                  }}
                >
                  LIVE
                </Link>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
