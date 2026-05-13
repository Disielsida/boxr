import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AuthForm } from '@/features/auth';
import { MonoLabel } from '@/shared/ui';

import s from './LoginPage.module.css';

import type { AuthMode } from '@/features/auth';


const STATS: Array<[string, string]> = [
  ['47', 'ТУРНИРОВ'],
  ['2340', 'УЧАСТНИКОВ'],
  ['78', 'РЕГИОНОВ'],
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mode: AuthMode = location.pathname === '/register' ? 'register' : 'login';

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  const anim = (delay = 0) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'none' : 'translateY(20px)',
    transition: `opacity 0.6s ${delay}s var(--ease-out-expo), transform 0.6s ${delay}s var(--ease-out-expo)`,
  });

  return (
    <div className={s.root} style={{ background: 'var(--paper-100)' }}>
      {/* LEFT: Form */}
      <div className={s.left} style={{ ...anim(0.1) }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            maxWidth: 440,
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 32,
              padding: 0,
            }}
          >
            <img src="/black-logo.svg" alt="BOXR" style={{ height: 27 }} />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-0.01em',
              }}
            >
              BOXR
            </span>
          </button>
          <AuthForm mode={mode} />
        </div>
      </div>

      {/* RIGHT: Editorial */}
      <div
        className={s.right}
        style={{
          background: 'var(--ink-900)',
          ...anim(0.2),
        }}
      >
        <div
          style={{
            width: '100%',
            height: 1,
            background: 'rgba(242,238,229,0.1)',
            marginBottom: 48,
          }}
        />

        <MonoLabel style={{ color: 'rgba(242,238,229,0.3)', marginBottom: 32 }}>
          ФИЛОСОФИЯ БОКСА
        </MonoLabel>

        <blockquote
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 3.5vw, 56px)',
            fontStyle: 'italic',
            fontWeight: 300,
            lineHeight: 1.25,
            color: 'var(--ink-dark-text)',
            letterSpacing: '-0.02em',
            marginBottom: 40,
          }}
        >
          «Чтобы стать боксером — нужно научиться терпеть.»
        </blockquote>

        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'rgba(242,238,229,0.5)',
            fontStyle: 'italic',
          }}
        >
          — Олег Владимирович Меньшиков, главный тренер БК «Торпедо»
        </div>
        <MonoLabel style={{ color: 'rgba(242,238,229,0.25)', marginTop: 8 }}>№ 002</MonoLabel>

        <div
          style={{
            width: '100%',
            height: 1,
            background: 'rgba(242,238,229,0.1)',
            marginTop: 48,
          }}
        />

        <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
          {STATS.map(([n, l]) => (
            <div key={l}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 28,
                  fontWeight: 300,
                  color: 'var(--ink-dark-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                {n}
              </div>
              <MonoLabel style={{ color: 'rgba(242,238,229,0.3)', marginTop: 4 }}>{l}</MonoLabel>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
