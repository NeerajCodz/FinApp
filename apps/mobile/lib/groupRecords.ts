import type { LocalRecord } from '../local/repository';
import { recordIds } from './ledger';

export type GroupRecord = LocalRecord & {
  archivedAt?: number;
  cloudId?: string;
};

export function mergeGroupRecords(
  localRecords: readonly GroupRecord[],
  cloudRecords: readonly unknown[],
): GroupRecord[] {
  const merged = [...localRecords];
  for (const cloudGroup of cloudRecords) {
    const remote = cloudGroup as GroupRecord;
    const aliases = recordIds(remote);
    const localIndex = merged.findIndex((group) =>
      recordIds(group).some((alias) => aliases.includes(alias)),
    );
    if (localIndex === -1) {
      merged.push({ ...remote, cloudId: String(remote._id ?? remote.cloudId ?? '') });
    } else {
      const localGroup = merged[localIndex]!;
      merged[localIndex] = {
        ...localGroup,
        ...remote,
        id: localGroup.id ?? remote._id,
        cloudId: String(remote._id ?? remote.cloudId ?? localGroup.cloudId ?? ''),
      };
    }
  }
  return merged.filter((group) => group.archivedAt === undefined);
}
