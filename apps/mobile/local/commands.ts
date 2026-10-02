import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { applyLocalMutationAndEnqueue, type LocalEntity, type LocalRecord } from './repository';
import { createOutboxEntry } from './outbox/queue';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_ID_KEY = 'finapp.local.device-id.v1';

async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
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
  const clientMutationId = options.clientMutationId ?? Crypto.randomUUID();
  const isCreate =
    operation.endsWith('.create') ||
    operation === 'group.addExpense' ||
    operation === 'goal.contribute';
  const initialId = options.recordId ?? record.id ?? record._id;
  const createNewId = isCreate;
  let initialCreateId =
    typeof initialId === 'string' && UUID_V4.test(initialId) ? initialId : undefined;
  const clientUpdatedAt = Date.now();
  const deviceId = options.deviceId ?? (await getDeviceId());
  for (;;) {
    const recordId = isCreate
      ? (initialCreateId ?? Crypto.randomUUID())
      : (initialId ?? Crypto.randomUUID());
    initialCreateId = undefined;
    const localRecord: LocalRecord = {
      ...record,
      id: recordId,
      ...(isCreate ? { clientId: recordId } : {}),
      updatedAt: clientUpdatedAt,
      clientUpdatedAt,
    };
    const entry = createOutboxEntry(
      operation,
      { ...payload, ...(isCreate ? { clientId: recordId } : {}), clientMutationId },
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
    const relatedRecords = options.relatedRecords?.map((related) => ({
      ...related,
      record:
        createNewId && initialId
          ? Object.fromEntries(
              Object.entries(related.record).map(([key, value]) => [
                key,
                value === initialId ? recordId : value,
              ]),
            )
          : related.record,
    }));
    try {
      await applyLocalMutationAndEnqueue(
        userId,
        entityType,
        localRecord,
        entry,
        relatedRecords,
        createNewId,
      );
      return recordId;
    } catch (cause) {
      if (!(cause instanceof Error)) throw cause;
      if (cause.message === 'LOCAL_OUTBOX_ID_COLLISION') continue;
      if (createNewId && cause.message === 'LOCAL_RECORD_ID_COLLISION') continue;
      throw cause;
    }
  }
}
