import { assertPositiveAmount } from '../shared/validators';

export function createBudget(
  ownerId: string,
  amountMinor: bigint,
  currency: string,
  startAt: number,
  endAt: number,
) {
  assertPositiveAmount(amountMinor);
  if (!ownerId || !/^[A-Z]{3}$/.test(currency) || endAt <= startAt)
    throw new Error('INVALID_BUDGET');
  return {
    ownerId,
    amountMinor,
    currency,
    startAt,
    endAt,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
