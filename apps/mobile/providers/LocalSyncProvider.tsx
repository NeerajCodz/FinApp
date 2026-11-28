import React from 'react';
import { isExpoGo } from '@/local/runtime';
import { AppState, Platform } from 'react-native';
import type { NotificationResponse } from 'expo-notifications';
import { appPathForNotificationUrl } from '@/lib/push';
import { router } from 'expo-router';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { GroupSettlementRangeResult, GroupTransactionRangeResult } from '@convex/sync/types';
import { useConvex, useConvexAuth, useConvexConnectionState, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import type {
  LocalConflict,
  LocalEntity,
  LocalRecord,
  LocalSyncStatus,
  LocalSyncWindow,
} from '@/local/repository';
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
import { putLocalNotification } from '@/local/repository';
import {
  clearDeviceReminders,
  markNotificationAsRead,
  reconcileRecurringNotifications,
  type NotificationRecord,
} from '@/local/notification-events';
import { retryPushReadQueue } from '@/local/pushReadQueue';
import { normalizeNotificationPreferences } from '@convex/notifications/domain';
import { syncOutbox } from '@/local/sync/engine';
import {
  deleteGroupExpense,
  removeSettlement,
  updateGroupExpense,
  type GroupExpenseUpdateRequest,
  type GroupWriteResult,
} from '@/local/groupExpenseActions';
import { describeSyncError } from '@finapp/ui/finance/sync-errors';
import type { OutboxEntry } from '@/local/outbox/queue';
import {
  clearValidatedLocalUserId,
  readValidatedLocalUserId,
  saveValidatedLocalUserId,
} from '@/local/identity';
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
  /** Edits a group expense: direct when online, otherwise optimistic and queued. */
  updateGroupExpense: (request: GroupExpenseUpdateRequest) => Promise<GroupWriteResult>;
  /** Soft-deletes a group expense: direct when online, otherwise optimistic and queued. */
  deleteGroupExpense: (transaction: LocalRecord) => Promise<GroupWriteResult>;
  /** Undoes a recorded payment (record or any id); optimistic and queued, works offline. */
  removeSettlement: (settlement: string | LocalRecord) => Promise<GroupWriteResult>;
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
  goalContributions: 'goalContribution',
  recurringRules: 'recurringRule',
  notifications: 'notification',
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
const bootstrapSections = [
  'accounts',
  'categories',
  'goals',
  'goalContributions',
  'recurringRules',
  'notifications',
  'groupMemberships',
] as const;
type ChangesPage = FunctionReturnType<typeof api.sync.queries.changes>;
type TransactionBootstrapPage = FunctionReturnType<typeof api.sync.queries.bootstrapTransactions>;
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
  await upsert(
    userId,
    'account',
    page.related.accounts?.filter((record) => record.ownerId === userId),
  );
  await upsert(
    userId,
    'category',
    page.related.categories?.filter((record) => record.ownerId === userId),
  );
  await upsert(userId, 'group', page.related.groups);
  await upsert(userId, 'expensePayer', page.related.payers);
  await upsert(userId, 'expenseParticipant', page.related.participants);
  await upsert(userId, 'transactionTag', page.related.tags);
  await upsert(userId, 'receiptMetadata', page.related.receipts);
}

async function sendMutation(
  convex: ReturnType<typeof useConvex>,
  userId: string,
  entry: OutboxEntry,
): Promise<unknown> {
  const payload = decodePayload(entry.payload) as Record<string, unknown>;
  const mapId = async (entity: LocalEntity, id: unknown): Promise<string> => {
    const value = String(id ?? '');
    return (await getMappedCloudId(userId, entity, value)) ?? value;
  };
  switch (entry.operation) {
    case 'account.create':
      return convex.mutation(api.accounts.mutations.create, payload as never);
    case 'account.rename':
      return convex.mutation(api.accounts.mutations.rename, {
        ...payload,
        accountId: await mapId('account', payload.accountId),
      } as never);
    case 'account.updateDetails': {
      const accountId = String(payload.accountId);
      const mappedAccountId = await getMappedCloudId(userId, 'account', accountId);
      return convex.mutation(api.accounts.mutations.updateDetails, {
        ...payload,
        accountId: mappedAccountId ?? accountId,
      } as never);
    }
    case 'account.setIcon': {
      const accountId = String(payload.accountId);
      const mappedAccountId = await getMappedCloudId(userId, 'account', accountId);
      return convex.mutation(api.accounts.mutations.setIcon, {
        ...payload,
        accountId: mappedAccountId ?? accountId,
      } as never);
    }
    case 'account.setColor': {
      const accountId = String(payload.accountId);
      const mappedAccountId = await getMappedCloudId(userId, 'account', accountId);
      return convex.mutation(api.accounts.mutations.setColor, {
        ...payload,
        accountId: mappedAccountId ?? accountId,
      } as never);
    }
    case 'account.archive':
      return convex.mutation(api.accounts.mutations.archive, {
        ...payload,
        accountId: await mapId('account', payload.accountId),
      } as never);
    case 'category.create':
      return convex.mutation(api.categories.mutations.create, {
        ...payload,
        ...(typeof payload.parentId === 'string'
          ? { parentId: await mapId('category', payload.parentId) }
          : {}),
      } as never);
    case 'category.rename':
      return convex.mutation(api.categories.mutations.rename, {
        ...payload,
        categoryId: await mapId('category', payload.categoryId),
      } as never);
    case 'category.setIcon':
      return convex.mutation(api.categories.mutations.setIcon, {
        ...payload,
        categoryId: await mapId('category', payload.categoryId),
      } as never);
    case 'category.setPreferences':
      return convex.mutation(api.categories.mutations.setPreferences, {
        ...payload,
        categoryId: await mapId('category', payload.categoryId),
      } as never);
    case 'category.setLimit':
      return convex.mutation(api.categories.mutations.setLimit, {
        ...payload,
        categoryId: await mapId('category', payload.categoryId),
      } as never);
    case 'category.archive':
      return convex.mutation(api.categories.mutations.archive, {
        ...payload,
        categoryId: await mapId('category', payload.categoryId),
      } as never);
    // Budgets became category limits: budget changes queued by an older version are dropped.
    case 'budget.create':
    case 'budget.update':
    case 'budget.archive':
      return null;
    case 'transaction.create': {
      const accountId = String(payload.accountId);
      const categoryId = typeof payload.categoryId === 'string' ? payload.categoryId : null;
      const transferAccountId =
        typeof payload.transferAccountId === 'string' ? payload.transferAccountId : null;
      const [mappedAccountId, mappedCategoryId, mappedTransferAccountId] = await Promise.all([
        getMappedCloudId(userId, 'account', accountId),
        categoryId ? getMappedCloudId(userId, 'category', categoryId) : null,
        transferAccountId ? getMappedCloudId(userId, 'account', transferAccountId) : null,
      ]);
      return convex.mutation(api.transactions.mutations.create, {
        ...payload,
        accountId: mappedAccountId ?? accountId,
        ...(categoryId ? { categoryId: mappedCategoryId ?? categoryId } : {}),
        ...(transferAccountId
          ? { transferAccountId: mappedTransferAccountId ?? transferAccountId }
          : {}),
      } as never);
    }
    case 'transaction.update': {
      const transactionId = String(payload.transactionId);
      const accountId = String(payload.accountId);
      const categoryId = typeof payload.categoryId === 'string' ? payload.categoryId : null;
      const transferAccountId =
        typeof payload.transferAccountId === 'string' ? payload.transferAccountId : null;
      const [mappedTransactionId, mappedAccountId, mappedCategoryId, mappedTransferAccountId] =
        await Promise.all([
          getMappedCloudId(userId, 'transaction', transactionId),
          getMappedCloudId(userId, 'account', accountId),
          categoryId ? getMappedCloudId(userId, 'category', categoryId) : null,
          transferAccountId ? getMappedCloudId(userId, 'account', transferAccountId) : null,
        ]);
      return convex.mutation(api.transactions.mutations.update, {
        ...payload,
        transactionId: mappedTransactionId ?? transactionId,
        accountId: mappedAccountId ?? accountId,
        ...(categoryId ? { categoryId: mappedCategoryId ?? categoryId } : {}),
        ...(transferAccountId
          ? { transferAccountId: mappedTransferAccountId ?? transferAccountId }
          : {}),
      } as never);
    }
    case 'transaction.delete': {
      const transactionId = String(payload.transactionId);
      const mappedTransactionId = await getMappedCloudId(userId, 'transaction', transactionId);
      return convex.mutation(api.transactions.mutations.softDelete, {
        ...payload,
        transactionId: mappedTransactionId ?? transactionId,
      } as never);
    }
    case 'group.create':
      return convex.mutation(api.groups.mutations.create, payload as never);
    case 'group.update': {
      const groupId = String(payload.groupId);
      const mappedGroupId = await getMappedCloudId(userId, 'group', groupId);
      return convex.mutation(api.groups.mutations.updateSettings, {
        ...payload,
        groupId: mappedGroupId ?? groupId,
      } as never);
    }
    case 'group.setMemberRole': {
      const groupId = String(payload.groupId);
      const mappedGroupId = await getMappedCloudId(userId, 'group', groupId);
      return convex.mutation(api.groups.mutations.setMemberRole, {
        ...payload,
        groupId: mappedGroupId ?? groupId,
      } as never);
    }
    case 'group.addExpense': {
      const groupId = String(payload.groupId);
      const accountId = String(payload.accountId);
      const [mappedGroupId, mappedAccountId] = await Promise.all([
        getMappedCloudId(userId, 'group', groupId),
        getMappedCloudId(userId, 'account', accountId),
      ]);
      return convex.mutation(api.groups.mutations.addExpense, {
        ...payload,
        groupId: mappedGroupId ?? groupId,
        accountId: mappedAccountId ?? accountId,
        ...(typeof payload.categoryId === 'string'
          ? { categoryId: await mapId('category', payload.categoryId) }
          : {}),
      } as never);
    }
    case 'settlement.create': {
      const groupId = String(payload.groupId);
      const accountId = String(payload.accountId);
      const [mappedGroupId, mappedAccountId] = await Promise.all([
        getMappedCloudId(userId, 'group', groupId),
        getMappedCloudId(userId, 'account', accountId),
      ]);
      return convex.mutation(api.settlements.mutations.create, {
        ...payload,
        groupId: mappedGroupId ?? groupId,
        accountId: mappedAccountId ?? accountId,
      } as never);
    }
    case 'group.updateExpense':
      return convex.mutation(api.groups.mutations.updateExpense, {
        ...payload,
        transactionId: await mapId('transaction', payload.transactionId),
        accountId: await mapId('account', payload.accountId),
        ...(typeof payload.categoryId === 'string'
          ? { categoryId: await mapId('category', payload.categoryId) }
          : {}),
      } as never);
    case 'group.deleteExpense':
      return convex.mutation(api.groups.mutations.deleteExpense, {
        ...payload,
        transactionId: await mapId('transaction', payload.transactionId),
      } as never);
    case 'settlement.remove':
      return convex.mutation(api.settlements.mutations.remove, {
        ...payload,
        settlementId: await mapId('settlement', payload.settlementId),
      } as never);
    case 'goal.create':
      return convex.mutation(api.goals.mutations.create, {
        ...payload,
        ...(typeof payload.accountId === 'string'
          ? { accountId: await mapId('account', payload.accountId) }
          : {}),
      } as never);
    case 'goal.setIcon': {
      const goalId = String(payload.goalId);
      const mappedGoalId = await getMappedCloudId(userId, 'goal', goalId);
      return convex.mutation(api.goals.mutations.setIcon, {
        ...payload,
        goalId: mappedGoalId ?? goalId,
      } as never);
    }
    case 'goal.update': {
      const goalId = String(payload.goalId);
      const mappedGoalId = await getMappedCloudId(userId, 'goal', goalId);
      return convex.mutation(api.goals.mutations.update, {
        ...payload,
        goalId: mappedGoalId ?? goalId,
        ...(typeof payload.accountId === 'string'
          ? { accountId: await mapId('account', payload.accountId) }
          : {}),
      } as never);
    }
    case 'goal.archive': {
      const goalId = String(payload.goalId);
      const mappedGoalId = await getMappedCloudId(userId, 'goal', goalId);
      return convex.mutation(api.goals.mutations.archive, {
        ...payload,
        goalId: mappedGoalId ?? goalId,
      } as never);
    }
    case 'goal.contribute': {
      const goalId = String(payload.goalId);
      const mapped = await getMappedCloudId(userId, 'goal', goalId);
      return convex.mutation(api.goals.mutations.contribute, {
        ...payload,
        goalId: mapped ?? goalId,
      } as never);
    }
    case 'recurring.create': {
      const accountId = String(payload.accountId);
      const mapped = await getMappedCloudId(userId, 'account', accountId);
      return convex.mutation(api.recurring.mutations.create, {
        ...payload,
        accountId: mapped ?? accountId,
      } as never);
    }
    case 'recurring.setEnabled': {
      const ruleId = String(payload.ruleId);
      const mapped = await getMappedCloudId(userId, 'recurringRule', ruleId);
      return convex.mutation(api.recurring.mutations.setEnabled, {
        ...payload,
        ruleId: mapped ?? ruleId,
      } as never);
    }
    case 'recurring.delete': {
      const ruleId = String(payload.ruleId);
      const mapped = await getMappedCloudId(userId, 'recurringRule', ruleId);
      return convex.mutation(api.recurring.mutations.remove, {
        ...payload,
        ruleId: mapped ?? ruleId,
      } as never);
    }
    case 'notification.preferences':
      return convex.mutation(api.notifications.mutations.setPreferences, payload as never);
    case 'notification.markRead': {
      const notificationId = String(payload.notificationId);
      const mapped = await getMappedCloudId(userId, 'notification', notificationId);
      return convex.mutation(api.notifications.mutations.markRead, {
        ...payload,
        notificationId: mapped ?? notificationId,
      } as never);
    }
    case 'notification.markAllRead':
      return convex.mutation(api.notifications.mutations.markAllRead, payload as never);
    case 'notification.markUnread':
      return convex.mutation(api.notifications.mutations.markUnread, {
        ...payload,
        notificationId: await mapId('notification', payload.notificationId),
      } as never);
    case 'notification.remove':
      return convex.mutation(api.notifications.mutations.remove, {
        ...payload,
        notificationId: await mapId('notification', payload.notificationId),
      } as never);
    case 'user.update':
      return convex.mutation(api.users.mutations.update, payload as never);
    case 'user.defaultAccount': {
      const accountId =
        typeof payload.accountId === 'string'
          ? ((await getMappedCloudId(userId, 'account', payload.accountId)) ?? payload.accountId)
          : null;
      return convex.mutation(api.users.mutations.setDefaultAccount, {
        ...payload,
        accountId,
      } as never);
    }
    case 'user.defaultCategory': {
      const categoryId =
        typeof payload.categoryId === 'string'
          ? ((await getMappedCloudId(userId, 'category', payload.categoryId)) ?? payload.categoryId)
          : null;
      return convex.mutation(api.users.mutations.setDefaultCategory, {
        ...payload,
        categoryId,
      } as never);
    }
    default:
      throw new Error(`UNSUPPORTED_SYNC_OPERATION:${entry.operation}`);
  }
}

export function LocalSyncProvider({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const auth = useConvexAuth();
  const connection = useConvexConnectionState();
  const currentProfile = useQuery(api.users.queries.current, auth.isAuthenticated ? {} : 'skip');
  const reactiveChanges = useQuery(
    api.sync.queries.changes,
    auth.isAuthenticated && connection.isWebSocketConnected
      ? { paginationOpts: { numItems: 1, cursor: null } }
      : 'skip',
  );
  const remoteRevision = reactiveChanges?.latestRevision.toString();
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
  const previousReminderUserId = React.useRef<string | null>(null);
  const isConnected = connection.isWebSocketConnected;
  const authenticatedUserId = typeof currentProfile?._id === 'string' ? currentProfile._id : null;
  const userId = authenticatedUserId ?? (!isConnected ? storedUserId : null);
  const validatedOnline = Boolean(auth.isAuthenticated && isConnected && authenticatedUserId);
  const scopedStatus = statusUserId === userId ? status : emptyStatus;
  const scopedFailedEntries = statusUserId === userId ? failedEntries : [];
  const scopedConflicts = statusUserId === userId ? conflicts : [];
  React.useEffect(() => {
    if (!validatedOnline) return;
    let foreground = AppState.currentState === 'active';
    const heartbeat = () => {
      if (foreground) {
        void convex.mutation(api.presence.mutations.heartbeat, {}).catch(() => undefined);
      }
    };
    heartbeat();
    const interval = setInterval(heartbeat, 45_000);
    const subscription = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      if (foreground) heartbeat();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [convex, validatedOnline]);

  React.useEffect(() => {
    let active = true;
    void readValidatedLocalUserId()
      .then((id) => {
        if (active) setStoredUserId(id);
      })
      .catch((error: unknown) => {
        // Unreadable secure storage keeps the user signed out locally instead of crashing.
        console.warn('[local-sync] Could not read the cached identity.', error);
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!validatedOnline || !authenticatedUserId) return;
    setStoredUserId(authenticatedUserId);
    saveValidatedLocalUserId(authenticatedUserId).catch((error: unknown) =>
      console.warn('[local-sync] Could not cache the signed-in identity.', error),
    );
  }, [authenticatedUserId, validatedOnline]);

  React.useEffect(() => {
    if (!isConnected || auth.isLoading || auth.isAuthenticated) return;
    setStoredUserId(null);
    clearValidatedLocalUserId().catch((error: unknown) =>
      console.warn('[local-sync] Could not clear the cached identity.', error),
    );
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

  const pullChanges = React.useCallback(
    async (targetUserId: string) => {
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
        if (!page.continueCursor || page.continueCursor === cursor)
          throw new Error('INVALID_SYNC_CURSOR');
        cursor = page.continueCursor;
      }
      if (transactionsChanged) accountSnapshotsStale.current = true;
      if (!accountSnapshotsStale.current) return;
      let accountCursor: string | null = null;
      while (true) {
        const page = (await convex.query(api.sync.queries.bootstrapSection, {
          section: 'accounts',
          paginationOpts: { numItems: 100, cursor: accountCursor },
        })) as unknown as Extract<SectionBootstrapPage, { section: 'accounts' }>;
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
    },
    [convex],
  );

  const bootstrapRange = React.useCallback(
    async (targetUserId: string, days: LocalSyncWindow) => {
      const endAt = Date.now();
      const startAt = days === 'all' ? 0 : endAt - days * 86_400_000;
      let cursor: string | null = null;
      while (true) {
        const page: TransactionBootstrapPage = await convex.query(
          api.sync.queries.bootstrapTransactions,
          {
            windowDays: days === 'all' ? -1 : days,
            paginationOpts: { numItems: 100, cursor },
          },
        );
        await persistTransactionPage(targetUserId, page);
        if (page.isDone) break;
        if (!page.continueCursor || page.continueCursor === cursor)
          throw new Error('INVALID_SYNC_CURSOR');
        cursor = page.continueCursor;
      }
      await recordCoverage(targetUserId, 'transactions', startAt, endAt);

      const groups = await upsertAndReadGroupIds(targetUserId);
      for (const groupId of groups) {
        let transactionCursor: string | null = null;
        while (true) {
          const page: GroupTransactionRangeResult = await convex.query(
            api.sync.queries.groupTransactionRange,
            {
              groupId: groupId as never,
              startAt,
              endAt,
              paginationOpts: { numItems: 100, cursor: transactionCursor },
            },
          );
          await upsert(targetUserId, 'group', page.group ? [page.group] : []);
          await upsert(targetUserId, 'groupMember', page.groupMembers);
          await persistTransactionPage(targetUserId, {
            page: page.transactions.page as LocalRecord[],
            related: page.related,
          });
          if (page.transactions.isDone) break;
          if (
            !page.transactions.continueCursor ||
            page.transactions.continueCursor === transactionCursor
          )
            throw new Error('INVALID_SYNC_CURSOR');
          transactionCursor = page.transactions.continueCursor;
        }

        let settlementCursor: string | null = null;
        while (true) {
          const page: GroupSettlementRangeResult = await convex.query(
            api.sync.queries.groupSettlementRange,
            {
              groupId: groupId as never,
              startAt,
              endAt,
              paginationOpts: { numItems: 100, cursor: settlementCursor },
            },
          );
          await upsert(targetUserId, 'group', page.group ? [page.group] : []);
          await upsert(targetUserId, 'groupMember', page.groupMembers);
          await upsert(targetUserId, 'settlement', page.settlements.page);
          if (page.settlements.isDone) break;
          if (
            !page.settlements.continueCursor ||
            page.settlements.continueCursor === settlementCursor
          )
            throw new Error('INVALID_SYNC_CURSOR');
          settlementCursor = page.settlements.continueCursor;
        }
        await recordCoverage(targetUserId, `group:${groupId}`, startAt, endAt);
      }
    },
    [convex],
  );

  const bootstrap = React.useCallback(
    async (targetUserId: string, days: LocalSyncWindow) => {
      const complete = await hasCompletedBootstrap(targetUserId);
      if (!complete) {
        const identity = await convex.query(api.sync.queries.bootstrapIdentity, {});
        await upsertCloudPage(targetUserId, 'profile', [identity.profile as LocalRecord]);
        if (identity.settings)
          await upsertCloudPage(targetUserId, 'settings', [identity.settings as LocalRecord]);
        for (const section of bootstrapSections) {
          let cursor: string | null = null;
          while (true) {
            const page: SectionBootstrapPage = await convex.query(
              api.sync.queries.bootstrapSection,
              {
                section,
                paginationOpts: { numItems: 100, cursor },
              },
            );
            const primaryType = sectionEntity[section];
            if (primaryType)
              await upsertCloudPage(targetUserId, primaryType, page.page as LocalRecord[]);
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
            if (!page.continueCursor || page.continueCursor === cursor)
              throw new Error('INVALID_SYNC_CURSOR');
            cursor = page.continueCursor;
          }
        }
        await bootstrapRange(targetUserId, days);
        await pullChanges(targetUserId);
        await markBootstrapCompleted(targetUserId);
        return;
      }
      await bootstrapRange(targetUserId, days);
    },
    [bootstrapRange, convex, pullChanges],
  );

  const runOutboxEntry = React.useCallback(
    async (targetUserId: string, entry: OutboxEntry) => {
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
      if (entry.operation.startsWith('budget.')) {
        // Budgets became category limits: an older version's queued budget change is dropped.
        return {
          serverId: targetUserId,
          revision: await getSyncRevision(targetUserId),
          updatedAt: Date.now(),
        };
      }
      await sendMutation(convex, targetUserId, entry);
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
    },
    [bootstrap, convex, pullChanges],
  );

  const flush = React.useCallback(async () => {
    if (!userId || !validatedOnline || running.current) return;
    running.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await recoverInterruptedSync(userId);
      if (!(await hasCompletedBootstrap(userId)))
        await bootstrap(userId, await getSyncWindow(userId));
      await pullChanges(userId);
      await syncOutbox(userId, await listOutbox(userId), (entry) => runOutboxEntry(userId, entry));
      await pullChanges(userId);
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

  const retryEntry = React.useCallback(
    async (localId: string) => {
      if (!userId) return;
      await retryFailedEntry(userId, localId);
      await flush();
    },
    [flush, userId],
  );

  const chooseConflictVersion = React.useCallback(
    async (conflictId: string, winner: 'local' | 'cloud') => {
      if (!userId) return;
      await resolveLocalConflict(userId, conflictId, winner);
      await flush();
    },
    [flush, userId],
  );

  const changeWindow = React.useCallback(
    async (days: LocalSyncWindow) => {
      if (!userId) throw new Error('AUTH_REQUIRED');
      await persistSyncWindow(userId, days);
      setSyncWindowState(days);
      if (validatedOnline) await flush();
    },
    [flush, userId, validatedOnline],
  );

  const fetchTransactionRange = React.useCallback<FetchCloudRangePage>(
    async ({ startAt, endAt, cursor }) => {
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
    },
    [convex, userId, validatedOnline],
  );

  const fetchGroupRange = React.useCallback<FetchCloudGroupRangePage>(
    async ({ groupId, startAt, endAt, transactionCursor, settlementCursor }) => {
      const mappedGroupId = userId ? await getMappedCloudId(userId, 'group', groupId) : null;
      if (!validatedOnline) throw new Error('SYNC_OFFLINE');
      const localGroup = userId
        ? (await readLocal<LocalRecord>(userId, 'group')).find((record) =>
            [record.id, record._id, record.cloudId].includes(groupId),
          )
        : undefined;
      const cloudGroupId =
        mappedGroupId ??
        (typeof localGroup?.cloudId === 'string' ? localGroup.cloudId : localGroup?._id) ??
        groupId;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cloudGroupId))
        throw new Error('SYNC_PARENT_PENDING');
      const [transactionPage, settlementPage]: [
        GroupTransactionRangeResult,
        GroupSettlementRangeResult,
      ] = await Promise.all([
        convex.query(api.sync.queries.groupTransactionRange, {
          groupId: cloudGroupId as never,
          startAt,
          endAt,
          paginationOpts: { numItems: 100, cursor: transactionCursor },
        }),
        convex.query(api.sync.queries.groupSettlementRange, {
          groupId: cloudGroupId as never,
          startAt,
          endAt,
          paginationOpts: { numItems: 100, cursor: settlementCursor },
        }),
      ]);
      const records: Partial<Record<LocalEntity, readonly LocalRecord[]>> = {
        group: transactionPage.group ? [transactionPage.group] : [],
        groupMember: transactionPage.groupMembers,
        transaction: transactionPage.transactions.page,
        settlement: settlementPage.settlements.page,
        account: transactionPage.related.accounts.filter((account) => account.ownerId === userId),
        category: transactionPage.related.categories.filter(
          (category) => category.ownerId === userId,
        ),
        expensePayer: transactionPage.related.payers,
        expenseParticipant: transactionPage.related.participants,
        transactionTag: transactionPage.related.tags,
        receiptMetadata: transactionPage.related.receipts,
      };
      return {
        records,
        transactionCursor: transactionPage.transactions.continueCursor,
        settlementCursor: settlementPage.settlements.continueCursor,
        transactionsDone: transactionPage.transactions.isDone,
        settlementsDone: settlementPage.settlements.isDone,
      };
    },
    [convex, userId, validatedOnline],
  );

  React.useEffect(() => {
    if (!userId || !validatedOnline || scopedStatus.pending === 0) return;
    let active = true;
    void hasCompletedBootstrap(userId)
      .then((complete) => {
        if (active && complete) void flush();
      })
      .catch((error: unknown) => {
        if (active) setSyncError(error instanceof Error ? error.message : 'LOCAL_STORAGE_FAILED');
      });
    return () => {
      active = false;
    };
  }, [flush, scopedStatus.pending, userId, validatedOnline]);
  React.useEffect(() => {
    if (!userId || !validatedOnline) return;
    let active = true;
    void hasCompletedBootstrap(userId)
      .then(async (complete) => {
        if (!active) return;
        if (!complete) {
          void flush();
          return;
        }
        if (!remoteRevision) return;
        const revision = await getSyncRevision(userId);
        if (active && BigInt(remoteRevision) > BigInt(revision)) void flush();
      })
      .catch((error: unknown) => {
        if (active) setSyncError(error instanceof Error ? error.message : 'LOCAL_STORAGE_FAILED');
      });
    return () => {
      active = false;
    };
  }, [flush, remoteRevision, userId, validatedOnline]);

  React.useEffect(() => {
    const previous = previousReminderUserId.current;
    if (previous && previous !== userId) void clearDeviceReminders(previous).catch(() => undefined);
    previousReminderUserId.current = userId;
  }, [userId]);

  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    let running = false;
    let pending = false;
    const refresh = () => {
      if (running) {
        pending = true;
        return;
      }
      running = true;
      void (async () => {
        do {
          pending = false;
          try {
            await reconcileRecurringNotifications(userId, () => active);
          } catch {
            /* Local inbox remains usable if native scheduling is unavailable. */
          }
        } while (pending && active);
        running = false;
      })();
    };
    const unsubscribe = subscribeLocalData(userId, refresh);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => {
      active = false;
      unsubscribe();
      foreground.remove();
    };
  }, [userId]);

  React.useEffect(() => {
    if (!userId || scopedFailedEntries.length === 0) return;
    void readLocal<LocalRecord>(userId, 'settings')
      .then(([settings]) => {
        if (!normalizeNotificationPreferences(settings?.notificationPreferences).sync) return;
        return Promise.all(
          scopedFailedEntries.map((entry) =>
            putLocalNotification(userId, `sync:${entry.localId}`, {
              type: 'sync',
              title: 'Sync needs attention',
              body: describeSyncError(
                entry.lastError,
                'A change could not reach your other devices. Review it in local sync.',
              ),
              entityType: 'sync',
              createdAt: Date.now(),
            }),
          ),
        );
      })
      .catch(() => undefined);
  }, [userId, scopedFailedEntries]);

  // Push taps arrive outside React state: read the signed-in user and client through refs.
  const pushUserRef = React.useRef(userId);
  pushUserRef.current = userId;
  const pushConvexRef = React.useRef(convex);
  pushConvexRef.current = convex;
  /** Opened before the identity loaded (cold start): marked read once it is known. */
  const [pendingPushReadVersion, setPendingPushReadVersion] = React.useState(0);
  const pendingPushReads = React.useRef<string[]>([]);
  const pendingPushReadUser = React.useRef(userId);
  const markOpenedRef = React.useRef<(id: unknown) => Promise<void>>(async () => {});
  const enqueuePendingPushRead = React.useCallback((id: string) => {
    if (pendingPushReads.current.includes(id)) return;
    pendingPushReads.current.push(id);
    setPendingPushReadVersion((version) => version + 1);
  }, []);
  React.useEffect(() => {
    if (pendingPushReadUser.current && pendingPushReadUser.current !== userId)
      pendingPushReads.current.length = 0;
    pendingPushReadUser.current = userId;
    if (!userId || !pendingPushReads.current.length) return;
    return retryPushReadQueue(
      [...pendingPushReads.current],
      (id) => markOpenedRef.current(id),
      (id) => {
        const index = pendingPushReads.current.indexOf(id);
        if (index !== -1) pendingPushReads.current.splice(index, 1);
      },
      (error: unknown) =>
        console.warn('[local-sync] Could not mark the opened notification read.', error),
    );
  }, [userId, isConnected, pendingPushReadVersion]);

  React.useEffect(() => {
    if (isExpoGo() || Platform.OS === 'web') return;
    let active = true;
    let subscription: { remove: () => void } | null = null;
    /** Opening a push is opening the notification: mark it read like the centre does. */
    const markOpened = async (notificationId: unknown) => {
      if (typeof notificationId !== 'string' || !notificationId) return;
      const owner = pushUserRef.current;
      if (!owner) {
        enqueuePendingPushRead(notificationId);
        return;
      }
      try {
        const records = await readLocal<NotificationRecord>(owner, 'notification');
        const local = records.find((record) =>
          [record.id, record._id, record.cloudId].includes(notificationId),
        );
        if (local) await markNotificationAsRead(owner, local);
        else
          await pushConvexRef.current.mutation(api.notifications.mutations.markRead, {
            notificationId: notificationId as Id<'notifications'>,
            clientMutationId: `push-open:${notificationId}`,
          });
      } catch (error) {
        if (pushUserRef.current === owner) enqueuePendingPushRead(notificationId);
        throw error;
      }
    };
    markOpenedRef.current = markOpened;
    void import('expo-notifications')
      .then((Notifications) => {
        if (!active) return;
        Notifications.setNotificationHandler({
          // While the app is open, server pushes surface as an in-app toast instead of a banner.
          handleNotification: async (notification) => {
            const trigger = notification.request.trigger as { type?: unknown } | null;
            const remote = trigger?.type === 'push';
            return {
              shouldShowBanner: !remote,
              shouldShowList: true,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          },
        });
        const follow = (response: NotificationResponse | null) => {
          const data = response?.notification.request.content.data;
          const path = appPathForNotificationUrl(data?.url);
          if (path) router.push(path as never);
          void markOpened(data?.notificationId).catch((error: unknown) =>
            console.warn('[local-sync] Could not mark the opened notification read.', error),
          );
        };
        subscription = Notifications.addNotificationResponseReceivedListener(follow);
        // A tap that launched the app from a killed state.
        const launch = Notifications.getLastNotificationResponse();
        if (launch) {
          Notifications.clearLastNotificationResponse();
          follow(launch);
        }
      })
      .catch((error: unknown) => {
        console.warn('[local-sync] Notifications are unavailable.', error);
      });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enqueuePendingPushRead, router]);

  const groupWrites = React.useMemo(() => {
    const context = () => {
      if (!userId) throw new Error('AUTH_REQUIRED');
      return { convex, userId, online: validatedOnline, refresh: () => void flush() };
    };
    return {
      updateGroupExpense: (request: GroupExpenseUpdateRequest) =>
        updateGroupExpense(context(), request),
      deleteGroupExpense: (transaction: LocalRecord) => deleteGroupExpense(context(), transaction),
      removeSettlement: (settlement: string | LocalRecord) =>
        removeSettlement(context(), settlement),
    };
  }, [convex, flush, userId, validatedOnline]);

  return (
    <LocalSyncContext.Provider
      value={{
        ...groupWrites,
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
      }}
    >
      {children}
    </LocalSyncContext.Provider>
  );
}

async function upsertAndReadGroupIds(userId: string): Promise<string[]> {
  const groups = await readLocal<LocalRecord>(userId, 'group');
  return groups
    .map((group) => String(group.cloudId ?? group._id ?? ''))
    .filter((groupId) => groupId.length > 0);
}

export function useLocalSync() {
  const context = React.useContext(LocalSyncContext);
  if (!context) throw new Error('LOCAL_SYNC_PROVIDER_REQUIRED');
  return context;
}
