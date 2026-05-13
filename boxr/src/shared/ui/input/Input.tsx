import { useState } from 'react';

import type { ChangeEvent, HTMLInputTypeAttribute } from 'react';

interface InputProps {
  label?: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  mono?: boolean;
}

export const Input = ({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  mono,
}: InputProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--ink-500)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 48,
          padding: '0 16px',
          background: 'var(--paper-200)',
          border: `1px solid ${
            error ? 'var(--danger)' : focused ? 'var(--ink-900)' : 'transparent'
          }`,
          borderRadius: 'var(--radius-sm)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--ink-900)',
          outline: 'none',
          transition: 'border-color var(--duration-fast) var(--ease-out-quart)',
          width: '100%',
        }}
      />
      {error && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
};
