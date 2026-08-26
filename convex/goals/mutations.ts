import { applyContribution } from './domain';

export function contributeToGoal(
  goal: { ownerId: string; targetAmountMinor: bigint },
  actorId: string,
  previousMinor: bigint,
  amountMinor: bigint,
) {
  if (goal.ownerId !== actorId) throw new Error('INSUFFICIENT_PERMISSION');
  const progress = applyContribution(previousMinor, amountMinor, goal.targetAmountMinor);
  return { amountMinor, occurredAt: Date.now(), progress };
}
