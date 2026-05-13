import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { matchesApi, tournamentsApi } from '@/shared/api';
import { roundLabel } from '@/shared/lib/roundLabel';
import { PrintDocument } from '@/shared/ui';

import type { Bracket, BracketCategory, BracketMatch, Tournament } from '@/shared/types';

function isBye(m: BracketMatch): boolean {
  return m.result?.outcome === 'wo' && (m.red === null || m.blue === null);
}

function winnerName(m: BracketMatch): string {
  if (!m.result) return '___________';
  const winner = m.result.winnerId === m.red?.boxerId ? m.red : m.blue;
  return winner?.fullName ?? '___________';
}

function renderCategory(cat: BracketCategory) {
  const visible = cat.matches
    .filter((m) => !isBye(m))
    .sort((a, b) => a.round - b.round || a.position - b.position);

  return (
    <div key={cat.weight} style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        color: '#888', marginBottom: 6, paddingBottom: 4,
        borderBottom: '1px solid #eee',
      }}>
        {cat.weight} КГ
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#f5f4f0' }}>
            {['РАУНД', '№', 'КРАСНЫЙ УГОЛ', 'СИНИЙ УГОЛ', 'ПОБЕДИТЕЛЬ'].map((h) => (
              <th key={h} style={{
                padding: '4px 6px', textAlign: 'left',
                fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', color: '#666',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((m, i) => (
            <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '4px 6px', color: '#888' }}>
                {roundLabel(m.round, cat.rounds)}
              </td>
              <td style={{ padding: '4px 6px', color: '#aaa' }}>{i + 1}</td>
              <td style={{ padding: '4px 6px' }}>
                {m.red?.fullName ?? <em style={{ color: '#bbb' }}>Победитель предыдущего</em>}
              </td>
              <td style={{ padding: '4px 6px' }}>
                {m.blue?.fullName ?? <em style={{ color: '#bbb' }}>Победитель предыдущего</em>}
              </td>
              <td style={{ padding: '4px 6px', color: m.result ? '#111' : '#ccc', fontStyle: m.result ? 'normal' : 'italic' }}>
                {winnerName(m)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PrintBracketPage = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([tournamentsApi.findOne(id), matchesApi.getBracket(id)])
      .then(([t, b]) => { setTournament(t); setBracket(b); })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PrintDocument
      tournamentName={tournament?.name ?? ''}
      city={tournament?.city ?? ''}
      dateStart={tournament?.dateStart ?? ''}
      dateEnd={tournament?.dateEnd ?? ''}
      docTitle="ЖЕРЕБЬЁВКА"
      loading={loading}
      error={error}
    >
      {bracket?.categories.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>
          Сетка ещё не сгенерирована.
        </div>
      ) : (
        bracket?.categories.map((cat) => renderCategory(cat))
      )}
    </PrintDocument>
  );
};
