import type { CSSProperties, ReactNode } from 'react';

interface MonoLabelProps {
  children: ReactNode;
  style?: CSSProperties;
}

export const MonoLabel = ({ children, style }: MonoLabelProps) => (
  <div
    style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--ink-300)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {children}
  </div>
);
