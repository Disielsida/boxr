import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { matchesApi, tournamentsApi } from '@/shared/api';
import { PrintDocument } from '@/shared/ui';

import type { CategoryResults, Results, Tournament } from '@/shared/types';

const OUTCOME_LABEL: Record<string, string> = {
  ko: 'KO', wp: 'WP', rsc: 'RSC', dsq: 'DSQ', wo: 'WO',
};

function renderCategory(cat: CategoryResults) {
  const { podium, finals } = cat;
  const maxRound = finals.length > 0 ? Math.max(...finals.map((f) => f.round)) : 0;

  const podiumCards: { place: number; name: string | null; club: string | null }[] = [
    { place: 1, name: podium.gold?.fullName ?? null, club: podium.gold?.club ?? null },
    { place: 2, name: podium.silver?.fullName ?? null, club: podium.silver?.club ?? null },
    ...podium.bronze.map((b) => ({ place: 3, name: b.fullName, club: b.club })),
  ];

  return (
    <div key={cat.weight} style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        color: '#888', marginBottom: 8, paddingBottom: 4,
        borderBottom: '1px solid #eee',
      }}>
        {cat.weight} КГ {!cat.finished && <span style={{ fontWeight: 400 }}>(в ходе)</span>}
      </div>

      {/* Podium */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {podiumCards.map((p, i) => (
          <div key={i} style={{
            flex: 1, padding: '8px 10px', borderRadius: 3,
            background: p.place === 1 ? '#1a1a1a' : '#f5f4f0',
            color: p.place === 1 ? 'white' : '#111',
            border: p.place !== 1 ? '1px solid #ddd' : 'none',
          }}>
            <div style={{ fontSize: 18, fontWeight: 300, opacity: 0.3 }}>{p.place}</div>
            <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>
              {p.name ?? '—'}
            </div>
            {p.club && (
              <div style={{ fontSize: 8, opacity: 0.5, marginTop: 1 }}>{p.club}</div>
            )}
          </div>
        ))}
      </div>

      {/* Finals table */}
      {finals.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#f5f4f0' }}>
              {['РАУНД', 'ПОБЕДИТЕЛЬ', 'ПРОИГРАВШИЙ', 'ИСХОД'].map((h) => (
                <th key={h} style={{
                  padding: '4px 6px', textAlign: 'left',
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', color: '#666',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...finals].sort((a, b) => b.round - a.round).map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '4px 6px', color: '#888' }}>
                  {f.round === maxRound ? 'Финал' : '1/2'}
                </td>
                <td style={{ padding: '4px 6px', fontWeight: 600 }}>{f.winner.fullName}</td>
                <td style={{ padding: '4px 6px', color: '#666' }}>{f.loser.fullName}</td>
                <td style={{ padding: '4px 6px', color: '#888' }}>
                  {OUTCOME_LABEL[f.outcome]}{f.endRound ? ` · Р${f.endRound}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export const PrintResultsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([tournamentsApi.findOne(id), matchesApi.getPublicResults(id)])
      .then(([t, r]) => { setTournament(t); setResults(r); })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PrintDocument
      tournamentName={tournament?.name ?? ''}
      city={tournament?.city ?? ''}
      dateStart={tournament?.dateStart ?? ''}
      dateEnd={tournament?.dateEnd ?? ''}
      docTitle="ИТОГОВЫЕ РЕЗУЛЬТАТЫ"
      loading={loading}
      error={error}
    >
      {results?.categories.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>
          Результатов пока нет.
        </div>
      ) : (
        results?.categories.map((cat) => renderCategory(cat))
      )}
    </PrintDocument>
  );
};
