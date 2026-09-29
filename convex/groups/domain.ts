import { DomainError } from '../shared/errors';
import {
  requireAdmin,
  requireMember,
  type GroupRole,
  type Membership,
} from '../shared/permissions';

export type Group = {
  id: string;
  ownerId: string;
  name: string;
  currency: string;
  archivedAt?: number;
};

export const BILL_IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const billImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateBillImageMetadata(
  metadata: { contentType?: string | null; size: number } | null,
): string | null {
  if (!metadata || !Number.isFinite(metadata.size) || metadata.size <= 0) return null;
  const mimeType = metadata.contentType?.split(';')[0]?.trim().toLowerCase();
  return mimeType && billImageMimeTypes.has(mimeType) && metadata.size <= BILL_IMAGE_LIMIT_BYTES
    ? mimeType
    : null;
}

export function createGroup(ownerId: string, name: string, currency: string): Group {
  if (!ownerId || !name.trim() || !/^[A-Z]{3}$/.test(currency))
    throw new DomainError('INVALID_CURRENCY');
  return { id: `group-${Date.now()}`, ownerId, name: name.trim(), currency };
}

export function canReadGroup(actorId: string, group: Group, members: readonly Membership[]): void {
  if (group.archivedAt !== undefined) throw new DomainError('GROUP_ARCHIVED');
  requireMember(actorId, members);
}
export function renameGroup(
  actorId: string,
  group: Group,
  members: readonly Membership[],
  name: string,
): Group {
  requireAdmin(actorId, group.ownerId, members);
  const trimmedName = name.trim();
  if (!trimmedName) throw new DomainError('INVALID_GROUP');
  return { ...group, name: trimmedName };
}

export function changeMemberRole(
  actorId: string,
  group: Group,
  members: readonly Membership[],
  userId: string,
  role: GroupRole,
): Membership[] {
  requireAdmin(actorId, group.ownerId, members);
  if (role === 'owner') throw new DomainError('INSUFFICIENT_PERMISSION');
  if (!members.some((member) => member.userId === userId)) throw new DomainError('NOT_MEMBER');
  return members.map((member) => (member.userId === userId ? { ...member, role } : member));
}
