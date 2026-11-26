/**
 * Category limits: a category's monthly limit is its budget. Pure helpers shared by the
 * category queries, spending alerts, FinAI / MCP tools and the budgets → category-limit
 * migration.
 */

/** Alert percentage used when a category has a limit but no alert level of its own. */
export const DEFAULT_LIMIT_ALERT_PERCENT = 80;

export type LimitStatus = 'normal' | 'warning' | 'near-limit' | 'exceeded';

/** Severity of a limit's usage: warning from the alert level, near-limit at 90%, exceeded at 100%. */
export function limitStatus(
  spentMinor: bigint,
  limitMinor: bigint,
  alertPercent: number = DEFAULT_LIMIT_ALERT_PERCENT,
): LimitStatus {
  if (limitMinor <= 0n || spentMinor >= limitMinor) return 'exceeded';
  const percentage = Number((spentMinor * 10_000n) / limitMinor) / 100;
  if (percentage >= 90) return 'near-limit';
  if (percentage >= Math.min(alertPercent, 90)) return 'warning';
  return 'normal';
}

/** A valid alert level is a finite number from 1 to 100. */
export function isValidAlertPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 100;
}

/** The current calendar month in UTC, `[startAt, endAt)`, matching the category queries. */
export function monthWindow(now: number): { startAt: number; endAt: number } {
  const date = new Date(now);
  return {
    startAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    endAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  };
}

export type LimitSpendTransaction = {
  type: string;
  status: string;
  deletedAt?: number;
  currency: string;
  occurredAt: number;
  categoryId?: string;
  amountMinor: bigint;
};

/** Posted, non-deleted expenses of one category in the limit's currency within the window. */
export function categorySpending(
  transactions: readonly LimitSpendTransaction[],
  scope: { categoryIds: readonly string[]; currency: string; startAt: number; endAt: number },
): bigint {
  return transactions.reduce((total, transaction) => {
    if (
      transaction.type !== 'expense' ||
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      transaction.currency !== scope.currency ||
      transaction.occurredAt < scope.startAt ||
      transaction.occurredAt >= scope.endAt ||
      transaction.categoryId === undefined ||
      !scope.categoryIds.includes(transaction.categoryId)
    )
      return total;
    return total + transaction.amountMinor;
  }, 0n);
}

/** True when spending moved from below `percentage`% of the limit to at or above it. */
export function limitThresholdCrossed(
  previousMinor: bigint,
  currentMinor: bigint,
  limitMinor: bigint,
  percentage: number,
): boolean {
  if (percentage === 0) return previousMinor === 0n && currentMinor > 0n;
  const [decimal, exponent = '0'] = String(percentage).split('e');
  const [whole, fraction = ''] = decimal!.split('.');
  const coefficient = BigInt(`${whole}${fraction}`);
  const scale = fraction.length - Number(exponent);
  const numerator = limitMinor * coefficient * (scale < 0 ? 10n ** BigInt(-scale) : 1n);
  const denominator = 100n * (scale > 0 ? 10n ** BigInt(scale) : 1n);
  return previousMinor * denominator < numerator && currentMinor * denominator >= numerator;
}

/**
 * Which alert (if any) an expense of `addedMinor` triggers: 100 when it reaches the limit,
 * the configured alert level when it crosses that, otherwise null.
 */
export function limitAlertFor(
  currentMinor: bigint,
  addedMinor: bigint,
  limitMinor: bigint,
  alertPercent: number = DEFAULT_LIMIT_ALERT_PERCENT,
): number | null {
  const previous = currentMinor - addedMinor;
  if (previous < limitMinor && currentMinor >= limitMinor) return 100;
  if (alertPercent < 100 && limitThresholdCrossed(previous, currentMinor, limitMinor, alertPercent))
    return alertPercent;
  return null;
}

export type BudgetForMigration = {
  _id: string;
  name: string;
  amountMinor: bigint;
  currency: string;
  period: string;
  categoryId?: string;
  alertThreshold?: number;
  archivedAt?: number;
  migratedAt?: number;
};

export type CategoryForMigration = {
  _id: string;
  clientId?: string;
  archivedAt?: number;
  monthlyLimitMinor?: bigint;
  limitCurrency?: string;
  limitAlertPercent?: number;
};

export type BudgetMigrationPlan =
  | {
      action: 'set-limit';
      categoryId: string;
      monthlyLimitMinor: bigint;
      limitCurrency: string;
      limitAlertPercent?: number;
    }
  | { action: 'keep-category'; categoryId: string; reason: string }
  | { action: 'retire-overall'; reason: string }
  | { action: 'skip'; reason: string };

/**
 * What to do with one budget when folding budgets into category limits:
 * - a budget for one category sets that category's limit when it has none;
 * - when the category already has a limit, the category's own limit wins (logged);
 * - a budget without a category (an overall budget) is retired and the user is told;
 * - already migrated or trashed budgets are left alone.
 * `pending` holds limits planned earlier in the same run, so of two budgets for one
 * category the larger one wins.
 */
export function planBudgetMigration(
  budget: BudgetForMigration,
  category: CategoryForMigration | null,
  pending?: { monthlyLimitMinor: bigint; limitCurrency: string },
): BudgetMigrationPlan {
  if (budget.migratedAt !== undefined) return { action: 'skip', reason: 'already migrated' };
  if (budget.archivedAt !== undefined) return { action: 'skip', reason: 'in trash' };
  if (!budget.categoryId) return { action: 'retire-overall', reason: 'no category' };
  if (!category || category.archivedAt !== undefined)
    return { action: 'retire-overall', reason: 'category missing or in trash' };
  const alert = isValidAlertPercent(budget.alertThreshold) ? budget.alertThreshold : undefined;
  if (pending) {
    if (pending.limitCurrency === budget.currency && budget.amountMinor > pending.monthlyLimitMinor)
      return {
        action: 'set-limit',
        categoryId: category._id,
        monthlyLimitMinor: budget.amountMinor,
        limitCurrency: budget.currency,
        ...(alert !== undefined ? { limitAlertPercent: alert } : {}),
      };
    return { action: 'keep-category', categoryId: category._id, reason: 'larger limit planned' };
  }
  if (category.monthlyLimitMinor !== undefined)
    return {
      action: 'keep-category',
      categoryId: category._id,
      reason: 'category already has a limit',
    };
  return {
    action: 'set-limit',
    categoryId: category._id,
    monthlyLimitMinor: budget.amountMinor,
    limitCurrency: budget.currency,
    ...(alert !== undefined ? { limitAlertPercent: alert } : {}),
  };
}
