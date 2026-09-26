import type { ReactNode } from 'react';
import { FinanceShell } from '@/components/finance/FinanceShell';

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <FinanceShell>{children}</FinanceShell>;
}
