import { useEffect, useState } from 'react';

import type { ScoringEvent, ScoringEventType, LiveScoringAction } from '../model/types';

interface Props {
  events: ScoringEvent[];
  dispatch: (a: LiveScoringAction) => void;
  disabled: boolean;
}

type PendingStop = { corner: 'red' | 'blue' };

const CONFIRM_SEC = 5;

const ACTIONS: Array<{ id: ScoringEventType; label: string; sub: string }> = [
  { id: 'remark',    label: 'Замечание',    sub: 'Малое нарушение' },
  { id: 'warning',   label: 'Предупреждение', sub: '−1 балл' },
  { id: 'knockdown', label: 'Нокдаун',      sub: '−1 балл' },
  { id: 'stop',      label: 'Стоп бой',     sub: 'RSC / TKO' },
];

const cornerStyles = {
  red:  { bg: 'rgba(178,58,47,0.15)', bgHover: 'rgba(178,58,47,0.28)', border: 'rgba(178,58,47,0.3)', borderHover: 'rgba(178,58,47,0.6)', mark: '🔴 КР' },
  blue: { bg: 'rgba(59,130,246,0.10)', bgHover: 'rgba(59,130,246,0.22)', border: 'rgba(59,130,246,0.2)', borderHover: 'rgba(59,130,246,0.5)', mark: '🔵 СИ' },
};

const ActionButton = ({
  label, sub, corner, disabled, onPress,
}: {
  label: string; sub: string; corner: 'red' | 'blue'; disabled: boolean; onPress: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const cs = cornerStyles[corner];

  return (
    <button
      disabled={disabled}
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setActive(false)}
      style={{
        padding: '10px 6px',
        background: hovered && !disabled ? cs.bgHover : cs.bg,
        border: `1px solid ${hovered && !disabled ? cs.borderHover : cs.border}`,
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--ink-dark-text)',
        textAlign: 'center',
        opacity: disabled ? 0.4 : 1,
        transform: active && !disabled ? 'scale(0.95)' : 'scale(1)',
        transition: 'background 0.12s, border-color 0.12s, transform 0.08s',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'rgba(242,238,229,0.4)',
          marginTop: 2,
          letterSpacing: '0.06em',
        }}
      >
        {sub}
      </div>
    </button>
  );
};

export const EventActionsPanel = ({ events, dispatch, disabled }: Props) => {
  const [pendingStop, setPendingStop] = useState<PendingStop | null>(null);
  const [countdown, setCountdown] = useState(CONFIRM_SEC);

  useEffect(() => {
    if (!pendingStop) return;
    setCountdown(CONFIRM_SEC);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setPendingStop(null); return CONFIRM_SEC; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pendingStop]);

  const handleAction = (eventType: ScoringEventType, corner: 'red' | 'blue') => {
    if (eventType === 'stop') { setPendingStop({ corner }); return; }
    dispatch({ type: 'ADD_EVENT', eventType, corner });
  };

  const confirmStop = () => {
    if (!pendingStop) return;
    dispatch({ type: 'ADD_EVENT', eventType: 'stop', corner: pendingStop.corner });
    setPendingStop(null);
  };

  return (
    <>
      {pendingStop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 700,
            background: 'rgba(10,10,10,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--ink-dark-surface)',
              border: '1px solid rgba(242,238,229,0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '32px 40px',
              maxWidth: 380,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(242,238,229,0.4)' }}>
              ПОДТВЕРЖДЕНИЕ
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
              Остановить бой?
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(242,238,229,0.5)' }}>
              Угол: {pendingStop.corner === 'red' ? '🔴 Красный' : '🔵 Синий'}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setPendingStop(null)}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  background: 'transparent',
                  border: '1px solid rgba(242,238,229,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--ink-dark-text)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  transition: 'border-color 0.15s',
                }}
              >
                ОТМЕНА ({countdown})
              </button>
              <button
                type="button"
                onClick={confirmStop}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  background: 'var(--ring-600)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                }}
              >
                СТОП БОЙ
              </button>
            </div>
          </div>
        </div>
      )}
    <div
      data-bottom-anchor
      style={{
        flexShrink: 0,
        borderTop: '1px solid rgba(242,238,229,0.08)',
        background: 'var(--ink-dark-surface)',
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        {(['red', 'blue'] as const).map((corner) => {
          const cs = cornerStyles[corner];
          return (
            <div key={corner} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  color: corner === 'red' ? 'rgba(178,58,47,0.8)' : 'rgba(59,130,246,0.8)',
                  textAlign: 'center',
                  marginBottom: 2,
                }}
              >
                {cs.mark}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {ACTIONS.map((action) => (
                  <ActionButton
                    key={action.id}
                    label={action.label}
                    sub={action.sub}
                    corner={corner}
                    disabled={disabled}
                    onPress={() => handleAction(action.id, corner)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', minHeight: 28 }}>
        {events.slice(0, 5).map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexShrink: 0,
              padding: '4px 12px',
              background: 'rgba(242,238,229,0.05)',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(242,238,229,0.4)' }}>
              Р{e.round} {e.time}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-dark-text)' }}>
              {labelForEvent(e.type)} — {e.corner === 'red' ? '🔴' : '🔵'}
            </span>
          </div>
        ))}
      </div>
    </div>
  </>
  );
};

function labelForEvent(t: ScoringEventType): string {
  switch (t) {
    case 'remark':    return 'Замечание';
    case 'warning':   return 'Предупреждение';
    case 'knockdown': return 'Нокдаун';
    case 'stop':      return 'Стоп бой';
  }
}
