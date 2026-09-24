import { useEffect, useState } from 'react';
import {
  isRangeCovered,
  readLocal,
  readTransactionRange,
  recordCoverage,
  subscribeLocalData,
  upsertCloudPage,
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
