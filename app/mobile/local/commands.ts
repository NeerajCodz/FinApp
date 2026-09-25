import { applyLocalMutationAndEnqueue, type LocalEntity, type LocalRecord } from './repository';
import { createOutboxEntry } from './outbox/queue';

const DEVICE_ID_KEY = 'finapp.local.device-id.v1';

function randomId(): string {
  const bytes = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues) throw new Error('SECURE_RANDOM_UNAVAILABLE');
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getDeviceId(): Promise<string> {
  const SecureStore = await import('expo-secure-store');
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = randomId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return id;
}

export type LocalWriteOptions = {
  recordId?: string;
  clientMutationId?: string;
  dependencies?: readonly string[];
  baseUpdatedAt?: number;
  deviceId?: string;
  relatedRecords?: readonly { entityType: LocalEntity; record: LocalRecord }[];
};

export async function commitLocalWrite(
  userId: string,
  entityType: LocalEntity,
  operation: string,
  record: LocalRecord,
  payload: Record<string, unknown>,
  options: LocalWriteOptions = {},
): Promise<string> {
  const clientMutationId = options.clientMutationId ?? randomId();
  const recordId = options.recordId ?? record.id ?? record._id ?? `local-${clientMutationId}`;
  const clientUpdatedAt = Date.now();
  const deviceId = options.deviceId ?? (await getDeviceId());
  const localRecord: LocalRecord = {
    ...record,
    id: recordId,
    updatedAt: clientUpdatedAt,
    clientUpdatedAt,
  };
  const entry = createOutboxEntry(
    operation,
    { ...payload, clientMutationId },
    clientMutationId,
    {
      entityType,
      recordId,
      clientUpdatedAt,
      baseUpdatedAt: options.baseUpdatedAt,
      deviceId,
      dependencies: options.dependencies,
    },
  );
  await applyLocalMutationAndEnqueue(userId, entityType, localRecord, entry, options.relatedRecords);
  return recordId;
}
