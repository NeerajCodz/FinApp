import { useEffect, useState } from 'react';
import {
  isRangeCovered,
  readLocal,
  readTransactionRange,
  recordCoverage,
  subscribeLocalData,
  upsertCloudPage,
  readGroupRange,
} from '@/local/repository';
import type { LocalEntity, LocalRecord } from '@/local/repository';

export function useLocalRecords<T extends LocalRecord>(userId: string | null, type: LocalEntity) {
  const [state, setState] = useState<{ userId: string; data?: T[]; error?: Error } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      void readLocal<T>(userId, type).then(
        (data) => {
          if (active && current === request) setState({ userId, data });
        },
        (error: unknown) => {
          if (active && current === request)
            setState({
              userId,
              error: error instanceof Error ? error : new Error('LOCAL_READ_FAILED'),
            });
        },
      );
    };
    const unsubscribe = subscribeLocalData(userId, refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, type]);
  const scopedState = state?.userId === userId ? state : null;
  return {
    data: scopedState?.data,
    error: scopedState?.error,
    loading: !!userId && !scopedState?.data && !scopedState?.error,
  };
}

export type CloudRangePage = {
  records: Partial<Record<LocalEntity, readonly LocalRecord[]>>;
  cursor: string | null;
  isDone: boolean;
};
export type FetchCloudRangePage = (args: {
  startAt: number;
  endAt: number;
  cursor: string | null;
}) => Promise<CloudRangePage>;
const rangeRequests = new Map<string, Promise<void>>();

export function useLocalTransactionRange<T extends LocalRecord>(
  userId: string | null,
  startAt: number,
  endAt: number,
  fetchPage?: FetchCloudRangePage,
) {
  const [state, setState] = useState<{
    scope: string;
    data?: T[];
    error?: Error;
    refreshing: boolean;
  } | null>(null);
  const scope = `${userId ?? ''}:${startAt}:${endAt}`;
  useEffect(() => {
    if (!userId || !Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt >= endAt) return;
    let active = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      void readTransactionRange<T>(userId, startAt, endAt).then(
        (data) => {
          if (active && current === request)
            setState((previous) => ({
              scope,
              data,
              error: previous?.scope === scope ? previous.error : undefined,
              refreshing: false,
            }));
        },
        (error: unknown) => {
          if (active && current === request)
            setState({
              scope,
              error: error instanceof Error ? error : new Error('LOCAL_READ_FAILED'),
              refreshing: false,
            });
        },
      );
    };
    const unsubscribe = subscribeLocalData(userId, refresh);
    refresh();
    if (fetchPage) {
      const requestKey = scope;
      const running = rangeRequests.get(requestKey);
      const download =
        running ??
        (async () => {
          if (await isRangeCovered(userId, 'transactions', startAt, endAt)) return;
          setState((previous) => ({
            scope,
            data: previous?.scope === scope ? previous.data : undefined,
            refreshing: true,
          }));
          let cursor: string | null = null;
          while (true) {
            const page = await fetchPage({ startAt, endAt, cursor });
            for (const [entity, records] of Object.entries(page.records) as [
              LocalEntity,
              readonly LocalRecord[],
            ][]) {
              if (records.length) await upsertCloudPage(userId, entity, records);
            }
            if (page.isDone) break;
            if (page.cursor === null || page.cursor === cursor)
              throw new Error('INVALID_SYNC_CURSOR');
            cursor = page.cursor;
          }
          await recordCoverage(userId, 'transactions', startAt, endAt);
        })();
      if (!running) rangeRequests.set(requestKey, download);
      void download.then(
        () => {
          if (rangeRequests.get(requestKey) === download) rangeRequests.delete(requestKey);
          if (active) refresh();
        },
        (error: unknown) => {
          if (rangeRequests.get(requestKey) === download) rangeRequests.delete(requestKey);
          if (active)
            setState((previous) => ({
              scope,
              data: previous?.scope === scope ? previous.data : undefined,
              error: error instanceof Error ? error : new Error('RANGE_SYNC_FAILED'),
              refreshing: false,
            }));
        },
      );
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, startAt, endAt, fetchPage, scope]);
  const scopedState = state?.scope === scope ? state : null;
  return {
    data: scopedState?.data,
    error: scopedState?.error,
    loading: !!userId && !scopedState?.data && !scopedState?.error,
    refreshing: scopedState?.refreshing ?? false,
  };
}

export type FetchCloudGroupRangePage = (args: {
  groupId: string;
  startAt: number;
  endAt: number;
  transactionCursor: string | null;
  settlementCursor: string | null;
}) => Promise<{
  records: Partial<Record<LocalEntity, readonly LocalRecord[]>>;
  transactionCursor: string | null;
  settlementCursor: string | null;
  transactionsDone: boolean;
  settlementsDone: boolean;
}>;

const groupRangeRequests = new Map<string, Promise<void>>();

export function useLocalGroupRange<T extends LocalRecord>(
  userId: string | null,
  groupId: string | null,
  startAt: number,
  endAt: number,
  fetchPage?: FetchCloudGroupRangePage,
) {
  const [state, setState] = useState<{
    scope: string;
    transactions?: T[];
    settlements?: T[];
    error?: Error;
    refreshing: boolean;
  } | null>(null);
  const scope = `${userId ?? ''}:${groupId ?? ''}:${startAt}:${endAt}`;
  useEffect(() => {
    if (!userId || !groupId || !Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt >= endAt)
      return;
    let active = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      void readGroupRange<T>(userId, groupId, startAt, endAt).then(
        ({ transactions, settlements }) => {
          if (active && current === request)
            setState((previous) => ({
              scope,
              transactions,
              settlements,
              error: previous?.scope === scope ? previous.error : undefined,
              refreshing: false,
            }));
        },
        (error: unknown) => {
          if (active && current === request)
            setState({
              scope,
              error: error instanceof Error ? error : new Error('LOCAL_READ_FAILED'),
              refreshing: false,
            });
        },
      );
    };
    const ensureRange = () => {
      if (!fetchPage) return;
      const requestKey = scope;
      let download = groupRangeRequests.get(requestKey);
      if (!download) {
        download = (async () => {
          const coverage = `group:${groupId}`;
          if (await isRangeCovered(userId, coverage, startAt, endAt)) return;
          setState((previous) => ({
            scope,
            transactions: previous?.scope === scope ? previous.transactions : undefined,
            settlements: previous?.scope === scope ? previous.settlements : undefined,
            refreshing: true,
          }));
          let transactionCursor: string | null = null;
          let settlementCursor: string | null = null;
          let transactionsDone = false;
          let settlementsDone = false;
          while (!transactionsDone || !settlementsDone) {
            const page = await fetchPage({
              groupId,
              startAt,
              endAt,
              transactionCursor,
              settlementCursor,
            });
            for (const [entity, records] of Object.entries(page.records) as [
              LocalEntity,
              readonly LocalRecord[],
            ][])
              if (records.length) await upsertCloudPage(userId, entity, records);
            transactionsDone = page.transactionsDone;
            settlementsDone = page.settlementsDone;
            if (!transactionsDone) {
              if (!page.transactionCursor || page.transactionCursor === transactionCursor)
                throw new Error('INVALID_SYNC_CURSOR');
              transactionCursor = page.transactionCursor;
            }
            if (!settlementsDone) {
              if (!page.settlementCursor || page.settlementCursor === settlementCursor)
                throw new Error('INVALID_SYNC_CURSOR');
              settlementCursor = page.settlementCursor;
            }
          }
          await recordCoverage(userId, coverage, startAt, endAt);
        })();
        groupRangeRequests.set(requestKey, download);
      }
      void download.then(
        () => {
          if (groupRangeRequests.get(requestKey) === download) groupRangeRequests.delete(requestKey);
          if (active) {
            setState((previous) => ({
              scope,
              transactions: previous?.scope === scope ? previous.transactions : undefined,
              settlements: previous?.scope === scope ? previous.settlements : undefined,
              refreshing: false,
            }));
            refresh();
          }
        },
        (error: unknown) => {
          if (groupRangeRequests.get(requestKey) === download) groupRangeRequests.delete(requestKey);
          if (active)
            setState((previous) => ({
              scope,
              transactions: previous?.scope === scope ? previous.transactions : undefined,
              settlements: previous?.scope === scope ? previous.settlements : undefined,
              error: error instanceof Error ? error : new Error('RANGE_SYNC_FAILED'),
              refreshing: false,
            }));
        },
      );
    };
    const unsubscribe = subscribeLocalData(userId, () => {
      refresh();
      ensureRange();
    });
    refresh();
    ensureRange();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, groupId, startAt, endAt, fetchPage, scope]);
  const scopedState = state?.scope === scope ? state : null;
  return {
    transactions: scopedState?.transactions,
    settlements: scopedState?.settlements,
    error: scopedState?.error,
    loading: !!userId && !!groupId && !scopedState?.transactions && !scopedState?.error,
    refreshing: scopedState?.refreshing ?? false,
  };
}
