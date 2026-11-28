/** Webhook event catalogue (pure, shared by the router, the emitter and the docs). */
import type { ApiScope } from './scopes';

export const WEBHOOK_EVENT_TYPES = [
  'transaction.created',
  'transaction.updated',
  'transaction.deleted',
  'account.created',
  'account.updated',
  'account.deleted',
  'category.created',
  'category.updated',
  'category.deleted',
  'budget.threshold_reached',
  'budget.exceeded',
  'goal.created',
  'goal.updated',
  'goal.deleted',
  'goal_contribution.created',
  'recurring_rule.created',
  'recurring_rule.updated',
  'recurring_rule.deleted',
  'group.created',
  'group.updated',
  'settlement.created',
  'settlement.deleted',
  'notification.created',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number] | 'ping';

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<(typeof WEBHOOK_EVENT_TYPES)[number], string> = {
  'transaction.created': 'A transaction (personal or a group expense you share) was created.',
  'transaction.updated': 'A transaction was edited.',
  'transaction.deleted': 'A transaction was deleted (moved to Trash).',
  'account.created': 'An account was created.',
  'account.updated': 'An account was changed.',
  'account.deleted': 'An account was archived.',
  'category.created': 'A category was created.',
  'category.updated': 'A category or its limit was changed.',
  'category.deleted': 'A category was archived.',
  'budget.threshold_reached': 'Spending in a category crossed its alert level (default 80%).',
  'budget.exceeded': 'Spending in a category reached its monthly limit.',
  'goal.created': 'A goal was created.',
  'goal.updated': 'A goal was changed.',
  'goal.deleted': 'A goal was archived.',
  'goal_contribution.created': 'Money was added to a goal.',
  'recurring_rule.created': 'A recurring rule was created.',
  'recurring_rule.updated': 'A recurring rule was paused, resumed or changed.',
  'recurring_rule.deleted': 'A recurring rule was deleted.',
  'group.created': 'You created or joined a group.',
  'group.updated': 'A group you belong to was changed.',
  'settlement.created': 'A settlement was recorded in one of your groups.',
  'settlement.deleted': 'A settlement was undone.',
  'notification.created': 'You received a notification.',
};

/** Sync entity → event object name. */
const ENTITY_OBJECT: Record<string, string> = {
  transactions: 'transaction',
  accounts: 'account',
  categories: 'category',
  goals: 'goal',
  goalContributions: 'goal_contribution',
  recurringRules: 'recurring_rule',
  groups: 'group',
  settlements: 'settlement',
  notifications: 'notification',
};

/** The read scope an OAuth app needs to receive events about an object. */
const OBJECT_SCOPE: Record<string, ApiScope> = {
  transaction: 'transactions:read',
  account: 'accounts:read',
  category: 'categories:read',
  budget: 'budgets:read',
  goal: 'goals:read',
  goal_contribution: 'goals:read',
  recurring_rule: 'recurring:read',
  group: 'groups:read',
  settlement: 'splits:read',
  notification: 'notifications:read',
};

const known: ReadonlySet<string> = new Set(WEBHOOK_EVENT_TYPES);
export function isWebhookEventType(value: string): value is (typeof WEBHOOK_EVENT_TYPES)[number] {
  return known.has(value);
}

export function eventScope(type: string): ApiScope | null {
  return OBJECT_SCOPE[type.split('.')[0] ?? ''] ?? null;
}

/**
 * Classifies a recorded sync change as a webhook event. Deletions are a tombstone or a soft
 * delete/archive marker; a document whose `createdAt` equals its `updatedAt` (within a second)
 * is new; anything else is an update.
 */
export function eventForSyncChange(
  entityType: string,
  document: unknown,
  updatedAt: number,
  deletedAt: number | undefined,
): (typeof WEBHOOK_EVENT_TYPES)[number] | null {
  const object = ENTITY_OBJECT[entityType];
  if (!object) return null;
  const record = (document && typeof document === 'object' ? document : {}) as Record<
    string,
    unknown
  >;
  const removed =
    deletedAt !== undefined ||
    typeof record.deletedAt === 'number' ||
    typeof record.archivedAt === 'number';
  const createdAt = typeof record.createdAt === 'number' ? record.createdAt : undefined;
  const action = removed
    ? 'deleted'
    : createdAt !== undefined && Math.abs(updatedAt - createdAt) < 1000
      ? 'created'
      : 'updated';
  const type = `${object}.${action}`;
  return isWebhookEventType(type) ? type : null;
}
