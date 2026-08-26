import { DomainError } from './errors';

export type GroupRole = 'owner' | 'admin' | 'member';
export type Membership = { userId: string; role: GroupRole };

export function requireOwner(actorId: string, ownerId: string): void {
  if (actorId !== ownerId) throw new DomainError('INSUFFICIENT_PERMISSION');
}

export function requireMember(actorId: string, members: readonly Membership[]): Membership {
  const membership = members.find((member) => member.userId === actorId);
  if (!membership) throw new DomainError('NOT_MEMBER');
  return membership;
}

export function requireAdmin(
  actorId: string,
  ownerId: string,
  members: readonly Membership[],
): void {
  if (actorId === ownerId) return;
  const membership = requireMember(actorId, members);
  if (membership.role !== 'admin') throw new DomainError('INSUFFICIENT_PERMISSION');
}

export function requireExpenseEditor(
  actorId: string,
  creatorId: string,
  ownerId: string,
  members: readonly Membership[],
): void {
  if (actorId === creatorId || actorId === ownerId) return;
  requireAdmin(actorId, ownerId, members);
}

export function requireSettlementParticipant(
  actorId: string,
  fromUserId: string,
  toUserId: string,
): void {
  if (actorId !== fromUserId && actorId !== toUserId)
    throw new DomainError('INSUFFICIENT_PERMISSION');
}
