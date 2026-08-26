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

export function createGroup(ownerId: string, name: string, currency: string): Group {
  if (!ownerId || !name.trim() || !/^[A-Z]{3}$/.test(currency))
    throw new DomainError('INVALID_CURRENCY');
  return { id: `group-${Date.now()}`, ownerId, name: name.trim(), currency };
}

export function canReadGroup(actorId: string, group: Group, members: readonly Membership[]): void {
  if (group.archivedAt !== undefined) throw new DomainError('GROUP_ARCHIVED');
  requireMember(actorId, members);
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
  return members.map((member) => (member.userId === userId ? { ...member, role } : member));
}
