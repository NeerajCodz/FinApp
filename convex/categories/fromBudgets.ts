/**
 * Folds the retired Budgets feature into category limits. Used by the one-off migration
 * (`migrations.foldBudgetsIntoCategoryLimits`) and when a budget is restored from Trash.
 *
 * - A budget for one category becomes that category's monthly limit (amount, currency and
 *   alert level) when the category has no limit yet. When it already has one, the category's
 *   own limit is kept and the decision is logged. Of two budgets for one category, the larger
 *   wins.
 * - A budget without a category (an overall budget), or whose category is gone, is retired:
 *   the user gets a notification asking them to set limits on their categories instead.
 * - Every handled budget gets `migratedAt`, so running again changes nothing.
 */
import type { MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { recordSyncChange } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { planBudgetMigration, type BudgetMigrationPlan } from './limits';

export type FoldResult = {
  converted: number;
  kept: number;
  retired: number;
  skipped: number;
  log: string[];
};

async function categoryFor(ctx: MutationCtx, ownerId: Id<'users'>, key: string | undefined) {
  if (!key) return null;
  const id = ctx.db.normalizeId('categories', key);
  const category = id
    ? await ctx.db.get(id)
    : await ctx.db
        .query('categories')
        .withIndex('by_clientId', (q) => q.eq('clientId', key))
        .first();
  return category && category.ownerId === ownerId ? category : null;
}

/** Folds `budgets` (all owned by `ownerId`) into category limits. Idempotent. */
export async function foldBudgets(
  ctx: MutationCtx,
  ownerId: Id<'users'>,
  budgets: readonly Doc<'budgets'>[],
  options: { includeTrashed?: boolean } = {},
): Promise<FoldResult> {
  const result: FoldResult = { converted: 0, kept: 0, retired: 0, skipped: 0, log: [] };
  const now = Date.now();
  const planned = new Map<
    string,
    { monthlyLimitMinor: bigint; limitCurrency: string; limitAlertPercent?: number }
  >();
  const decisions: { budget: Doc<'budgets'>; plan: BudgetMigrationPlan }[] = [];
  for (const budget of budgets) {
    if (budget.ownerId !== ownerId) continue;
    const category = await categoryFor(ctx, ownerId, budget.categoryId);
    const plan = planBudgetMigration(
      {
        ...budget,
        _id: String(budget._id),
        archivedAt: options.includeTrashed ? undefined : budget.archivedAt,
      },
      category ? { ...category, _id: String(category._id) } : null,
      category ? planned.get(String(category._id)) : undefined,
    );
    if (plan.action === 'set-limit')
      planned.set(plan.categoryId, {
        monthlyLimitMinor: plan.monthlyLimitMinor,
        limitCurrency: plan.limitCurrency,
        ...(plan.limitAlertPercent !== undefined
          ? { limitAlertPercent: plan.limitAlertPercent }
          : {}),
      });
    decisions.push({ budget, plan });
  }
  for (const [categoryKey, limit] of planned) {
    const categoryId = ctx.db.normalizeId('categories', categoryKey);
    if (!categoryId) continue;
    await ctx.db.patch(categoryId, {
      monthlyLimitMinor: limit.monthlyLimitMinor,
      limitCurrency: limit.limitCurrency,
      limitAlertPercent: limit.limitAlertPercent,
      updatedAt: now,
    });
    await recordSyncChange(
      ctx,
      ownerId,
      'categories',
      categoryKey,
      now,
      await ctx.db.get(categoryId),
    );
  }
  for (const { budget, plan } of decisions) {
    if (plan.action === 'skip') {
      result.skipped += 1;
      continue;
    }
    const finalLimit = plan.action === 'set-limit' ? planned.get(plan.categoryId) : undefined;
    if (plan.action === 'set-limit' && finalLimit?.monthlyLimitMinor === budget.amountMinor) {
      result.converted += 1;
      result.log.push(`budget ${String(budget._id)} → category ${plan.categoryId} limit`);
    } else if (plan.action === 'retire-overall') {
      result.retired += 1;
      result.log.push(`budget ${String(budget._id)} retired (${plan.reason})`);
      await createNotification(
        ctx,
        ownerId,
        `budget-retired:${String(budget._id)}`,
        'budget',
        'budget',
        String(budget._id),
        `Budget “${budget.name}” moved to categories`,
        'Budgets now live on categories. Set a monthly limit on a category to keep tracking your spending.',
      );
    } else {
      result.kept += 1;
      result.log.push(
        `budget ${String(budget._id)} not applied: ${
          plan.action === 'keep-category' ? plan.reason : 'a larger budget for the category won'
        }`,
      );
    }
    const patch = {
      migratedAt: now,
      updatedAt: now,
      ...(options.includeTrashed ? { archivedAt: undefined } : {}),
    };
    await ctx.db.patch(budget._id, patch);
    await recordSyncChange(ctx, ownerId, 'budgets', String(budget._id), now, {
      ...budget,
      ...patch,
    });
  }
  return result;
}
