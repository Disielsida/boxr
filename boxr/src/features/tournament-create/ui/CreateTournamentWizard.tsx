import { useMemo, useState } from 'react';

import {
  DEFAULT_CATEGORIES,
  LEVEL_LABEL,
  TYPE_LABEL,
  WEIGHT_CATEGORIES,
} from '@/entities/tournament';
import { Button, Input, MonoLabel } from '@/shared/ui';

import s from './CreateTournamentWizard.module.css';
import { useCreateTournament } from '../model/useCreateTournament';

import type {
  CreateTournamentInput,
  UpdateTournamentInput,
} from '@/shared/api';
import type {
  Tournament,
  TournamentLevel,
  TournamentType,
} from '@/shared/types';


interface CreateTournamentWizardProps {
  initial?: Tournament;
  onSubmitted: (t: Tournament) => void;
  onCancel: () => void;
}

interface FormState {
  name: string;
  type: TournamentType;
  level: TournamentLevel;
  dateStart: string;
  dateEnd: string;
  city: string;
  address: string;
  categories: number[];
  rounds: number;
  roundDuration: number;
  helmets: boolean;
  ringCount: number;
}

const STEP_TITLES = ['Основное', 'Даты и место', 'Категории', 'Регламент', 'Подтверждение'];
const TOTAL_STEPS = 5;

const TYPE_OPTIONS: TournamentType[] = ['regional', 'national', 'international'];
const LEVEL_OPTIONS: TournamentLevel[] = ['amateur', 'professional', 'mixed'];

export const CreateTournamentWizard = ({
  initial,
  onSubmitted,
  onCancel,
}: CreateTournamentWizardProps) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => ({
    name: initial?.name ?? '',
    type: initial?.type ?? 'regional',
    level: initial?.level ?? 'amateur',
    dateStart: initial?.dateStart ?? '',
    dateEnd: initial?.dateEnd ?? '',
    city: initial?.city ?? '',
    address: initial?.address ?? '',
    categories: initial?.categories ?? DEFAULT_CATEGORIES,
    rounds: initial?.rounds ?? 3,
    roundDuration: initial?.roundDuration ?? 3,
    helmets: initial?.helmets ?? false,
    ringCount: initial?.ringCount ?? 1,
  }));

  const { submitting, error, create, update } = useCreateTournament();

  const stepValid = useMemo(() => {
    if (step === 1) return form.name.trim().length >= 3;
    if (step === 2)
      return Boolean(form.dateStart && form.dateEnd && form.dateEnd >= form.dateStart) && form.city.trim().length >= 2;
    if (step === 3) return form.categories.length > 0;
    return true;
  }, [step, form]);

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else onCancel();
  };

  const handleNext = async () => {
    if (!stepValid) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    const payload: CreateTournamentInput = {
      name: form.name.trim(),
      type: form.type,
      level: form.level,
      dateStart: form.dateStart,
      dateEnd: form.dateEnd,
      city: form.city.trim(),
      address: form.address.trim() || undefined,
      categories: [...form.categories].sort((a, b) => a - b),
      rounds: form.rounds,
      roundDuration: form.roundDuration,
      helmets: form.helmets,
      ringCount: form.ringCount,
    };
    try {
      const t = initial
        ? await update(initial.id, payload as UpdateTournamentInput)
        : await create(payload);
      onSubmitted(t);
    } catch {
      // ошибка уже сохранена в хук
    }
  };

  const toggleCategory = (kg: number) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(kg)
        ? f.categories.filter((c) => c !== kg)
        : [...f.categories, kg],
    }));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-100)', display: 'flex', flexDirection: 'column' }}>
      <header className={s.wizardHeader}>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          {step === 1 ? 'Отмена' : '← Назад'}
        </Button>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--ink-500)',
              letterSpacing: '0.1em',
            }}
          >
            ШАГ {String(step).padStart(2, '0')} ИЗ {String(TOTAL_STEPS).padStart(2, '0')}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--ink-700)',
              marginTop: 2,
            }}
          >
            {STEP_TITLES[step - 1]}
          </div>
        </div>
        <div style={{ width: 96 }} />
      </header>

      <div style={{ height: 2, background: 'var(--paper-300)' }}>
        <div
          style={{
            height: '100%',
            background: 'var(--ring-600)',
            width: `${(step / TOTAL_STEPS) * 100}%`,
            transition: 'width 0.5s var(--ease-out-expo)',
          }}
        />
      </div>

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '60px 24px' }}>
        <div className={s.body}>
          {step === 1 && (
            <section>
              <MonoLabel style={{ marginBottom: 16 }}>01 / ОСНОВНОЕ</MonoLabel>
              <h2 style={titleStyle}>Расскажите о турнире</h2>
              <p style={subtitleStyle}>Основные параметры соревнования</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Input
                  label="Название турнира"
                  placeholder="Кубок города Москвы — 2024"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <ChipGroup
                  label="ТИП"
                  options={TYPE_OPTIONS.map((id) => ({ id, label: TYPE_LABEL[id] }))}
                  value={form.type}
                  onChange={(id) => setForm((f) => ({ ...f, type: id as TournamentType }))}
                />
                <ChipGroup
                  label="УРОВЕНЬ"
                  options={LEVEL_OPTIONS.map((id) => ({ id, label: LEVEL_LABEL[id] }))}
                  value={form.level}
                  onChange={(id) => setForm((f) => ({ ...f, level: id as TournamentLevel }))}
                />
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <MonoLabel style={{ marginBottom: 16 }}>02 / ДАТЫ И МЕСТО</MonoLabel>
              <h2 style={titleStyle}>Когда и где?</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Input
                    label="Дата начала"
                    type="date"
                    value={form.dateStart}
                    onChange={(e) => setForm((f) => ({ ...f, dateStart: e.target.value }))}
                  />
                  <Input
                    label="Дата окончания"
                    type="date"
                    value={form.dateEnd}
                    onChange={(e) => setForm((f) => ({ ...f, dateEnd: e.target.value }))}
                    error={
                      form.dateStart && form.dateEnd && form.dateEnd < form.dateStart
                        ? 'Окончание раньше начала'
                        : undefined
                    }
                  />
                </div>
                <Input
                  label="Город"
                  placeholder="Москва"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
                <Input
                  label="Адрес арены"
                  placeholder="Лужнецкая наб., 24"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <MonoLabel style={{ marginBottom: 16 }}>03 / КАТЕГОРИИ</MonoLabel>
              <h2 style={titleStyle}>Весовые категории</h2>
              <p style={{ color: 'var(--ink-500)', marginBottom: 32, fontSize: 'var(--text-sm)' }}>
                Мужчины 19–40 лет (по умолчанию — международный регламент IBA)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {WEIGHT_CATEGORIES.map((kg) => {
                  const selected = form.categories.includes(kg);
                  return (
                    <button
                      key={kg}
                      onClick={() => toggleCategory(kg)}
                      style={{
                        padding: 16,
                        background: selected ? 'var(--ink-900)' : 'var(--paper-200)',
                        color: selected ? 'var(--paper-100)' : 'var(--ink-700)',
                        border: `1px solid ${selected ? 'var(--ring-600)' : 'var(--paper-300)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-base)',
                        transition: 'all var(--duration-fast) var(--ease-out-quart)',
                      }}
                    >
                      до {kg} кг
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 24, fontFamily: 'var(--font-mono)', color: 'var(--ink-500)', fontSize: 'var(--text-xs)' }}>
                Выбрано {form.categories.length} из {WEIGHT_CATEGORIES.length} категорий
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <MonoLabel style={{ marginBottom: 16 }}>04 / РЕГЛАМЕНТ</MonoLabel>
              <h2 style={titleStyle}>Правила турнира</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <Slider
                  label="КОЛИЧЕСТВО РИНГОВ"
                  min={1}
                  max={2}
                  value={form.ringCount}
                  onChange={(v) => setForm((f) => ({ ...f, ringCount: v }))}
                />
                <Slider
                  label="КОЛИЧЕСТВО РАУНДОВ"
                  min={1}
                  max={12}
                  value={form.rounds}
                  onChange={(v) => setForm((f) => ({ ...f, rounds: v }))}
                />
                <Slider
                  label="ДЛИТЕЛЬНОСТЬ РАУНДА (МИН)"
                  min={1}
                  max={5}
                  value={form.roundDuration}
                  onChange={(v) => setForm((f) => ({ ...f, roundDuration: v }))}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 0',
                    borderTop: '1px solid var(--paper-300)',
                    borderBottom: '1px solid var(--paper-300)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Использование шлемов</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>
                      По правилам IBA для мужчин 19–40 — не требуется
                    </div>
                  </div>
                  <Toggle value={form.helmets} onChange={(v) => setForm((f) => ({ ...f, helmets: v }))} />
                </div>
              </div>
            </section>
          )}

          {step === 5 && (
            <section>
              <MonoLabel style={{ marginBottom: 16 }}>05 / ПОДТВЕРЖДЕНИЕ</MonoLabel>
              <h2 style={titleStyle}>Всё верно?</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  ['Название', form.name || '—'],
                  ['Тип', TYPE_LABEL[form.type]],
                  ['Уровень', LEVEL_LABEL[form.level]],
                  ['Даты', form.dateStart ? `${form.dateStart} — ${form.dateEnd}` : '—'],
                  ['Город', form.city || '—'],
                  ['Адрес', form.address || '—'],
                  ['Категорий', `${form.categories.length} весовых`],
                  ['Кол-во рингов', String(form.ringCount)],
                  ['Раунды', `${form.rounds} × ${form.roundDuration} мин`],
                  ['Шлемы', form.helmets ? 'Да' : 'Нет'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 0',
                      borderBottom: '1px solid var(--paper-300)',
                    }}
                  >
                    <MonoLabel>{label}</MonoLabel>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              {error && (
                <div style={{ marginTop: 16, color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                  {error}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <footer
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 500,
          background: 'var(--paper-100)',
          borderTop: '1px solid var(--paper-300)',
          padding: '16px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button variant="ghost" onClick={handleBack}>
          {step === 1 ? 'Отмена' : '← Назад'}
        </Button>
        <Button onClick={handleNext} disabled={!stepValid || submitting}>
          {submitting
            ? 'Сохраняем…'
            : step === TOTAL_STEPS
              ? initial
                ? 'Сохранить'
                : 'Создать турнир'
              : 'Далее →'}
        </Button>
      </footer>
    </div>
  );
};

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(36px, 4vw, 56px)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  marginBottom: 8,
} as const;

const subtitleStyle = {
  color: 'var(--ink-500)',
  fontStyle: 'italic',
  fontFamily: 'var(--font-display)',
  marginBottom: 40,
} as const;

interface ChipOption {
  id: string;
  label: string;
}
const ChipGroup = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
}) => (
  <div>
    <MonoLabel style={{ marginBottom: 12 }}>{label}</MonoLabel>
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(({ id, label: l }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: selected ? 'var(--ink-900)' : 'var(--paper-200)',
              color: selected ? 'var(--paper-100)' : 'var(--ink-700)',
              border: `1px solid ${selected ? 'var(--ink-900)' : 'var(--paper-300)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              transition: 'all var(--duration-fast) var(--ease-out-quart)',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  </div>
);

const Slider = ({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <MonoLabel>{label}</MonoLabel>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 400 }}>{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: 'var(--ink-900)' }}
    />
  </div>
);

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    style={{
      width: 48,
      height: 28,
      background: value ? 'var(--ink-900)' : 'var(--paper-300)',
      borderRadius: 14,
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background var(--duration-fast) var(--ease-out-quart)',
    }}
    aria-pressed={value}
  >
    <span
      style={{
        position: 'absolute',
        top: 4,
        left: value ? 24 : 4,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'white',
        transition: 'left var(--duration-fast) var(--ease-out-quart)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
    />
  </button>
);
