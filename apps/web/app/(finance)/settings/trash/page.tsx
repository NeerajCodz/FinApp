'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Trash2 } from 'lucide-react';
import { SettingsChoice, SettingsGroup, SettingsLink, SettingsShell } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

const OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '0', label: 'Never' },
] as const;

/** How long deleted items stay in Trash before they're deleted for good. */
export default function TrashSettingsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const data = useQuery(api.trash.list, live ? {} : 'skip');
  const setRetention = useMutation(api.trash.setRetention);
  const [value, setValue] = React.useState<string | null>(null);
  const current = value ?? (data ? String(data.retentionDays) : '30');
  return (
    <SettingsShell
      title="Trash"
      subtitle="Deleted transactions, accounts, categories, budgets, goals and recurring items"
      onBack={() => router.push('/settings')}
    >
      <SettingsGroup title="Automatic cleanup">
        <SettingsChoice
          title="Delete items for good after"
          description="Checked every day. “Never” keeps everything until you empty Trash."
          value={current as (typeof OPTIONS)[number]['value']}
          disabled={!live || !data}
          options={OPTIONS}
          onChange={async (next) => {
            const previous = current;
            setValue(next);
            try {
              await setRetention({ days: Number(next) });
            } catch {
              setValue(previous);
            }
          }}
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsLink
          icon={<Trash2 size={19} />}
          tone="danger"
          title="Open Trash"
          description={data ? `${data.items.length} items` : undefined}
          onPress={() => router.push('/trash')}
        />
      </SettingsGroup>
    </SettingsShell>
  );
}
