import { useEffect, useMemo, useState } from 'react';

import { GENDER_LABEL, computeAge } from '@/entities/boxer';
import { boxersApi } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';

import { useSubmitApplications } from '../model/useSubmitApplications';

import type { Boxer, PublicTournament } from '@/shared/types';

interface Props {
  tournament: PublicTournament;
  onClose: () => void;
  onSubmitted: () => void;
}

interface Row {
  boxerId: string;
  category?: number;
  selected: boolean;
}

function pickAutoCategory(weight: number, cats: number[]): number | undefined {
  return [...cats].sort((a, b) => a - b).find((c) => weight <= c);
}

export const ApplicationsSubmitDialog = ({ tournament, onClose, onSubmitted }: Props) => {
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const { submit, submitting, error, perItemErrors } = useSubmitApplications();

  useEffect(() => {
    void (async () => {
      const page = await boxersApi.list();
      setBoxers(page.items);
      const init: Record<string, Row> = {};
      for (const b of page.items) {
        init[b.id] = {
          boxerId: b.id,
          category: pickAutoCategory(b.weight, tournament.categories),
          selected: false,
        };
      }
      setRows(init);
      setLoading(false);
    })();
  }, [tournament.categories]);

  const items = useMemo(() => Object.values(rows).filter((r) => r.selected), [rows]);

  const handleToggle = (id: string) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], selected: !r[id].selected } }));
  };

  const handleCategory = (id: string, value: string) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], category: value ? Number(value) : undefined } }));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    const result = await submit({
      tournamentId: tournament.id,
      items: items.map((r) => ({ boxerId: r.boxerId, category: r.category })),
    });
    if (result) onSubmitted();
  };

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 14, 12, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'var(--paper-100)',
          maxWidth: 720,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 'var(--radius-md)',
          padding: 32,
        }}
      >
        <MonoLabel style={{ marginBottom: 8 }}>ПОДАТЬ ЗАЯВКУ</MonoLabel>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
          {tournament.name}
        </h2>
        <div style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 'var(--text-sm)' }}>
          Категории: {tournament.categories.map((c) => `${c}кг`).join(', ')}
        </div>

        {loading && <MonoLabel>ЗАГРУЗКА БОКСЁРОВ…</MonoLabel>}
        {!loading && boxers.length === 0 && (
          <div style={{ color: 'var(--ink-500)' }}>Сначала добавьте боксёров на странице регистрации.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {boxers.map((b) => {
            const r = rows[b.id];
            const auto = pickAutoCategory(b.weight, tournament.categories);
            const overweight = auto === undefined;
            const itemError = perItemErrors[items.findIndex((x) => x.boxerId === b.id)];
            return (
              <div
                key={b.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 100px 120px',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  background: r?.selected ? 'var(--paper-200)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  opacity: overweight ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  disabled={overweight}
                  checked={r?.selected ?? false}
                  onChange={() => handleToggle(b.id)}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{b.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                    {GENDER_LABEL[b.gender]} · {computeAge(b.dob)} лет · {b.weight} кг
                  </div>
                  {itemError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{itemError}</div>}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                  {overweight ? '—' : `авто: ${auto}кг`}
                </div>
                <select
                  disabled={overweight || !r?.selected}
                  value={r?.category ?? ''}
                  onChange={(e) => handleCategory(b.id, e.target.value)}
                  style={{
                    height: 32,
                    padding: '0 8px',
                    background: 'var(--paper-200)',
                    border: '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {tournament.categories.map((c) => (
                    <option key={c} value={c}>{c}кг</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {error && <div style={{ marginTop: 16, color: 'var(--danger)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={items.length === 0 || submitting}>
            {submitting ? 'Подаём…' : `Подать заявку (${items.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
};
