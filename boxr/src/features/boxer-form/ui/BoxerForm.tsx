import { useRef, useState } from 'react';

import { GENDER_LABEL, RANK_LABEL } from '@/entities/boxer';
import { boxersApi } from '@/shared/api';
import { Button, Input, MonoLabel } from '@/shared/ui';

import s from './BoxerForm.module.css';
import { useBoxerForm } from '../model/useBoxerForm';

import type { Boxer, BoxerRank, Gender } from '@/shared/types';


interface BoxerFormProps {
  initial?: Boxer;
  onSaved: (b: Boxer) => void;
  onCancel: () => void;
}

const GENDER_OPTIONS: Gender[] = ['male', 'female'];
const RANK_OPTIONS: BoxerRank[] = [
  'none',
  'third_class',
  'second_class',
  'first_class',
  'cms',
  'ms',
  'msic',
];

export const BoxerForm = ({ initial, onSaved, onCancel }: BoxerFormProps) => {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [weight, setWeight] = useState(String(initial?.weight ?? ''));
  const [club, setClub] = useState(initial?.club ?? '');
  const [rank, setRank] = useState<BoxerRank>(initial?.rank ?? 'none');

  const [passportSeries, setPassportSeries] = useState(initial?.passportSeries ?? '');
  const [passportNumber, setPassportNumber] = useState(initial?.passportNumber ?? '');
  const [passportIssuedBy, setPassportIssuedBy] = useState(initial?.passportIssuedBy ?? '');
  const [passportIssuedAt, setPassportIssuedAt] = useState(initial?.passportIssuedAt ?? '');
  const [passportDivisionCode, setPassportDivisionCode] = useState(initial?.passportDivisionCode ?? '');

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { create, update, submitting, error } = useBoxerForm();

  const valid = fullName.trim().length >= 2 && !!dob && Number(weight) > 0;

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrError(null);
    try {
      const result = await boxersApi.ocrPassport(file);
      if (result.fullName) setFullName(result.fullName);
      if (result.dob) setDob(result.dob);
      if (result.gender) setGender(result.gender === 'MALE' ? 'male' : 'female');
      if (result.passportSeries) setPassportSeries(result.passportSeries);
      if (result.passportNumber) setPassportNumber(result.passportNumber);
      if (result.passportIssuedBy) setPassportIssuedBy(result.passportIssuedBy);
      if (result.passportIssuedAt) setPassportIssuedAt(result.passportIssuedAt);
      if (result.passportDivisionCode) setPassportDivisionCode(result.passportDivisionCode);
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : 'Не удалось распознать паспорт');
    } finally {
      setOcrLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!valid) return;
    const payload = {
      fullName: fullName.trim(),
      dob,
      gender,
      weight: Number(weight),
      club: club.trim() || undefined,
      rank,
      passportSeries: passportSeries.trim() || undefined,
      passportNumber: passportNumber.trim() || undefined,
      passportIssuedBy: passportIssuedBy.trim() || undefined,
      passportIssuedAt: passportIssuedAt || undefined,
      passportDivisionCode: passportDivisionCode.trim() || undefined,
    };
    try {
      const result = initial ? await update(initial.id, payload) : await create(payload);
      onSaved(result);
    } catch {
      /* ошибка в state */
    }
  };

  return (
    <div className={s.root}>
      <Input label="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Input
        label="Дата рождения"
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
      />
      <div>
        <MonoLabel style={{ marginBottom: 12 }}>ПОЛ</MonoLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {GENDER_OPTIONS.map((g) => {
            const sel = gender === g;
            return (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: sel ? 'var(--ink-900)' : 'var(--paper-200)',
                  color: sel ? 'var(--paper-100)' : 'var(--ink-700)',
                  border: `1px solid ${sel ? 'var(--ink-900)' : 'var(--paper-300)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {GENDER_LABEL[g] === 'М' ? 'Мужской' : 'Женский'}
              </button>
            );
          })}
        </div>
      </div>
      <Input
        label="Текущий вес, кг"
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <Input label="Клуб (опц.)" value={club} onChange={(e) => setClub(e.target.value)} />
      <div>
        <MonoLabel style={{ marginBottom: 12 }}>РАЗРЯД</MonoLabel>
        <select
          value={rank}
          onChange={(e) => setRank(e.target.value as BoxerRank)}
          style={{
            height: 48,
            padding: '0 12px',
            background: 'var(--paper-200)',
            border: '1px solid transparent',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            width: '100%',
          }}
        >
          {RANK_OPTIONS.map((r) => (
            <option key={r} value={r}>{RANK_LABEL[r]}</option>
          ))}
        </select>
      </div>

      {/* Паспортные данные */}
      <div style={{ borderTop: '1px solid var(--paper-300)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <MonoLabel>ПАСПОРТНЫЕ ДАННЫЕ</MonoLabel>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleOcr}
            />
            <button
              type="button"
              disabled={ocrLoading}
              onClick={() => fileRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: 'var(--paper-200)',
                border: '1px solid var(--paper-300)',
                borderRadius: 'var(--radius-sm)',
                cursor: ocrLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                opacity: ocrLoading ? 0.6 : 1,
                transition: 'border-color 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              {ocrLoading ? 'Распознаём…' : 'Загрузить фото паспорта'}
            </button>
          </div>
        </div>

        {ocrError && (
          <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
            {ocrError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Серия"
            placeholder="1234"
            value={passportSeries}
            onChange={(e) => setPassportSeries(e.target.value)}
          />
          <Input
            label="Номер"
            placeholder="567890"
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
          />
        </div>
        <Input
          label="Кем выдан"
          placeholder="ГУ МВД России…"
          value={passportIssuedBy}
          onChange={(e) => setPassportIssuedBy(e.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Дата выдачи"
            type="date"
            value={passportIssuedAt}
            onChange={(e) => setPassportIssuedAt(e.target.value)}
          />
          <Input
            label="Код подразделения"
            placeholder="123-456"
            value={passportDivisionCode}
            onChange={(e) => setPassportDivisionCode(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button onClick={handleSubmit} disabled={!valid || submitting}>
          {submitting ? 'Сохраняем…' : initial ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </div>
  );
};
