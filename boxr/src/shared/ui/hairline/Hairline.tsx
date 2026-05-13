import type { CSSProperties } from 'react';

interface HairlineProps {
  vertical?: boolean;
  style?: CSSProperties;
}

export const Hairline = ({ vertical, style }: HairlineProps) => (
  <div
    style={{
      ...(vertical
        ? { width: 1, alignSelf: 'stretch', background: 'var(--paper-300)' }
        : { height: 1, width: '100%', background: 'var(--paper-300)' }),
      ...style,
    }}
  />
);
