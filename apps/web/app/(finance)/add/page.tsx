'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, HandCoins, UsersRound } from 'lucide-react';
import { Card, SectionHeader } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

const actions = [
  { label: 'Expense', description: 'Money you spent', href: '/transaction/new?type=expense', icon: ArrowUpRight },
  { label: 'Income', description: 'Money you received', href: '/transaction/new?type=income', icon: ArrowDownLeft },
  { label: 'Transfer', description: 'Move money between accounts', href: '/transaction/new?type=transfer', icon: ArrowLeftRight },
  { label: 'Split expense', description: 'Share an expense with people', href: '/split/new', icon: UsersRound },
  { label: 'Settlement', description: 'Record paying someone back', href: '/settle/new', icon: HandCoins },
];

export default function AddPage() {
  const { userId } = useBrowserSync();
  if (!userId)
    return (
      <FinanceSignedOut
        section="QUICK ADD"
        title="Start with a clear record."
        description="Sign in to save expenses, income, transfers, shared expenses, and repayments."
      />
    );
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">QUICK ADD</p>
          <h1>What would you like to record?</h1>
          <p className="finance-muted">Each choice opens the existing entry flow and saves locally before sync.</p>
        </div>
      </header>
      <div className="finance-settings-grid">
        {actions.map(({ label, description, href, icon: Icon }) => (
          <Card key={label} className="finance-settings-card">
            <SectionHeader title={label} action={<Icon size={18} aria-hidden="true" />} />
            <p>{description}</p>
            <Link className="finance-inline-link" href={href}>
              Continue <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
