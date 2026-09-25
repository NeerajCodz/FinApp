import React from 'react';
import { AppState } from 'react-native';
import { api } from '@convex/_generated/api';
import { useConvex, useConvexAuth, useConvexConnectionState, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import type { LocalConflict, LocalEntity, LocalRecord, LocalSyncStatus, LocalSyncWindow } from '@/local/repository';
import {
  applyCloudChanges,
  getLocalSyncStatus,
  getSyncCursor,
  getSyncWindow,
  hasCompletedBootstrap,
  listOutbox,
  markBootstrapCompleted,
  getSyncRevision,
  recordCoverage,
  recoverInterruptedSync,
  retryFailed,
  readConflicts,
  setSyncWindow as persistSyncWindow,
  subscribeLocalData,
  upsertCloudPage,
  readLocal,
  getMappedCloudId,
  retryFailedEntry,
  resolveConflict as resolveLocalConflict,
} from '@/local/repository';
import { syncOutbox } from '@/local/sync/engine';
import type { OutboxEntry } from '@/local/outbox/queue';
import { clearValidatedLocalUserId, readValidatedLocalUserId, saveValidatedLocalUserId } from '@/local/identity';
import { deserializeLocalValue } from '@/local/serialization';
import type { FetchCloudGroupRangePage, FetchCloudRangePage } from '@/hooks/useLocalRecords';

const LocalSyncContext = React.createContext<{
  userId: string | null;
  isConnected: boolean;
  isSyncing: boolean;
  status: LocalSyncStatus;
  failedEntries: readonly OutboxEntry[];
  conflicts: readonly LocalConflict[];
  syncError: string | null;
  retryNow: () => Promise<void>;
  retryEntry: (localId: string) => Promise<void>;
  resolveConflict: (conflictId: string, winner: 'local' | 'cloud') => Promise<void>;
  syncWindow: LocalSyncWindow;
  setSyncWindow: (days: LocalSyncWindow) => Promise<void>;
  fetchGroupRange: FetchCloudGroupRangePage;
  fetchTransactionRange: FetchCloudRangePage;
} | null>(null);

const emptyStatus: LocalSyncStatus = {
  pending: 0,
  syncing: 0,
  failed: 0,
  conflicts: 0,
  lastSyncedAt: null,
};
const sectionEntity: Record<string, LocalEntity> = {
  accounts: 'account',
  categories: 'category',
  budgets: 'budget',
  goals: 'goal',
  recurringRules: 'recurringRule',
};
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
const bootstrapSections = ['accounts', 'categories', 'budgets', 'goals', 'recurringRules', 'groupMemberships'] as const;
type ChangesPage = FunctionReturnType<typeof api.sync.queries.changes>;
type TransactionBootstrapPage = FunctionReturnType<typeof api.sync.queries.bootstrapTransactions>;
type GroupRangePage = FunctionReturnType<typeof api.sync.queries.groupRange>;
type SectionBootstrapPage = FunctionReturnType<typeof api.sync.queries.bootstrapSection>;
type TransactionRangePage = FunctionReturnType<typeof api.sync.queries.transactionRange>;

function decodePayload(value: string): Record<string, unknown> {
  return deserializeLocalValue<Record<string, unknown>>(value);
}

async function upsert(
  userId: string,
  entity: LocalEntity,
  records: readonly LocalRecord[] | undefined,
): Promise<void> {
  if (records?.length) await upsertCloudPage(userId, entity, records);
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
  await upsert(userId, 'transaction', page.page);
  await upsert(userId, 'account', page.related.accounts?.filter((record) => record.ownerId === userId));
  await upsert(userId, 'category', page.related.categories?.filter((record) => record.ownerId === userId));
  await upsert(userId, 'group', page.related.groups);
  await upsert(userId, 'expensePayer', page.related.payers);
  await upsert(userId, 'expenseParticipant', page.related.participants);
  await upsert(userId, 'transactionTag', page.related.tags);
  await upsert(userId, 'receiptMetadata', page.related.receipts);
}

async function sendMutation(convex: ReturnType<typeof useConvex>, entry: OutboxEntry): Promise<unknown> {
  const payload = decodePayload(entry.payload) as never;
  switch (entry.operation) {
    case 'account.create': return convex.mutation(api.accounts.mutations.create, payload);
    case 'account.rename': return convex.mutation(api.accounts.mutations.rename, payload);
    case 'account.archive': return convex.mutation(api.accounts.mutations.archive, payload);
    case 'category.create': return convex.mutation(api.categories.mutations.create, payload);
    case 'category.rename': return convex.mutation(api.categories.mutations.rename, payload);
    case 'category.setIcon': return convex.mutation(api.categories.mutations.setIcon, payload);
    case 'category.setLimit': return convex.mutation(api.categories.mutations.setLimit, payload);
    case 'category.archive': return convex.mutation(api.categories.mutations.archive, payload);
    case 'budget.create': return convex.mutation(api.budgets.mutations.create, payload);
    case 'budget.archive': return convex.mutation(api.budgets.mutations.archive, payload);
    case 'transaction.create': return convex.mutation(api.transactions.mutations.create, payload);
    case 'group.create': return convex.mutation(api.groups.mutations.create, payload);
    case 'group.addExpense': return convex.mutation(api.groups.mutations.addExpense, payload);
    case 'user.update': return convex.mutation(api.users.mutations.update, payload);
    case 'user.defaultAccount': return convex.mutation(api.users.mutations.setDefaultAccount, payload);
    case 'user.defaultCategory': return convex.mutation(api.users.mutations.setDefaultCategory, payload);
    default: throw new Error(`UNSUPPORTED_SYNC_OPERATION:${entry.operation}`);
  }
}

export function LocalSyncProvider({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const auth = useConvexAuth();
  const connection = useConvexConnectionState();
  const currentProfile = useQuery(api.users.queries.current, auth.isAuthenticated ? {} : 'skip');
  const [storedUserId, setStoredUserId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(emptyStatus);
  const [failedEntries, setFailedEntries] = React.useState<OutboxEntry[]>([]);
  const [conflicts, setConflicts] = React.useState<LocalConflict[]>([]);
  const [statusUserId, setStatusUserId] = React.useState<string | null>(null);
  const [syncWindow, setSyncWindowState] = React.useState<LocalSyncWindow>(30);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const accountSnapshotsStale = React.useRef(false);
  const running = React.useRef(false);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isConnected = connection.isWebSocketConnected;
  const authenticatedUserId = typeof currentProfile?._id === 'string' ? currentProfile._id : null;
  const userId = authenticatedUserId ?? (!isConnected ? storedUserId : null);
  const validatedOnline = Boolean(auth.isAuthenticated && isConnected && authenticatedUserId);
  const scopedStatus = statusUserId === userId ? status : emptyStatus;
  const scopedFailedEntries = statusUserId === userId ? failedEntries : [];
  const scopedConflicts = statusUserId === userId ? conflicts : [];

  React.useEffect(() => {
    let active = true;
    void readValidatedLocalUserId().then((id) => {
      if (active) setStoredUserId(id);
    });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (!validatedOnline || !authenticatedUserId) return;
    setStoredUserId(authenticatedUserId);
    void saveValidatedLocalUserId(authenticatedUserId);
  }, [authenticatedUserId, validatedOnline]);

  React.useEffect(() => {
    if (!isConnected || auth.isLoading || auth.isAuthenticated) return;
    setStoredUserId(null);
    void clearValidatedLocalUserId();
  }, [auth.isAuthenticated, auth.isLoading, isConnected]);

  React.useEffect(() => {
    if (!userId) {
      setStatus(emptyStatus);
      setSyncWindowState(30);
      setFailedEntries([]);
      setConflicts([]);
      setStatusUserId(null);
      return;
    }
    let active = true;
    const refresh = () => {
      void Promise.all([
        getLocalSyncStatus(userId),
        getSyncWindow(userId),
        listOutbox(userId),
        readConflicts(userId),
      ]).then(([nextStatus, nextWindow, entries, conflictRecords]) => {
        if (active) {
          setStatusUserId(userId);
          setStatus(nextStatus);
          setSyncWindowState(nextWindow);
          setFailedEntries(entries.filter((entry) => entry.status === 'failed'));
          setConflicts(conflictRecords.filter((conflict) => conflict.resolvedAt === null));
        }
      });
    };
    const unsubscribe = subscribeLocalData(userId, refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const pullChanges = React.useCallback(async (targetUserId: string) => {
    let cursor = await getSyncCursor(targetUserId);
    let transactionsChanged = false;
    while (true) {
      const page: ChangesPage = await convex.query(api.sync.queries.changes, {
        paginationOpts: { numItems: 100, cursor },
      });
      transactionsChanged ||= page.page.some((change) => change.entityType === 'transactions');
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
      if (!page.continueCursor || page.continueCursor === cursor) throw new Error('INVALID_SYNC_CURSOR');
      cursor = page.continueCursor;
    }
    if (transactionsChanged) accountSnapshotsStale.current = true;
    if (!accountSnapshotsStale.current) return;
    let accountCursor: string | null = null;
    while (true) {
      const page = await convex.query(api.sync.queries.bootstrapSection, {
        section: 'accounts',
        paginationOpts: { numItems: 100, cursor: accountCursor },
      }) as unknown as Extract<SectionBootstrapPage, { section: 'accounts' }>;
      await upsertCloudPage(targetUserId, 'account', page.page as LocalRecord[]);
      await upsert(targetUserId, 'accountMember', page.related as LocalRecord[]);
      if (page.isDone) {
        accountSnapshotsStale.current = false;
        return;
      }
      if (!page.continueCursor || page.continueCursor === accountCursor)
        throw new Error('INVALID_SYNC_CURSOR');
      accountCursor = page.continueCursor;
    }
  }, [convex]);

  const bootstrapRange = React.useCallback(async (targetUserId: string, days: LocalSyncWindow) => {
    const endAt = Date.now();
    const startAt = days === 'all' ? 0 : endAt - days * 86_400_000;
    let cursor: string | null = null;
    while (true) {
      const page: TransactionBootstrapPage = await convex.query(api.sync.queries.bootstrapTransactions, {
        windowDays: days === 'all' ? -1 : days,
        paginationOpts: { numItems: 100, cursor },
      });
      await persistTransactionPage(targetUserId, page);
      if (page.isDone) break;
      if (!page.continueCursor || page.continueCursor === cursor) throw new Error('INVALID_SYNC_CURSOR');
      cursor = page.continueCursor;
    }
    await recordCoverage(targetUserId, 'transactions', startAt, endAt);

    const groups = await upsertAndReadGroupIds(targetUserId);
    for (const groupId of groups) {
      let transactionCursor: string | null = null;
      let settlementCursor: string | null = null;
      let transactionDone = false;
      let settlementDone = false;
      while (!transactionDone || !settlementDone) {
        const page: GroupRangePage = await convex.query(api.sync.queries.groupRange, {
          groupId: groupId as never,
          startAt,
          endAt,
          paginationOpts: { numItems: 100, cursor: transactionCursor },
          settlementPaginationOpts: { numItems: 100, cursor: settlementCursor },
        });
        await upsert(targetUserId, 'group', page.group ? [page.group] : []);
        await upsert(targetUserId, 'groupMember', page.groupMembers);
        await upsert(targetUserId, 'transaction', page.transactions.page);
        await upsert(targetUserId, 'settlement', page.settlements.page);
        await persistTransactionPage(targetUserId, { page: [], related: page.related });
        transactionDone = page.transactions.isDone;
        settlementDone = page.settlements.isDone;
        if (!transactionDone) {
          if (!page.transactions.continueCursor || page.transactions.continueCursor === transactionCursor)
            throw new Error('INVALID_SYNC_CURSOR');
          transactionCursor = page.transactions.continueCursor;
        }
        if (!settlementDone) {
          if (!page.settlements.continueCursor || page.settlements.continueCursor === settlementCursor)
            throw new Error('INVALID_SYNC_CURSOR');
          settlementCursor = page.settlements.continueCursor;
        }
      }
      await recordCoverage(targetUserId, `group:${groupId}`, startAt, endAt);
    }
  }, [convex]);

  const bootstrap = React.useCallback(async (targetUserId: string, days: LocalSyncWindow) => {
    const complete = await hasCompletedBootstrap(targetUserId);
    if (!complete) {
      const identity = await convex.query(api.sync.queries.bootstrapIdentity, {});
      await upsertCloudPage(targetUserId, 'profile', [identity.profile as LocalRecord]);
      if (identity.settings) await upsertCloudPage(targetUserId, 'settings', [identity.settings as LocalRecord]);
      for (const section of bootstrapSections) {
        let cursor: string | null = null;
        while (true) {
          const page: SectionBootstrapPage = await convex.query(api.sync.queries.bootstrapSection, {
            section,
            paginationOpts: { numItems: 100, cursor },
          });
          const primaryType = sectionEntity[section];
          if (primaryType) await upsertCloudPage(targetUserId, primaryType, page.page as LocalRecord[]);
          if (page.section === 'accounts') {
            await upsert(targetUserId, 'accountMember', page.related as LocalRecord[]);
          } else if (page.section === 'groupMemberships') {
            const related = page.related as {
              groups: LocalRecord[];
              members: LocalRecord[];
              invites: LocalRecord[];
              expenses: LocalRecord[];
              settlements: LocalRecord[];
            };
            await upsert(targetUserId, 'group', related.groups);
            await upsert(targetUserId, 'groupMember', related.members);
            await upsert(targetUserId, 'groupInvite', related.invites);
            await upsert(targetUserId, 'transaction', related.expenses);
            await upsert(targetUserId, 'settlement', related.settlements);
          }
          if (page.isDone) break;
          if (!page.continueCursor || page.continueCursor === cursor) throw new Error('INVALID_SYNC_CURSOR');
          cursor = page.continueCursor;
        }
      }
      await bootstrapRange(targetUserId, days);
      await pullChanges(targetUserId);
      await markBootstrapCompleted(targetUserId);
      return;
    }
    await bootstrapRange(targetUserId, days);
  }, [bootstrapRange, convex, pullChanges]);

  const runOutboxEntry = React.useCallback(async (targetUserId: string, entry: OutboxEntry) => {
    if (entry.operation === 'sync.bootstrap') {
      const payload = decodePayload(entry.payload);
      const days = payload.days as LocalSyncWindow;
      await bootstrap(targetUserId, days);
      await pullChanges(targetUserId);
      const revision = await getSyncRevision(targetUserId);
      return {
        serverId: targetUserId,
        revision,
        updatedAt: Date.now(),
      };
    }
    await sendMutation(convex, entry);
    const receipt = await convex.query(api.sync.queries.mutationReceipt, {
      clientMutationId: entry.clientMutationId,
    });
    if (!receipt?.serverId || !receipt.revision || receipt.updatedAt === null)
      throw new Error('SYNC_RECEIPT_REQUIRED');
    return {
      serverId: receipt.serverId,
      revision: receipt.revision,
      updatedAt: receipt.updatedAt,
    };
  }, [bootstrap, convex, pullChanges]);

  const flush = React.useCallback(async () => {
    if (!userId || !validatedOnline || running.current) return;
    running.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await recoverInterruptedSync(userId);
      if (!(await hasCompletedBootstrap(userId))) await bootstrap(userId, await getSyncWindow(userId));
      await pullChanges(userId);
      await syncOutbox(userId, await listOutbox(userId), (entry) => runOutboxEntry(userId, entry));
      await pullChanges(userId);
      const pending = await listOutbox(userId);
      const nextRetryAt = pending
        .filter((entry) => entry.status === 'failed' && entry.nextRetryAt !== undefined)
        .reduce<number | null>((soonest, entry) =>
          soonest === null ? entry.nextRetryAt! : Math.min(soonest, entry.nextRetryAt!), null);
      clearTimeout(retryTimer.current);
      if (nextRetryAt !== null) {
        retryTimer.current = setTimeout(() => { void flush(); }, Math.max(0, nextRetryAt - Date.now()));
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'SYNC_FAILED');
    } finally {
      running.current = false;
      setIsSyncing(false);
    }
  }, [bootstrap, pullChanges, runOutboxEntry, userId, validatedOnline]);

  const retryNow = React.useCallback(async () => {
    if (!userId) return;
    await retryFailed(userId);
    await flush();
  }, [flush, userId]);

  const retryEntry = React.useCallback(async (localId: string) => {
    if (!userId) return;
    await retryFailedEntry(userId, localId);
    await flush();
  }, [flush, userId]);

  const chooseConflictVersion = React.useCallback(async (
    conflictId: string,
    winner: 'local' | 'cloud',
  ) => {
    if (!userId) return;
    await resolveLocalConflict(userId, conflictId, winner);
    await flush();
  }, [flush, userId]);

  const changeWindow = React.useCallback(async (days: LocalSyncWindow) => {
    if (!userId) throw new Error('AUTH_REQUIRED');
    await persistSyncWindow(userId, days);
    setSyncWindowState(days);
    if (validatedOnline) await flush();
  }, [flush, userId, validatedOnline]);

  const fetchTransactionRange = React.useCallback<FetchCloudRangePage>(async ({ startAt, endAt, cursor }) => {
    if (!validatedOnline) throw new Error('SYNC_OFFLINE');
    const page: TransactionRangePage = await convex.query(api.sync.queries.transactionRange, {
      startAt,
      endAt,
      paginationOpts: { numItems: 100, cursor },
    });
    const records: Partial<Record<LocalEntity, readonly LocalRecord[]>> = {
      transaction: page.page,
      account: page.related.accounts.filter((record) => record.ownerId === userId),
      category: page.related.categories.filter((record) => record.ownerId === userId),
      group: page.related.groups,
      expensePayer: page.related.payers,
      expenseParticipant: page.related.participants,
      transactionTag: page.related.tags,
      receiptMetadata: page.related.receipts,
    };
    return { records, cursor: page.continueCursor, isDone: page.isDone };
  }, [convex, userId, validatedOnline]);

  const fetchGroupRange = React.useCallback<FetchCloudGroupRangePage>(async ({
    groupId, startAt, endAt, transactionCursor, settlementCursor,
  }) => {
    const mappedGroupId = userId
      ? await getMappedCloudId(userId, 'group', groupId)
      : null;
    if (!validatedOnline) throw new Error('SYNC_OFFLINE');
    if (groupId.startsWith('local-') && !mappedGroupId) throw new Error('SYNC_PARENT_PENDING');
    const page: GroupRangePage = await convex.query(api.sync.queries.groupRange, {
      groupId: (mappedGroupId ?? groupId) as never,
      startAt,
      endAt,
      paginationOpts: { numItems: 100, cursor: transactionCursor },
      settlementPaginationOpts: { numItems: 100, cursor: settlementCursor },
    });
    const records: Partial<Record<LocalEntity, readonly LocalRecord[]>> = {
      group: page.group ? [page.group] : [],
      groupMember: page.groupMembers,
      transaction: page.transactions.page,
      settlement: page.settlements.page,
      account: page.related.accounts.filter((account) => account.ownerId === userId),
      category: page.related.categories.filter((category) => category.ownerId === userId),
      expensePayer: page.related.payers,
      expenseParticipant: page.related.participants,
      transactionTag: page.related.tags,
      receiptMetadata: page.related.receipts,
    };
    return {
      records,
      transactionCursor: page.transactions.continueCursor,
      settlementCursor: page.settlements.continueCursor,
      transactionsDone: page.transactions.isDone,
      settlementsDone: page.settlements.isDone,
    };
  }, [convex, userId, validatedOnline]);

  React.useEffect(() => {
    if (validatedOnline) void flush();
  }, [flush, validatedOnline]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && validatedOnline) void flush();
    });
    return () => subscription.remove();
  }, [flush, validatedOnline]);

  React.useEffect(() => () => clearTimeout(retryTimer.current), []);

  return (
    <LocalSyncContext.Provider value={{
      userId,
      isConnected,
      isSyncing,
      status: scopedStatus,
      failedEntries: scopedFailedEntries,
      conflicts: scopedConflicts,
      syncError: statusUserId === userId ? syncError : null,
      retryNow,
      retryEntry,
      resolveConflict: chooseConflictVersion,
      syncWindow,
      setSyncWindow: changeWindow,
      fetchTransactionRange,
      fetchGroupRange,
    }}>
      {children}
    </LocalSyncContext.Provider>
  );
}

async function upsertAndReadGroupIds(userId: string): Promise<string[]> {
  const groups = await readLocal<LocalRecord>(userId, 'group');
  return groups
    .map((group) => String(group.cloudId ?? group._id ?? ''))
    .filter((groupId) => groupId.length > 0 && !groupId.startsWith('local-'));
}


export function useLocalSync() {
  const context = React.useContext(LocalSyncContext);
  if (!context) throw new Error('LOCAL_SYNC_PROVIDER_REQUIRED');
  return context;
}
