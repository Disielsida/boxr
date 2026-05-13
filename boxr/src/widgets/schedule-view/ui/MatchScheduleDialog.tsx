import { useState } from 'react';

import { matchesApi, ApiError } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';

import type { BracketMatch, Tournament } from '@/shared/types';

interface Props {
  match: BracketMatch;
  tournament: Tournament;
  onClose: () => void;
  onResult: (bracket: Awaited<ReturnType<typeof matchesApi.setSchedule>>) => void;
}

export const MatchScheduleDialog = ({ match, tournament, onClose, onResult }: Props) => {
  const initialIso = match.scheduledAt ?? `${tournament.dateStart}T${tournament.dayStartTime}:00.000Z`;
  const [day, setDay] = useState(initialIso.slice(0, 10));
  const [time, setTime] = useState(initialIso.slice(11, 16));
  const [ring, setRing] = useState(match.ring ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = enumerateDays(tournament.dateStart, tournament.dateEnd);
  const slots = enumerateSlots(tournament.dayStartTime, '22:00', tournament.slotMinutes);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const scheduledAt = `${day}T${time}:00.000Z`;
      const fresh = await matchesApi.setSchedule(match.id, scheduledAt, ring);
      onResult(fresh);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
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
          width: 360, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <MonoLabel>ПЕРЕНЕСТИ МАТЧ</MonoLabel>
        <div style={{ fontSize: 'var(--text-sm)' }}>
          🔴 {match.red?.fullName ?? '—'} vs 🔵 {match.blue?.fullName ?? '—'}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MonoLabel>ДЕНЬ</MonoLabel>
          <select value={day} onChange={(e) => setDay(e.target.value)} style={{ padding: 8 }}>
            {days.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MonoLabel>ВРЕМЯ</MonoLabel>
          <select value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: 8 }}>
            {slots.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MonoLabel>РИНГ</MonoLabel>
          <select value={ring} onChange={(e) => setRing(Number(e.target.value))} style={{ padding: 8 }}>
            {Array.from({ length: tournament.ringCount }, (_, i) => i + 1).map((r) => (
              <option key={r} value={r}>Ринг {r}</option>
            ))}
          </select>
        </label>
        {error && <div style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Отмена</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

function enumerateDays(start: string, end: string): string[] {
  const result: string[] = [];
  const d = new Date(start.slice(0, 10) + 'T00:00:00.000Z');
  const last = new Date(end.slice(0, 10) + 'T00:00:00.000Z');
  while (d <= last) {
    result.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return result;
}

function enumerateSlots(start: string, end: string, step: number): string[] {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const result: string[] = [];
  for (let m = startMin; m <= endMin; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    result.push(`${hh}:${mm}`);
  }
  return result;
}
