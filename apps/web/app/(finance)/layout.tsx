import type { ReactNode } from 'react';
import { BrowserLockGate } from '@/components/finance/BrowserLockGate';
import { FinanceShell } from '@/components/finance/FinanceShell';

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <BrowserLockGate>
      <FinanceShell>{children}</FinanceShell>
    </BrowserLockGate>
  );
}
