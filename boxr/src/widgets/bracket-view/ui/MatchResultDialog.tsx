// boxr/src/widgets/bracket-view/ui/MatchResultDialog.tsx
import { useState } from 'react';

import { matchesApi, ApiError } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';

import type { SetResultInput } from '@/shared/api';
import type { BracketMatch, MatchOutcome } from '@/shared/types';

interface Props {
  match: BracketMatch;
  tournamentRounds: number;
  onClose: () => void;
  onResult: (bracket: Awaited<ReturnType<typeof matchesApi.setResult>>) => void;
}

const outcomes: Array<{ value: MatchOutcome; label: string }> = [
  { value: 'wp', label: 'WP — по очкам' },
  { value: 'ko', label: 'KO — нокаут' },
  { value: 'rsc', label: 'RSC — рефери остановил' },
  { value: 'dsq', label: 'DSQ — дисквалификация' },
  { value: 'wo', label: 'WO — неявка / отказ' },
];

const requiresEndRound = (o: MatchOutcome) => o === 'ko' || o === 'rsc';

export const MatchResultDialog = ({ match, tournamentRounds, onClose, onResult }: Props) => {
  const [winner, setWinner] = useState<'red' | 'blue'>('red');
  const [outcome, setOutcome] = useState<MatchOutcome>('wp');
  const [endRound, setEndRound] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const input: SetResultInput = {
        winner,
        outcome,
        ...(requiresEndRound(outcome) ? { endRound } : {}),
      };
      const fresh = await matchesApi.setResult(match.id, input);
      onResult(fresh);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить результат');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,20,61,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--paper-100)', padding: 28, borderRadius: 'var(--radius-md)',
          width: 420, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div>
          <MonoLabel>ФИКСАЦИЯ РЕЗУЛЬТАТА</MonoLabel>
          <div style={{ marginTop: 8, fontSize: 'var(--text-sm)' }}>
            🔴 {match.red?.fullName} vs 🔵 {match.blue?.fullName}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MonoLabel>ПОБЕДИТЕЛЬ</MonoLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['red', 'blue'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWinner(w)}
                style={{
                  flex: 1, padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${winner === w ? 'var(--ink-900)' : 'var(--paper-300)'}`,
                  background: winner === w ? 'var(--ink-900)' : 'transparent',
                  color: winner === w ? 'var(--paper-100)' : 'var(--ink-900)',
                  cursor: 'pointer',
                }}
              >
                {w === 'red' ? '🔴 ' : '🔵 '}
                {(w === 'red' ? match.red : match.blue)?.fullName}
              </button>
            ))}
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MonoLabel>ИСХОД</MonoLabel>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as MatchOutcome)}
            style={{ padding: 8, fontSize: 'var(--text-sm)' }}
          >
            {outcomes.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {requiresEndRound(outcome) && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <MonoLabel>РАУНД ОКОНЧАНИЯ</MonoLabel>
            <select
              value={endRound}
              onChange={(e) => setEndRound(Number(e.target.value))}
              style={{ padding: 8, fontSize: 'var(--text-sm)' }}
            >
              {Array.from({ length: tournamentRounds }, (_, i) => i + 1).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Отмена</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Сохраняем…' : 'Утвердить'}
          </Button>
        </div>
      </div>
    </div>
  );
};
