import type { CSSProperties, ReactNode } from 'react';

type PillVariant = 'default' | 'active' | 'pending' | 'warning' | 'danger';

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  pulse?: boolean;
  style?: CSSProperties;
}

const COLORS: Record<PillVariant, { bg: string; fg: string }> = {
  default: { bg: 'var(--paper-200)', fg: 'var(--ink-700)' },
  active:  { bg: 'rgba(31, 93, 164, 0.12)', fg: 'var(--ring-600)' },
  pending: { bg: 'rgba(194, 139, 45, 0.12)', fg: 'var(--warning)' },
  warning: { bg: 'rgba(194, 139, 45, 0.12)', fg: 'var(--warning)' },
  danger:  { bg: 'rgba(192, 57, 43, 0.12)', fg: 'var(--danger)' },
};

export const Pill = ({ children, variant = 'default', pulse, style }: PillProps) => {
  const c = COLORS[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: c.bg,
        color: c.fg,
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {pulse && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: c.fg,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
      {children}
    </span>
  );
};
