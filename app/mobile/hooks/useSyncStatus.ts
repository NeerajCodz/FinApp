import { useState } from 'react';

export type SyncStatus = 'Synced' | 'Syncing' | "Couldn't sync";

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('Synced');
  return { status, setStatus };
}
