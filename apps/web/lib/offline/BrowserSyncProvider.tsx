'use client';

import React from 'react';
import { api } from '@convex/_generated/api';
import { useConvex, useConvexAuth, useConvexConnectionState, useQuery } from 'convex/react';
import type { ConvexReactClient } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import type {
  LocalEntity,
  LocalRecord,
  LocalSyncStatus,
  OutboxEntry,
  SyncReceipt,
} from './repository';
import {
  applyCloudChanges,
  getLocalSyncStatus,
  getMappedCloudId,
  getSyncCursor,
  hasCompletedBootstrap,
  listOutbox,
  markBootstrapCompleted,
  readLocal,
  retryFailed,
  subscribeLocalData,
  upsertCloudPage,
} from './repository';
import { syncOutbox } from './sync';

type ChangesPage = FunctionReturnType<typeof api.sync.queries.changes>;
type SectionBootstrapPage = FunctionReturnType<typeof api.sync.queries.bootstrapSection>;
type TransactionBootstrapPage = FunctionReturnType<typeof api.sync.queries.bootstrapTransactions>;

const localUserKey = 'finapp.web.validated-user.v1';
const cloudEntity: Record<string, LocalEntity> = {
  users: 'profile',
  userSettings: 'settings',
  accounts: 'account',
  accountMembers: 'accountMember',
  categories: 'category',
  transactions: 'transaction',
  transactionTags: 'transactionTag',
  groups: 'group',
  groupMembers: 'groupMember',
  groupInvites: 'groupInvite',
  expensePayers: 'expensePayer',
  expenseParticipants: 'expenseParticipant',
  settlements: 'settlement',
  budgets: 'budget',
  goals: 'goal',
  goalContributions: 'goalContribution',
  recurringRules: 'recurringRule',
  notifications: 'notification',
  receipts: 'receiptMetadata',
};
const bootstrapSections = [
  'accounts',
  'categories',
  'budgets',
  'goals',
  'goalContributions',
  'recurringRules',
  'notifications',
  'groupMemberships',
] as const;
const emptyStatus: LocalSyncStatus = {
  pending: 0,
  syncing: 0,
  failed: 0,
  conflicts: 0,
  lastSyncedAt: null,
};

type BrowserSyncContextValue = {
  userId: string | null;
  isConnected: boolean;
  isSyncing: boolean;
  syncError: string | null;
  status: LocalSyncStatus;
  retryNow: () => Promise<void>;
  read: <T extends LocalRecord = LocalRecord>(entityType: LocalEntity) => Promise<T[]>;
};
const BrowserSyncContext = React.createContext<BrowserSyncContextValue | null>(null);

async function upsert(
  userId: string,
  entityType: LocalEntity,
  records: readonly LocalRecord[] | undefined,
): Promise<void> {
  if (records?.length) await upsertCloudPage(userId, entityType, records);
}

async function persistTransactionPage(
  userId: string,
  page: {
    page: readonly LocalRecord[];
    related: {
      accounts: readonly LocalRecord[];
      categories: readonly LocalRecord[];
      groups: readonly LocalRecord[];
      payers: readonly LocalRecord[];
      participants: readonly LocalRecord[];
      tags: readonly LocalRecord[];
      receipts: readonly LocalRecord[];
    };
  },
): Promise<void> {
  await Promise.all([
    upsert(userId, 'transaction', page.page),
    upsert(
      userId,
      'account',
      page.related.accounts.filter((record) => record.ownerId === userId),
    ),
    upsert(
      userId,
      'category',
      page.related.categories.filter((record) => record.ownerId === userId),
    ),
    upsert(userId, 'group', page.related.groups),
    upsert(userId, 'expensePayer', page.related.payers),
    upsert(userId, 'expenseParticipant', page.related.participants),
    upsert(userId, 'transactionTag', page.related.tags),
    upsert(userId, 'receiptMetadata', page.related.receipts),
  ]);
}

async function sendMutation(
  convex: ConvexReactClient,
  userId: string,
  entry: OutboxEntry,
): Promise<void> {
  const payload = entry.payload;
  const mapId = async (entity: LocalEntity, id: unknown): Promise<string> => {
    const value = String(id ?? '');
    return (await getMappedCloudId(userId, entity, value)) ?? value;
  };
  switch (entry.operation) {
    case 'account.create':
      await convex.mutation(api.accounts.mutations.create, payload as never);
      return;
    case 'account.rename':
      await convex.mutation(api.accounts.mutations.rename, payload as never);
      return;
    case 'account.archive':
      await convex.mutation(api.accounts.mutations.archive, payload as never);
      return;
    case 'category.create':
      await convex.mutation(api.categories.mutations.create, payload as never);
      return;
    case 'category.rename':
      await convex.mutation(api.categories.mutations.rename, payload as never);
      return;
    case 'category.setIcon':
      await convex.mutation(api.categories.mutations.setIcon, payload as never);
      return;
    case 'category.setLimit':
      await convex.mutation(api.categories.mutations.setLimit, payload as never);
      return;
    case 'category.archive':
      await convex.mutation(api.categories.mutations.archive, payload as never);
      return;
    case 'budget.create': {
      const categoryId = typeof payload.categoryId === 'string' ? payload.categoryId : null;
      const accountId = typeof payload.accountId === 'string' ? payload.accountId : null;
      await convex.mutation(api.budgets.mutations.create, {
        ...payload,
        ...(categoryId ? { categoryId: await mapId('category', categoryId) } : {}),
        ...(accountId ? { accountId: await mapId('account', accountId) } : {}),
      } as never);
      return;
    }
    case 'budget.archive':
      await convex.mutation(api.budgets.mutations.archive, payload as never);
      return;
    case 'transaction.create': {
      const categoryId = typeof payload.categoryId === 'string' ? payload.categoryId : null;
      const transferAccountId =
        typeof payload.transferAccountId === 'string' ? payload.transferAccountId : null;
      await convex.mutation(api.transactions.mutations.create, {
        ...payload,
        accountId: await mapId('account', payload.accountId),
        ...(categoryId ? { categoryId: await mapId('category', categoryId) } : {}),
        ...(transferAccountId
          ? { transferAccountId: await mapId('account', transferAccountId) }
          : {}),
      } as never);
      return;
    }
    case 'group.create':
      await convex.mutation(api.groups.mutations.create, payload as never);
      return;
    case 'group.update':
      await convex.mutation(api.groups.mutations.updateSettings, {
        ...payload,
        groupId: await mapId('group', payload.groupId),
      } as never);
      return;
    case 'group.setMemberRole':
      await convex.mutation(api.groups.mutations.setMemberRole, {
        ...payload,
        groupId: await mapId('group', payload.groupId),
      } as never);
      return;
    case 'group.addExpense':
      await convex.mutation(api.groups.mutations.addExpense, {
        ...payload,
        groupId: await mapId('group', payload.groupId),
        accountId: await mapId('account', payload.accountId),
      } as never);
      return;
    case 'settlement.create':
      await convex.mutation(api.settlements.mutations.create, {
        ...payload,
        groupId: await mapId('group', payload.groupId),
        accountId: await mapId('account', payload.accountId),
      } as never);
      return;
    case 'goal.create':
      await convex.mutation(api.goals.mutations.create, payload as never);
      return;
    case 'goal.contribute':
      await convex.mutation(api.goals.mutations.contribute, {
        ...payload,
        goalId: await mapId('goal', payload.goalId),
      } as never);
      return;
    case 'recurring.create':
      await convex.mutation(api.recurring.mutations.create, {
        ...payload,
        accountId: await mapId('account', payload.accountId),
      } as never);
      return;
    case 'recurring.setEnabled':
      await convex.mutation(api.recurring.mutations.setEnabled, {
        ...payload,
        ruleId: await mapId('recurringRule', payload.ruleId),
      } as never);
      return;
    case 'notification.preferences':
      await convex.mutation(api.notifications.mutations.setPreferences, payload as never);
      return;
    case 'notification.markRead':
      await convex.mutation(api.notifications.mutations.markRead, {
        ...payload,
        notificationId: await mapId('notification', payload.notificationId),
      } as never);
      return;
    case 'user.update':
      await convex.mutation(api.users.mutations.update, payload as never);
      return;
    case 'user.defaultAccount':
      await convex.mutation(api.users.mutations.setDefaultAccount, payload as never);
      return;
    case 'user.defaultCategory':
      await convex.mutation(api.users.mutations.setDefaultCategory, payload as never);
      return;
    default:
      throw new Error(`UNSUPPORTED_SYNC_OPERATION:${entry.operation}`);
  }
}

export function BrowserSyncProvider({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const auth = useConvexAuth();
  const connection = useConvexConnectionState();
  const currentProfile = useQuery(api.users.queries.current, auth.isAuthenticated ? {} : 'skip');
  const [storedUserId, setStoredUserId] = React.useState<string | null>(null);
  const [online, setOnline] = React.useState(false);
  const [status, setStatus] = React.useState(emptyStatus);
  const [statusUserId, setStatusUserId] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const running = React.useRef(false);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isConnected = online && connection.isWebSocketConnected;
  const authenticatedUserId = typeof currentProfile?._id === 'string' ? currentProfile._id : null;
  const userId = authenticatedUserId ?? (!isConnected ? storedUserId : null);
  const validatedOnline = Boolean(auth.isAuthenticated && isConnected && authenticatedUserId);
  const scopedStatus = statusUserId === userId ? status : emptyStatus;

  React.useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  React.useEffect(() => {
    setStoredUserId(window.localStorage.getItem(localUserKey));
  }, []);

  React.useEffect(() => {
    if (!validatedOnline || !authenticatedUserId) return;
    window.localStorage.setItem(localUserKey, authenticatedUserId);
    setStoredUserId(authenticatedUserId);
  }, [authenticatedUserId, validatedOnline]);

  React.useEffect(() => {
    if (!isConnected || auth.isLoading || auth.isAuthenticated) return;
    window.localStorage.removeItem(localUserKey);
    setStoredUserId(null);
  }, [auth.isAuthenticated, auth.isLoading, isConnected]);

  const pullChanges = React.useCallback(
    async (targetUserId: string) => {
      let cursor = await getSyncCursor(targetUserId);
      let accountSnapshotsStale = false;
      while (true) {
        const page: ChangesPage = await convex.query(api.sync.queries.changes, {
          paginationOpts: { numItems: 100, cursor },
        });
        accountSnapshotsStale ||= page.page.some((change) => change.entityType === 'transactions');
        const changes = page.page.map((change) => {
          const entityType = cloudEntity[change.entityType];
          if (!entityType) throw new Error(`UNSUPPORTED_SYNC_ENTITY:${change.entityType}`);
          return {
            entityType,
            documentId: String(change.documentId),
            revision: change.revision.toString(),
            updatedAt: change.updatedAt,
            deletedAt: change.deletedAt,
            document: change.document as LocalRecord | undefined,
          };
        });
        await applyCloudChanges(targetUserId, changes, page.continueCursor);
        if (page.isDone) break;
        if (!page.continueCursor || page.continueCursor === cursor)
          throw new Error('INVALID_SYNC_CURSOR');
        cursor = page.continueCursor;
      }
      if (accountSnapshotsStale) {
        let accountCursor: string | null = null;
        while (true) {
          const page: SectionBootstrapPage = await convex.query(api.sync.queries.bootstrapSection, {
            section: 'accounts',
            paginationOpts: { numItems: 100, cursor: accountCursor },
          });
          if (page.section !== 'accounts') throw new Error('INVALID_ACCOUNT_SNAPSHOT');
          await upsert(targetUserId, 'account', page.page as LocalRecord[]);
          await upsert(targetUserId, 'accountMember', page.related as LocalRecord[]);
          if (page.isDone) break;
          if (!page.continueCursor || page.continueCursor === accountCursor)
            throw new Error('INVALID_SYNC_CURSOR');
          accountCursor = page.continueCursor;
        }
      }
    },
    [convex],
  );

  const bootstrap = React.useCallback(
    async (targetUserId: string) => {
      const identity = await convex.query(api.sync.queries.bootstrapIdentity, {});
      await upsert(targetUserId, 'profile', [identity.profile as LocalRecord]);
      if (identity.settings)
        await upsert(targetUserId, 'settings', [identity.settings as LocalRecord]);

      for (const section of bootstrapSections) {
        let cursor: string | null = null;
        while (true) {
          const page: SectionBootstrapPage = await convex.query(api.sync.queries.bootstrapSection, {
            section,
            paginationOpts: { numItems: 100, cursor },
          });
          if (page.section === 'accounts') {
            await upsert(targetUserId, 'account', page.page as LocalRecord[]);
            await upsert(targetUserId, 'accountMember', page.related as LocalRecord[]);
          } else if (page.section === 'groupMemberships') {
            await Promise.all([
              upsert(targetUserId, 'group', page.related.groups as LocalRecord[]),
              upsert(targetUserId, 'groupMember', page.related.members as LocalRecord[]),
              upsert(targetUserId, 'groupInvite', page.related.invites as LocalRecord[]),
              upsert(targetUserId, 'transaction', page.related.expenses as LocalRecord[]),
              upsert(targetUserId, 'settlement', page.related.settlements as LocalRecord[]),
            ]);
          } else {
            const entityType =
              section === 'categories'
                ? 'category'
                : section === 'budgets'
                  ? 'budget'
                  : section === 'goals'
                    ? 'goal'
                    : section === 'goalContributions'
                      ? 'goalContribution'
                      : section === 'recurringRules'
                        ? 'recurringRule'
                        : 'notification';
            await upsert(targetUserId, entityType, page.page as LocalRecord[]);
          }
          if (page.isDone) break;
          if (!page.continueCursor || page.continueCursor === cursor)
            throw new Error('INVALID_SYNC_CURSOR');
          cursor = page.continueCursor;
        }
      }

      let cursor: string | null = null;
      while (true) {
        const page: TransactionBootstrapPage = await convex.query(
          api.sync.queries.bootstrapTransactions,
          {
            windowDays: 30,
            paginationOpts: { numItems: 100, cursor },
          },
        );
        await persistTransactionPage(targetUserId, page);
        if (page.isDone) break;
        if (!page.continueCursor || page.continueCursor === cursor)
          throw new Error('INVALID_SYNC_CURSOR');
        cursor = page.continueCursor;
      }
      await pullChanges(targetUserId);
      await markBootstrapCompleted(targetUserId);
    },
    [convex, pullChanges],
  );

  const runOutboxEntry = React.useCallback(
    async (targetUserId: string, entry: OutboxEntry): Promise<SyncReceipt> => {
      await sendMutation(convex, targetUserId, entry);
      const receipt = await convex.query(api.sync.queries.mutationReceipt, {
        clientMutationId: entry.clientMutationId,
      });
      if (!receipt?.serverId || !receipt.revision || receipt.updatedAt === null)
        throw new Error('SYNC_RECEIPT_REQUIRED');
      return {
        serverId: String(receipt.serverId),
        revision: String(receipt.revision),
        updatedAt: receipt.updatedAt,
      };
    },
    [convex],
  );

  const flush = React.useCallback(async () => {
    if (!userId || !validatedOnline || running.current) return;
    running.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      if (!(await hasCompletedBootstrap(userId))) await bootstrap(userId);
      await pullChanges(userId);
      await syncOutbox(userId, (entry) => runOutboxEntry(userId, entry));
      await pullChanges(userId);
      const entries = await listOutbox(userId);
      const nextRetryAt = entries
        .filter((entry) => entry.status === 'failed' && entry.nextRetryAt !== undefined)
        .reduce<number | null>(
          (soonest, entry) =>
            soonest === null ? entry.nextRetryAt! : Math.min(soonest, entry.nextRetryAt!),
          null,
        );
      clearTimeout(retryTimer.current);
      if (nextRetryAt !== null)
        retryTimer.current = setTimeout(() => void flush(), Math.max(0, nextRetryAt - Date.now()));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'SYNC_FAILED');
    } finally {
      running.current = false;
      setIsSyncing(false);
    }
  }, [bootstrap, pullChanges, runOutboxEntry, userId, validatedOnline]);

  React.useEffect(() => {
    if (validatedOnline) void flush();
  }, [flush, validatedOnline]);

  React.useEffect(() => {
    if (validatedOnline && scopedStatus.pending > 0) void flush();
  }, [flush, scopedStatus.pending, validatedOnline]);

  React.useEffect(() => {
    if (!userId) {
      setStatus(emptyStatus);
      setStatusUserId(null);
      return;
    }
    let active = true;
    const refresh = () => {
      void getLocalSyncStatus(userId)
        .then((next) => {
          if (active) {
            setStatus(next);
            setStatusUserId(userId);
          }
        })
        .catch((error: unknown) => {
          if (active) setSyncError(error instanceof Error ? error.message : 'LOCAL_STORAGE_FAILED');
        });
    };
    const unsubscribe = subscribeLocalData(userId, refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  React.useEffect(() => {
    const wake = () => {
      if (validatedOnline) void flush();
    };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [flush, validatedOnline]);

  React.useEffect(() => () => clearTimeout(retryTimer.current), []);

  const retryNow = React.useCallback(async () => {
    if (!userId) return;
    await retryFailed(userId);
    await flush();
  }, [flush, userId]);

  const value = React.useMemo<BrowserSyncContextValue>(
    () => ({
      userId,
      isConnected,
      isSyncing,
      syncError: statusUserId === userId ? syncError : null,
      status: scopedStatus,
      retryNow,
      read: <T extends LocalRecord = LocalRecord>(entityType: LocalEntity) =>
        userId ? readLocal<T>(userId, entityType) : Promise.resolve([]),
    }),
    [isConnected, isSyncing, retryNow, scopedStatus, statusUserId, syncError, userId],
  );

  return <BrowserSyncContext.Provider value={value}>{children}</BrowserSyncContext.Provider>;
}

export function useBrowserSync(): BrowserSyncContextValue {
  const context = React.useContext(BrowserSyncContext);
  if (!context) throw new Error('BROWSER_SYNC_PROVIDER_REQUIRED');
  return context;
}
