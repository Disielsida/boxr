import { useNavigate } from 'react-router-dom';

import { BoxerForm } from '@/features/boxer-form';
import { Button, MonoLabel } from '@/shared/ui';

import s from './RegisterBoxerPage.module.css';

export const RegisterBoxerPage = () => {
  const navigate = useNavigate();
  return (
    <div className={s.page} style={{ background: 'var(--paper-100)' }}>
      <div className={s.inner}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/trainer')}>
          ← К тренерскому дашборду
        </Button>
        <MonoLabel style={{ margin: '24px 0 16px' }}>НОВЫЙ БОКСЁР</MonoLabel>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 4vw, 56px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 32,
          }}
        >
          Регистрация боксёра
        </h1>
        <BoxerForm
          onSaved={(b) => navigate(`/boxers/${b.id}`, { replace: true })}
          onCancel={() => navigate('/trainer')}
        />
      </div>
    </div>
  );
};
