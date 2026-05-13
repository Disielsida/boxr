import { useState } from 'react';

import { Icon } from '../icon/Icon';

import type { IconName } from '../icon/Icon';
import type { CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  onClick?: () => void;
  disabled?: boolean;
  icon?: IconName;
  style?: CSSProperties;
}

const SIZES: Record<Size, string> = { sm: '28px', md: '40px', lg: '52px' };
const PADDINGS: Record<Size, string> = { sm: '20px 14px', md: '0 20px', lg: '0 28px' };
const FONTS: Record<Size, string> = {
  sm: 'var(--text-sm)',
  md: 'var(--text-base)',
  lg: 'var(--text-lg)',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  icon,
  style,
}: ButtonProps) => {
  const [hovered, setHovered] = useState(false);

  let bg: string, color: string, border: string;
  if (variant === 'primary') {
    bg = hovered ? 'var(--ring-700)' : 'var(--ink-900)';
    color = 'var(--paper-100)';
    border = 'none';
  } else if (variant === 'secondary') {
    bg = hovered ? 'var(--ink-900)' : 'transparent';
    color = hovered ? 'var(--paper-100)' : 'var(--ink-900)';
    border = '1px solid var(--ink-900)';
  } else if (variant === 'ghost') {
    bg = hovered ? 'var(--paper-200)' : 'transparent';
    color = 'var(--ink-700)';
    border = 'none';
  } else {
    bg = hovered ? 'var(--ring-700)' : 'var(--ring-600)';
    color = 'white';
    border = 'none';
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: SIZES[size],
        padding: PADDINGS[size],
        background: bg,
        color,
        border,
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-body)',
        fontSize: FONTS[size],
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition:
          'background var(--duration-fast) var(--ease-out-quart), color var(--duration-fast) var(--ease-out-quart)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
};
