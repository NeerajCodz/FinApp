'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, IconButton, Separator, Text, Typography, useTheme } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { downloadFinanceBackup } from '@/lib/browser/export';

export default function PrivacySettingsPage() {
  const { userId } = useBrowserSync();
  const router = useRouter();
  const { tokens } = useTheme();
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
  const dataError =
    accounts.error ?? transactions.error ?? categories.error ?? groups.error ?? settlements.error;
  if (!userId)
    return (
      <FinanceSignedOut
        section="PRIVACY AND DATA"
        title="Your financial data stays yours."
        description="Sign in to review local privacy controls and export the data available to this browser."
      />
    );

  function exportData() {
    if (loading || dataError || exporting) return;
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
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.push('/settings')}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">Privacy</Typography>
      </header>

      <section style={{ display: 'grid', gap: 12 }}>
        <Typography variant="heading">Your financial values stay private.</Typography>
        <Text style={{ maxWidth: 320 }}>
          Ordinary telemetry never includes balances, amounts, account names, or transaction notes.
        </Text>
      </section>

      <Separator />

      <section style={{ display: 'grid', gap: 12 }}>
        <Typography variant="label">Your data</Typography>
        <Text style={{ maxWidth: 310 }}>
          Export portable CSV files for accounts, transactions, categories, groups, and settlements.
        </Text>
        <Text style={{ maxWidth: 340 }}>
          The browser copy is stored in this browser profile and is not separately encrypted by
          Finapp. Anyone who can use this profile may be able to access it.
        </Text>
        {loading ? (
          <Text role="status">Counting saved data…</Text>
        ) : dataError ? (
          <Text role="alert">Saved data could not be read. Reload before exporting.</Text>
        ) : (
          <Text>
            {accounts.records.length} accounts · {transactions.records.length} transactions ·{' '}
            {categories.records.length} categories · {groups.records.length} groups ·{' '}
            {settlements.records.length} settlements
          </Text>
        )}
        <Button
          variant="outline"
          disabled={loading || !!dataError || exporting}
          onPress={exportData}
          style={{ justifySelf: 'start' }}
        >
          {exporting ? 'Preparing export' : 'Export data'}
        </Button>
        {message && <Text role="status">{message}</Text>}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <Typography variant="label" style={{ color: tokens.destructive }}>
          Account deletion
        </Typography>
        <Text style={{ maxWidth: 310 }}>
          Contact support from your verified email to request permanent deletion.
        </Text>
      </section>
    </div>
  );
}
