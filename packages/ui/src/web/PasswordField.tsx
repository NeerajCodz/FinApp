'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './fields';
export function PasswordField(props: Omit<InputProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        style={{ paddingRight: 54, ...props.style }}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={props.disabled}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          display: 'grid',
          width: 44,
          height: 44,
          placeItems: 'center',
          padding: 0,
          border: 0,
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--finapp-foreground-muted)',
          cursor: 'pointer',
        }}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
