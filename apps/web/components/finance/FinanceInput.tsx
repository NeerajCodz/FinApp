'use client';

import { Input } from '@finapp/ui/web';
import type { InputProps } from '@finapp/ui/web';

export function FinanceInput({ label, ...props }: InputProps & { label: string }) {
  return (
    <label className="finance-form-field">
      <span>{label}</span>
      <Input {...props} />
    </label>
  );
}
