import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  ApplicationStatusPill,
} from '@/entities/application';
import { GENDER_LABEL, RANK_LABEL, computeAge } from '@/entities/boxer';
import { BoxerForm } from '@/features/boxer-form';
import { ApiError, applicationsApi, boxersApi } from '@/shared/api';
import { Button, MonoLabel } from '@/shared/ui';

import s from './BoxerProfilePage.module.css';

import type { Application, Boxer } from '@/shared/types';

type Mode = 'view' | 'edit';

export const BoxerProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [boxer, setBoxer] = useState<Boxer | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [b, a] = await Promise.all([
        boxersApi.findOne(id),
        applicationsApi.listMine({}),
      ]);
      setBoxer(b);
      setApps(a.items.filter((x) => x.boxerId === id));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'Боксёр не найден или у вас нет доступа'
          : 'Не удалось загрузить боксёра',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async () => {
    if (!boxer) return;
    if (!confirm(`Удалить боксёра ${boxer.fullName}?`)) return;
    try {
      await boxersApi.remove(boxer.id);
      navigate('/trainer', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить');
    }
  };

  if (loading) return <Centered text="Загрузка…" />;
  if (error || !boxer) return <Centered text={error ?? 'Не найдено'} action={() => navigate('/trainer')} />;

  if (mode === 'edit') {
    return (
      <div className={s.page} style={{ background: 'var(--paper-100)' }}>
        <div className={s.innerNarrow}>
          <MonoLabel style={{ marginBottom: 16 }}>РЕДАКТИРОВАНИЕ</MonoLabel>
          <h1 style={titleStyle}>{boxer.fullName}</h1>
          <BoxerForm
            initial={boxer}
            onSaved={(b) => { setBoxer(b); setMode('view'); }}
            onCancel={() => setMode('view')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={s.page} style={{ background: 'var(--paper-100)' }}>
      <div className={s.inner}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/trainer')}>← К тренерскому дашборду</Button>
        <MonoLabel style={{ margin: '24px 0 8px' }}>
          {GENDER_LABEL[boxer.gender] === 'М' ? 'Мужчина' : 'Женщина'} · {computeAge(boxer.dob)} лет · {RANK_LABEL[boxer.rank]}
        </MonoLabel>
        <h1 style={titleStyle}>{boxer.fullName}</h1>
        <div style={{ color: 'var(--ink-500)', fontSize: 'var(--text-base)', marginTop: 8 }}>
          {boxer.weight} кг{boxer.club ? ` · ${boxer.club}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          <Button variant="secondary" onClick={() => setMode('edit')}>Редактировать</Button>
          <Button variant="danger" onClick={handleDelete}>Удалить</Button>
        </div>

        <h2 style={{ ...titleStyle, fontSize: 'clamp(24px, 2vw, 32px)', marginTop: 48 }}>Заявки</h2>
        {apps.length === 0 && (
          <div style={{ color: 'var(--ink-500)', marginTop: 16 }}>Заявок пока нет.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {apps.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                background: 'var(--paper-200)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <MonoLabel>Турнир {a.tournamentId.slice(0, 8)}</MonoLabel>
                <div style={{ marginTop: 4 }}>Категория: {a.category} кг</div>
              </div>
              <ApplicationStatusPill status={a.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(32px, 4vw, 52px)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
} as const;

const Centered = ({ text, action }: { text: string; action?: () => void }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <MonoLabel>{text}</MonoLabel>
    {action && <Button onClick={action}>На дашборд</Button>}
  </div>
);
