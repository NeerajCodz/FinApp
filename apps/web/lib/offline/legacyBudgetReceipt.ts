import { getSyncState, type SyncReceipt } from './repository';

export async function legacyBudgetReceipt(
  userId: string,
  recordId: string,
  readSyncState: (userId: string) => Promise<{ revision: string }> = getSyncState,
): Promise<SyncReceipt> {
  const { revision } = await readSyncState(userId);
  return { serverId: recordId || userId, revision, updatedAt: Date.now() };
}
