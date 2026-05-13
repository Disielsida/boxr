import { useState } from 'react';

import { ApplicationStatusPill } from '@/entities/application';
import { computeAge, RANK_LABEL } from '@/entities/boxer';
import { Button, Input, MonoLabel } from '@/shared/ui';

import { useApplicationsReview } from '../model/useApplicationsReview';

import type { ApplicationStatus, Boxer } from '@/shared/types';

interface Props {
  tournamentId: string;
  frozen: boolean;
}

const FILTERS: { id?: ApplicationStatus; label: string }[] = [
  { id: undefined,    label: 'Все' },
  { id: 'pending',    label: 'На проверке' },
  { id: 'approved',   label: 'Одобрены' },
  { id: 'rejected',   label: 'Отклонены' },
  { id: 'withdrawn',  label: 'Отозваны' },
];

const GENDER_LABEL: Record<string, string> = { male: 'Муж.', female: 'Жен.' };

export const ApplicationsTable = ({ tournamentId, frozen }: Props) => {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | undefined>(undefined);
  const [clubSearch, setClubSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { items, loading, error, approve, reject } = useApplicationsReview(tournamentId, statusFilter);

  const filtered = clubSearch.trim()
    ? items.filter((a) => {
        const b = a.boxer as Boxer | undefined;
        return b?.club?.toLowerCase().includes(clubSearch.trim().toLowerCase());
      })
    : items;

  return (
    <div>
      {/* Status filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const sel = statusFilter === f.id;
          return (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '6px 14px',
                background: sel ? 'var(--ink-900)' : 'var(--paper-200)',
                color: sel ? 'var(--paper-100)' : 'var(--ink-700)',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Club search */}
      <div style={{ maxWidth: 320, marginBottom: 24 }}>
        <Input
          label="Поиск по клубу"
          placeholder="БК «Динамо»..."
          value={clubSearch}
          onChange={(e) => setClubSearch(e.target.value)}
        />
      </div>

      {loading && <MonoLabel>ЗАГРУЗКА…</MonoLabel>}
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {!loading && filtered.length === 0 && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            background: 'var(--paper-200)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--ink-500)',
          }}
        >
          {items.length === 0 ? 'Пока нет заявок.' : 'Нет участников из этого клуба.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {filtered.map((a, idx) => {
          const b = a.boxer as Boxer | undefined;
          const expanded = expandedId === a.id;

          return (
            <div
              key={a.id}
              style={{
                borderBottom: '1px solid var(--paper-300)',
                borderLeft: a.status === 'pending' ? '3px solid var(--warning)' : '3px solid transparent',
              }}
            >
              {/* Main row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 80px 100px 120px 28px 1fr',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(expanded ? null : a.id)}
              >
                <MonoLabel style={{ fontSize: 11 }}>№ {idx + 1}</MonoLabel>
                <div>
                  <div style={{ fontWeight: 500 }}>{b?.fullName ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{b?.club ?? '—'}</div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>
                  {b ? `${computeAge(b.dob)} лет` : '—'}
                </div>
                <div style={{ fontSize: 'var(--text-sm)' }}>{a.category} кг</div>
                <div style={{ fontSize: 'var(--text-sm)' }}>{b ? RANK_LABEL[b.rank] : '—'}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-400)',
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    userSelect: 'none',
                  }}
                >
                  ▾
                </div>
                <div
                  style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ApplicationStatusPill status={a.status} />
                  {!frozen && a.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => approve(a.id)}>Одобрить</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const reason = prompt('Причина отказа (опц.)') ?? undefined;
                          void reject(a.id, reason || undefined);
                        }}
                      >
                        Отклонить
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expanded && b && (
                <div
                  style={{
                    padding: '12px 16px 16px 78px',
                    background: 'var(--paper-200)',
                    display: 'flex',
                    gap: 32,
                    flexWrap: 'wrap',
                  }}
                >
                  <Detail label="Дата рождения">{new Date(b.dob).toLocaleDateString('ru-RU')}</Detail>
                  <Detail label="Пол">{GENDER_LABEL[b.gender] ?? b.gender}</Detail>
                  <Detail label="Фактический вес">{b.weight} кг</Detail>
                  <Detail label="Весовая категория">{a.category} кг</Detail>
                  <Detail label="Разряд">{RANK_LABEL[b.rank]}</Detail>
                  {b.club && <Detail label="Клуб">{b.club}</Detail>}
                  {a.status === 'rejected' && a.rejectReason && (
                    <Detail label="Причина отклонения">
                      <span style={{ color: 'var(--danger)' }}>{a.rejectReason}</span>
                    </Detail>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-300)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{children}</div>
  </div>
);
