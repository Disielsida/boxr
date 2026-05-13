import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { matchesApi, tournamentsApi } from '@/shared/api';
import { roundLabel } from '@/shared/lib/roundLabel';
import { PrintDocument } from '@/shared/ui';

import type { Bracket, BracketMatch, Tournament } from '@/shared/types';

interface FlatMatch {
  match: BracketMatch;
  category: number;
  totalRounds: number;
  bout: number;
}

function buildFlat(bracket: Bracket): FlatMatch[] {
  const arr: Omit<FlatMatch, 'bout'>[] = [];
  for (const cat of bracket.categories) {
    for (const m of cat.matches) {
      if (m.scheduledAt !== null) {
        arr.push({ match: m, category: cat.weight, totalRounds: cat.rounds });
      }
    }
  }
  arr.sort((a, b) =>
    a.match.scheduledAt!.localeCompare(b.match.scheduledAt!) ||
    (a.match.ring ?? 0) - (b.match.ring ?? 0),
  );
  return arr.map((x, i) => ({ ...x, bout: i + 1 }));
}

function groupByDay(flat: FlatMatch[]): Map<string, FlatMatch[]> {
  const map = new Map<string, FlatMatch[]>();
  for (const f of flat) {
    const day = f.match.scheduledAt!.slice(0, 10);
    const arr = map.get(day) ?? [];
    arr.push(f);
    map.set(day, arr);
  }
  return map;
}

function formatDay(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).toUpperCase();
}

function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

export const PrintSchedulePage = () => {
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

  const flat = bracket ? buildFlat(bracket) : [];
  const byDay = groupByDay(flat);
  const days = [...byDay.keys()].sort();

  return (
    <PrintDocument
      tournamentName={tournament?.name ?? ''}
      city={tournament?.city ?? ''}
      dateStart={tournament?.dateStart ?? ''}
      dateEnd={tournament?.dateEnd ?? ''}
      docTitle="РАСПИСАНИЕ СОРЕВНОВАНИЙ"
      loading={loading}
      error={error}
    >
      {flat.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: 32 }}>
          Расписание ещё не сгенерировано.
        </div>
      ) : (
        days.map((day) => (
          <div key={day} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: '#888', marginBottom: 8, paddingBottom: 4,
              borderBottom: '1px solid #eee',
            }}>
              {formatDay(day)}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f5f4f0' }}>
                  {['ВРЕМЯ', 'БОЙ', 'РИНГ', 'КРАСНЫЙ УГОЛ', 'СИНИЙ УГОЛ', 'КАТ.', 'РАУНД'].map((h) => (
                    <th key={h} style={{
                      padding: '5px 6px', textAlign: h === 'КРАСНЫЙ УГОЛ' ? 'right' : 'left',
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', color: '#666',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byDay.get(day)!.map(({ match, category, totalRounds, bout }) => (
                  <tr key={match.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{formatTime(match.scheduledAt!)}</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{bout}</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{match.ring}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      {match.red?.fullName ?? <em style={{ color: '#bbb' }}>TBD</em>}
                    </td>
                    <td style={{ padding: '5px 6px' }}>
                      {match.blue?.fullName ?? <em style={{ color: '#bbb' }}>TBD</em>}
                    </td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>{category} кг</td>
                    <td style={{ padding: '5px 6px', color: '#888' }}>
                      {roundLabel(match.round, totalRounds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </PrintDocument>
  );
};
