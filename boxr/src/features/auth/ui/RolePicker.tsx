import { ROLES } from '@/entities/user';
import { MonoLabel } from '@/shared/ui';

import type { UserRole } from '@/shared/types';

interface RolePickerProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
}

export const RolePicker = ({ value, onChange }: RolePickerProps) => (
  <div>
    <MonoLabel style={{ marginBottom: 12 }}>РОЛЬ</MonoLabel>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {ROLES.map((r) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            style={{
              padding: '14px 16px',
              background: active ? 'var(--ink-900)' : 'var(--paper-200)',
              color: active ? 'var(--paper-100)' : 'var(--ink-700)',
              border: `1px solid ${active ? 'var(--ink-900)' : 'var(--paper-300)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s var(--ease-out-quart)',
            }}
          >
            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: 4 }}>
              {r.label}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>{r.desc}</div>
          </button>
        );
      })}
    </div>
  </div>
);
