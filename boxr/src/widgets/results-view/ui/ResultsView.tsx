import { MonoLabel } from '@/shared/ui';

import type { Results } from '@/shared/types';

interface Props {
  results: Results;
}

const outcomeLabel: Record<string, string> = {
  ko: 'KO',
  wp: 'WP',
  rsc: 'RSC',
  dsq: 'DSQ',
  wo: 'WO',
};

export const ResultsView = ({ results }: Props) => {
  if (results.categories.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
        Результатов пока нет.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {results.categories.map((cat) => (
        <div
          key={cat.weight}
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
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)' }}>
              {cat.weight} кг
            </span>
            <MonoLabel>{cat.finished ? 'ЗАВЕРШЕНА' : 'В ХОДЕ'}</MonoLabel>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {(['gold', 'silver'] as const).map((place, i) => {
                const p = cat.podium[place];
                return (
                  <div
                    key={place}
                    style={{
                      flex: 1,
                      padding: 14,
                      background: i === 0 ? 'var(--ink-900)' : 'var(--paper-200)',
                      color: i === 0 ? 'var(--paper-100)' : 'var(--ink-900)',
                      border: '1px solid var(--paper-300)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 28,
                        fontWeight: 300,
                        opacity: 0.4,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                      {p ? `${p.fullName}${p.club ? ` (${p.club})` : ''}` : '—'}
                    </div>
                  </div>
                );
              })}
              {cat.podium.bronze.map((b, i) => (
                <div
                  key={`bronze-${i}`}
                  style={{
                    flex: 1,
                    padding: 14,
                    background: 'var(--paper-200)',
                    border: '1px solid var(--paper-300)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 28,
                      fontWeight: 300,
                      opacity: 0.4,
                    }}
                  >
                    3
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    {b.fullName}
                    {b.club ? ` (${b.club})` : ''}
                  </div>
                </div>
              ))}
            </div>

            {cat.finals.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {cat.finals.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 16,
                      padding: '10px 0',
                      borderTop: '1px solid var(--paper-300)',
                      alignItems: 'center',
                    }}
                  >
                    <MonoLabel style={{ minWidth: 90 }}>
                      {f.round === Math.max(...cat.finals.map((x) => x.round)) ? 'Финал' : '1/2'}
                    </MonoLabel>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {f.winner.fullName}
                    </span>
                    <span style={{ color: 'var(--ink-300)' }}>def.</span>
                    <span style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>
                      {f.loser.fullName}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      {outcomeLabel[f.outcome]}
                      {f.endRound ? ` · Р${f.endRound}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
