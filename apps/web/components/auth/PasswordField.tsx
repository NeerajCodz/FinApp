'use client';

import { useState } from 'react';
import { Input, type InputProps } from '@finapp/ui/web';

export function PasswordField(props: Omit<InputProps, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-password-control">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-controls={props.id}
        aria-pressed={visible}
        disabled={props.disabled}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
