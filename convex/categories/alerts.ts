import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { createNotification } from '../notifications/mutations';
import { emitWebhookEvent } from '../publicApi/webhooks';
import {
  categorySpending,
  DEFAULT_LIMIT_ALERT_PERCENT,
  limitAlertFor,
  monthWindow,
} from './limits';

/**
 * Category-limit spending alerts: after an expense is recorded, notifies when the category's
 * spending this month crosses its alert level (default 80%) or reaches the limit (100%).
 * Delivered as notification type `budget` (shown as "Category limits" in settings).
 */
export async function notifyCategoryLimit(
  ctx: MutationCtx,
  userId: Id<'users'>,
  expense: { categoryId?: string; currency: string; occurredAt: number; amountMinor: bigint },
) {
  if (!expense.categoryId) return null;
  const categoryId = ctx.db.normalizeId('categories', expense.categoryId);
  const category = categoryId ? await ctx.db.get(categoryId) : null;
  if (
    !category ||
    category.ownerId !== userId ||
    category.archivedAt !== undefined ||
    category.monthlyLimitMinor === undefined ||
    category.monthlyLimitMinor <= 0n
  )
    return null;
  const currency = category.limitCurrency ?? expense.currency;
  if (currency !== expense.currency) return null;
  const { startAt, endAt } = monthWindow(Date.now());
  if (expense.occurredAt < startAt || expense.occurredAt >= endAt) return null;
  const keys = [String(category._id), category.clientId].filter(
    (key): key is string => typeof key === 'string' && key.length > 0,
  );
  const rows = [];
  for (const key of keys)
    rows.push(
      ...(await ctx.db
        .query('transactions')
        .withIndex('by_owner_category_occurredAt', (q) =>
          q
            .eq('ownerId', userId)
            .eq('categoryId', key)
            .gte('occurredAt', startAt)
            .lt('occurredAt', endAt),
        )
        .collect()),
    );
  const spent = categorySpending(rows, { categoryIds: keys, currency, startAt, endAt });
  const alertPercent = category.limitAlertPercent ?? DEFAULT_LIMIT_ALERT_PERCENT;
  const threshold = limitAlertFor(
    spent,
    expense.amountMinor,
    category.monthlyLimitMinor,
    alertPercent,
  );
  if (threshold === null) return null;
  await emitWebhookEvent(
    ctx,
    userId,
    threshold === 100 ? 'budget.exceeded' : 'budget.threshold_reached',
    {
      categoryId: String(category._id),
      name: category.name,
      currency,
      limitMinor: category.monthlyLimitMinor,
      spentMinor: spent,
      thresholdPercent: threshold,
    },
  );
  await createNotification(
    ctx,
    userId,
    `category-limit:${String(category._id)}:${startAt}:${threshold}`,
    'budget',
    'category',
    String(category._id),
    `${category.name}: ${threshold}% of limit used`,
    threshold === 100
      ? 'You reached this category’s monthly limit.'
      : 'You are nearing this category’s monthly limit.',
  );
  return threshold;
}
