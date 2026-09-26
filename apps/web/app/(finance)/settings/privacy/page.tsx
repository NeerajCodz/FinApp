'use client';

import Link from 'next/link';
import { ArrowRight, Download, Eye, ShieldCheck } from 'lucide-react';
import { Button, Card, SectionHeader } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';

export default function PrivacySettingsPage() {
  const { userId } = useBrowserSync();
  const accounts = useLocalRecords('account');
  const transactions = useLocalRecords('transaction');
  const categories = useLocalRecords('category');
  const groups = useLocalRecords('group');
  const settlements = useLocalRecords('settlement');
  const loading = accounts.loading || transactions.loading || categories.loading || groups.loading || settlements.loading;
  if (!userId)
    return (
      <FinanceSignedOut
        section="PRIVACY AND DATA"
        title="Your financial data stays yours."
        description="Sign in to review local privacy controls and export the data available to this browser."
      />
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">DATA CONTROLS</p>
          <h1>Privacy and data</h1>
          <p className="finance-muted">Review the browser copy, export controls, and account deletion route.</p>
        </div>
        <Link className="finance-secondary-action" href="/settings"><ArrowRight size={15} aria-hidden="true" /> Settings</Link>
      </header>

      <Card className="finance-settings-card">
        <SectionHeader title="Browser storage" action={<ShieldCheck size={18} aria-hidden="true" />} />
        <p>Financial records and pending changes are stored in user-scoped IndexedDB in this browser profile. The browser copy is not separately encrypted by Finapp. Anyone who can use this browser profile may be able to access it.</p>
        <p>The optional passkey screen lock gates the interface only. It is origin and browser-profile scoped and does not provide the native SQLCipher or SecureStore guarantee.</p>
        <Link className="finance-inline-link" href="/privacy">Read the full privacy notes <ArrowRight size={15} aria-hidden="true" /></Link>
      </Card>

      <Card className="finance-settings-card">
        <SectionHeader title="Locally available records" action={<Eye size={18} aria-hidden="true" />} />
        {loading ? (
          <p className="finance-form-note" role="status">Counting saved data…</p>
        ) : (
          <p className="finance-settings-count">
            {accounts.records.length} accounts · {transactions.records.length} transactions · {categories.records.length} categories · {groups.records.length} groups · {settlements.records.length} settlements
          </p>
        )}
        <p>Exports are created only after you request them and contain data currently available to this browser.</p>
        <Link className="finance-secondary-action" href="/settings"><Download size={15} aria-hidden="true" /> Open export controls</Link>
      </Card>

      <Card className="finance-settings-card">
        <SectionHeader title="Account deletion" action={<ShieldCheck size={18} aria-hidden="true" />} />
        <p>Permanent deletion remains support-mediated. Contact support from your verified email to request account deletion.</p>
        <Button variant="outline" onPress={() => window.location.assign('/privacy')}>Review privacy notes</Button>
      </Card>
    </div>
  );
}
