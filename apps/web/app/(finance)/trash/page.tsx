'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  CalendarClock,
  Landmark,
  ReceiptText,
  RotateCcw,
  Settings,
  Tags,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import { SettingsGroup, SettingsHero, SettingsIconButton, SettingsShell } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import styles from './trash.module.css';

type Kind = 'transaction' | 'account' | 'category' | 'budget' | 'goal' | 'recurring';
const KIND_LABEL: Record<Kind, string> = {
  transaction: 'Transactions',
  account: 'Accounts',
  category: 'Categories',
  // Budgets trashed before they became category limits; restoring sets the category's limit.
  budget: 'Old budgets',
  goal: 'Goals',
  recurring: 'Recurring',
};
const KIND_ICON: Record<Kind, React.ComponentType<{ size?: number }>> = {
  transaction: ReceiptText,
  account: Landmark,
  category: Tags,
  budget: Wallet,
  goal: Target,
  recurring: CalendarClock,
};

const errorCopy: Record<string, string> = {
  ACCOUNT_IN_TRASH: 'Restore its account first.',
  NOT_FOUND: 'That item is no longer in Trash.',
};
const messageFor = (cause: unknown) => {
  const raw = cause instanceof Error ? cause.message : '';
  const code = Object.keys(errorCopy).find((key) => raw.includes(key));
  return code ? errorCopy[code]! : 'Something went wrong. Try again.';
};

function remaining(purgeAt: number | null, now: number) {
  if (purgeAt === null) return 'Kept until you delete it';
  const days = Math.max(0, Math.ceil((purgeAt - now) / 86_400_000));
  return days <= 1 ? 'Deleted for good within a day' : `Deleted for good in ${days} days`;
}

/** Trash: restore or permanently delete transactions, accounts, categories, goals, recurring. */
export default function TrashPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const [filter, setFilter] = React.useState<Kind | 'all'>('all');
  const data = useQuery(api.trash.list, live ? {} : 'skip');
  const restore = useMutation(api.trash.restore);
  const purge = useMutation(api.trash.purge);
  const empty = useMutation(api.trash.empty);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  const now = Date.now();
  if (!userId)
    return (
      <FinanceSignedOut
        section="TRASH"
        title="Deleted items wait here."
        description="Sign in to restore or permanently delete what you removed."
      />
    );
  const items = data?.items ?? [];
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});
  const visible = filter === 'all' ? items : items.filter((item) => item.kind === filter);

  const act = async (key: string, run: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setMessage('');
    try {
      await run();
      setMessage(done);
    } catch (cause) {
      setMessage(messageFor(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsShell
      title="Trash"
      subtitle={
        data
          ? data.retentionDays > 0
            ? `Items are deleted for good after ${data.retentionDays} ${data.retentionDays === 1 ? 'day' : 'days'}`
            : 'Items stay until you delete them'
          : 'Deleted items you can restore'
      }
      onBack={() => router.back()}
      actions={
        <SettingsIconButton label="Trash settings" onPress={() => router.push('/settings/trash')}>
          <Settings size={19} aria-hidden="true" />
        </SettingsIconButton>
      }
      wide
    >
      <SettingsHero
        icon={<Trash2 size={24} />}
        title={
          items.length
            ? `${items.length} ${items.length === 1 ? 'item' : 'items'} in Trash`
            : 'Trash is empty'
        }
        description="Restore brings an item back exactly as it was. Chat messages aren’t kept in Trash."
        action={
          items.length ? (
            <button
              type="button"
              className={styles.danger}
              disabled={busy !== null || !live}
              onClick={() => {
                if (!window.confirm('Delete everything in Trash for good? This can’t be undone.'))
                  return;
                void act(
                  'empty',
                  async () => {
                    for (let round = 0; round < 50; round += 1) {
                      const result = await empty({});
                      if (!result.more) break;
                    }
                  },
                  'Trash emptied.',
                );
              }}
            >
              Empty Trash
            </button>
          ) : undefined
        }
      />

      <div className={styles.filters} role="tablist" aria-label="Filter Trash" data-span>
        {(['all', 'transaction', 'account', 'category', 'goal', 'recurring'] as const).map(
          (kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={filter === kind}
              data-active={filter === kind || undefined}
              onClick={() => setFilter(kind)}
            >
              {kind === 'all' ? 'All' : KIND_LABEL[kind]}
              <span>{kind === 'all' ? items.length : (counts[kind] ?? 0)}</span>
            </button>
          ),
        )}
      </div>

      {message ? (
        <p role="status" className={styles.message} data-span>
          {message}
        </p>
      ) : null}

      <SettingsGroup span>
        {data === undefined ? (
          <p className={styles.empty}>
            {live ? 'Loading…' : 'Connect to the internet to open Trash.'}
          </p>
        ) : visible.length ? (
          visible.map((item) => {
            const Icon = KIND_ICON[item.kind as Kind] ?? Trash2;
            const key = `${item.kind}:${item.id}`;
            return (
              <div key={key} className={styles.item}>
                <span className={styles.icon} aria-hidden>
                  <Icon size={18} />
                </span>
                <div className={styles.text}>
                  <strong>{item.title}</strong>
                  <small>
                    {item.subtitle} · {remaining(item.purgeAt, now)}
                  </small>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void act(
                        key,
                        () => restore({ kind: item.kind, id: item.id }),
                        `${item.title} restored.`,
                      )
                    }
                  >
                    <RotateCcw size={15} aria-hidden /> Restore
                  </button>
                  <button
                    type="button"
                    data-danger
                    aria-label={`Delete ${item.title} for good`}
                    disabled={busy !== null}
                    onClick={() => {
                      const extra =
                        item.kind === 'account'
                          ? ' Its transactions are deleted too.'
                          : item.kind === 'goal'
                            ? ' Its contributions are deleted too.'
                            : '';
                      if (
                        !window.confirm(
                          `Delete “${item.title}” for good?${extra} This can’t be undone.`,
                        )
                      )
                        return;
                      void act(
                        key,
                        () => purge({ kind: item.kind, id: item.id }),
                        `${item.title} deleted for good.`,
                      );
                    }}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className={styles.empty}>Nothing here.</p>
        )}
      </SettingsGroup>
    </SettingsShell>
  );
}
