'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Eye, ShieldCheck } from 'lucide-react';
import { Button, Card, SectionHeader } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { downloadFinanceBackup } from '@/lib/browser/export';

export default function PrivacySettingsPage() {
  const { userId } = useBrowserSync();
  const [exporting, setExporting] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const accounts = useLocalRecords<LocalRecord>('account');
  const transactions = useLocalRecords<LocalRecord>('transaction');
  const categories = useLocalRecords<LocalRecord>('category');
  const groups = useLocalRecords<LocalRecord>('group');
  const settlements = useLocalRecords<LocalRecord>('settlement');
  const loading =
    accounts.loading ||
    transactions.loading ||
    categories.loading ||
    groups.loading ||
    settlements.loading;
  if (!userId)
    return (
      <FinanceSignedOut
        section="PRIVACY AND DATA"
        title="Your financial data stays yours."
        description="Sign in to review local privacy controls and export the data available to this browser."
      />
    );

  function exportData() {
    if (loading || exporting) return;
    setExporting(true);
    setMessage('');
    try {
      downloadFinanceBackup({
        accounts: accounts.records,
        transactions: transactions.records,
        categories: categories.records,
        groups: groups.records,
        settlements: settlements.records,
      });
      setMessage('Your local data export is ready.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not prepare the export.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">DATA CONTROLS</p>
          <h1>Privacy and export</h1>
          <p className="finance-muted">
            Review the browser copy, export controls, and account deletion route.
          </p>
        </div>
        <Link className="finance-secondary-action" href="/settings">
          <ArrowLeft size={15} aria-hidden="true" /> Settings
        </Link>
      </header>

      <Card className="finance-settings-card">
        <SectionHeader
          title="Browser storage"
          action={<ShieldCheck size={18} aria-hidden="true" />}
        />
        <p>
          Financial records and pending changes are stored in user-scoped IndexedDB in this browser
          profile. The browser copy is not separately encrypted by Finapp. Anyone who can use this
          browser profile may be able to access it. A passkey screen lock gates the interface only;
          it does not encrypt this browser copy.
        </p>
      </Card>

      <Card className="finance-settings-card">
        <SectionHeader
          title="Locally available records"
          action={<Eye size={18} aria-hidden="true" />}
        />
        {loading ? (
          <p className="finance-form-note" role="status">
            Counting saved data…
          </p>
        ) : (
          <p className="finance-settings-count">
            {accounts.records.length} accounts · {transactions.records.length} transactions ·{' '}
            {categories.records.length} categories · {groups.records.length} groups ·{' '}
            {settlements.records.length} settlements
          </p>
        )}
        <p>
          Exports are created only after you request them and contain data currently available to
          this browser.
        </p>
        <Button onPress={exportData} disabled={loading || exporting}>
          <Download size={15} aria-hidden="true" />{' '}
          {exporting ? 'Preparing export…' : 'Export data'}
        </Button>
        {message && (
          <p className="finance-settings-message" role="status">
            {message}
          </p>
        )}
      </Card>

      <Card className="finance-settings-card">
        <SectionHeader
          title="Account deletion"
          action={<ShieldCheck size={18} aria-hidden="true" />}
        />
        <p>
          Permanent deletion remains support-mediated. Contact support from your verified email to
          request account deletion.
        </p>
      </Card>
    </div>
  );
}
