'use client';

import React from 'react';
import { useBrowserSync } from './BrowserSyncProvider';
import { readLocal, subscribeLocalData, type LocalEntity, type LocalRecord } from './repository';

type LocalSnapshot<T> = {
  userId: string | null;
  entityType: LocalEntity;
  records: T[];
  loading: boolean;
  error: string | null;
};

export function useLocalRecords<T extends LocalRecord = LocalRecord>(
  entityType: LocalEntity,
): {
  records: T[];
  loading: boolean;
  error: string | null;
} {
  const { userId } = useBrowserSync();
  const [snapshot, setSnapshot] = React.useState<LocalSnapshot<T> | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setSnapshot({ userId: null, entityType, records: [], loading: false, error: null });
      return;
    }
    let active = true;
    const refresh = () => {
      void readLocal<T>(userId, entityType)
        .then((records) => {
          if (active) setSnapshot({ userId, entityType, records, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (active)
            setSnapshot({
              userId,
              entityType,
              records: [],
              loading: false,
              error: error instanceof Error ? error.message : 'LOCAL_STORAGE_FAILED',
            });
        });
    };
    const unsubscribe = subscribeLocalData(userId, refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [entityType, userId]);

  const visible = snapshot?.userId === userId && snapshot.entityType === entityType;
  return {
    records: visible ? snapshot.records : [],
    loading: Boolean(userId) && (!visible || snapshot.loading),
    error: visible ? snapshot.error : null,
  };
}
