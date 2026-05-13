import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Input, MonoLabel } from '@/shared/ui';

import { RolePicker } from './RolePicker';
import { useAuth } from '../model/useAuth';

import type { AuthMode } from '../model/useAuth';
import type { UserRole } from '@/shared/types';

interface AuthFormProps {
  mode: AuthMode;
}

export const AuthForm = ({ mode }: AuthFormProps) => {
  const navigate = useNavigate();
  const { loading, error, submit } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('organizer');

  const handleSubmit = () => submit({ mode, email, password, name, role });

  return (
    <>
      <MonoLabel style={{ marginBottom: 16 }}>
        {mode === 'login' ? 'ЛОГИН' : 'РЕГИСТРАЦИЯ'}
      </MonoLabel>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(32px, 3.5vw, 44px)',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          marginBottom: 8,
        }}
      >
        {mode === 'login' ? <>С возвращением<span style={{ color: 'var(--ring-600)' }}>.</span></> : <>Присоединяйтесь<span style={{ color: 'var(--ring-600)' }}>.</span></>}
      </h1>
      <p style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)', marginBottom: 40 }}>
        <span style={{ display: 'inline-block', paddingBottom: 4, borderBottom: '3px solid var(--ring-600)' }}>
          {mode === 'login' ? 'Войдите в свой аккаунт' : 'Создайте аккаунт BOXR'}
        </span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {mode === 'register' && (
          <Input
            label="Полное имя"
            placeholder="Иван Петров"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <Input
          label="Email"
          type="email"
          placeholder="ivan@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Пароль"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === 'login' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--ink-500)',
              }}
            >
              <input type="checkbox" style={{ accentColor: 'var(--ink-900)' }} />
              Запомнить меня
            </label>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--ink-500)',
                textDecoration: 'underline',
              }}
            >
              Забыли пароль?
            </button>
          </div>
        )}

        {mode === 'register' && <RolePicker value={role} onChange={setRole} />}

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              color: '#7f1d1d',
              fontSize: 'var(--text-sm)',
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            height: 52,
            width: '100%',
            background: loading ? 'var(--ink-500)' : 'var(--ink-900)',
            color: 'var(--paper-100)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
            cursor: loading ? 'progress' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'background 0.2s',
          }}
        >
          {loading ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◦</span>
              Загрузка...
            </>
          ) : mode === 'login' ? (
            'Войти'
          ) : (
            'Создать аккаунт'
          )}
        </button>

      </div>

      <div style={{ marginTop: 32, fontSize: 'var(--text-sm)', color: 'var(--ink-500)' }}>
        {mode === 'login' ? (
          <>
            Нет аккаунта?{' '}
            <button
              onClick={() => navigate('/register')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontStyle: 'italic',
                textDecoration: 'underline',
                color: 'var(--ink-900)',
                fontSize: 'inherit',
              }}
            >
              Зарегистрироваться
            </button>
          </>
        ) : (
          <>
            Уже есть аккаунт?{' '}
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontStyle: 'italic',
                textDecoration: 'underline',
                color: 'var(--ink-900)',
                fontSize: 'inherit',
              }}
            >
              Войти
            </button>
          </>
        )}
      </div>
    </>
  );
};
