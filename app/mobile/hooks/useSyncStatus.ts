import { useEffect, useState } from 'react';
import {
  getLocalSyncStatus,
  retryFailed,
  subscribeLocalData,
  type LocalSyncStatus,
} from '@/local/repository';

export function useSyncStatus(
  userId: string | null,
  connected: boolean,
  onRetry: () => Promise<void>,
) {
  const [status, setStatus] = useState<{ userId: string; value: LocalSyncStatus } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const refresh = () => {
      void getLocalSyncStatus(userId).then((value) => {
        if (active) setStatus({ userId, value });
      });
    };
    const unsubscribe = subscribeLocalData(userId, refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);
  const current = status?.userId === userId ? status.value : null;
  return {
    connection: connected ? 'online' : 'offline',
    pending: current?.pending ?? 0,
    syncing: current?.syncing ?? 0,
    failed: current?.failed ?? 0,
    conflicts: current?.conflicts ?? 0,
    lastSyncedAt: current?.lastSyncedAt ?? null,
    retryNow: async () => {
      if (!userId || current?.syncing) return;
      await retryFailed(userId);
      await onRetry();
    },
  };
}
