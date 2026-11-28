/**
 * The whitelist of usage metrics. Instrumentation records only an event kind from this list
 * (never payloads, amounts, names or text); anything else is dropped. Pure module, shared with
 * the admin console for labels.
 */

export const FEATURE_METRICS = {
  'transaction.create': { label: 'Transactions added', feature: 'Transactions' },
  'transaction.update': { label: 'Transactions edited', feature: 'Transactions' },
  'transaction.delete': { label: 'Transactions deleted', feature: 'Transactions' },
  'account.create': { label: 'Accounts created', feature: 'Accounts' },
  'account.update': { label: 'Accounts edited', feature: 'Accounts' },
  'category.create': { label: 'Categories created', feature: 'Categories' },
  'category.update': { label: 'Categories edited', feature: 'Categories' },
  'goal.create': { label: 'Goals created', feature: 'Goals' },
  'goal.update': { label: 'Goals edited', feature: 'Goals' },
  'goal.contribute': { label: 'Goal contributions', feature: 'Goals' },
  'recurring.create': { label: 'Recurring rules created', feature: 'Recurring' },
  'recurring.update': { label: 'Recurring rules edited', feature: 'Recurring' },
  'group.create': { label: 'Groups created', feature: 'Groups' },
  'group.update': { label: 'Group settings changed', feature: 'Groups' },
  'group.join': { label: 'Group joins', feature: 'Groups' },
  'split.create': { label: 'Shared expenses added', feature: 'Splits' },
  'split.update': { label: 'Shared expenses edited', feature: 'Splits' },
  'settlement.create': { label: 'Settlements recorded', feature: 'Splits' },
  'chat.group_message': { label: 'Group chat messages', feature: 'Chat' },
  'chat.direct_message': { label: 'Direct messages', feature: 'Chat' },
  'notification.read': { label: 'Notifications read', feature: 'Notifications' },
  'profile.update': { label: 'Profile edits', feature: 'Profile' },
  'ai.chat': { label: 'FinAI requests', feature: 'FinAI' },
  'ai.ocr': { label: 'Receipt scans', feature: 'FinAI' },
  'ai.decision': { label: 'AI classifications', feature: 'FinAI' },
  'ai.utility': { label: 'AI utility calls', feature: 'FinAI' },
  'ai.support': { label: 'Support AI calls', feature: 'Support' },
  'mcp.tool_call': { label: 'MCP tool calls', feature: 'MCP' },
  'mcp.connect': { label: 'MCP connections authorized', feature: 'MCP' },
  'support.ticket': { label: 'Support tickets opened', feature: 'Support' },
  'support.reply': { label: 'Support replies', feature: 'Support' },
  'report.create': { label: 'Reports filed', feature: 'Support' },
  'session.start': { label: 'Sessions started', feature: 'App' },
  'app.active': { label: 'Active users', feature: 'App' },
} as const satisfies Record<string, { label: string; feature: string }>;

/** Aggregate-only metrics: counted globally, not per user. Values are bytes or tokens. */
export const AGGREGATE_METRICS = {
  'ai.tokens.prompt': { label: 'AI prompt tokens' },
  'ai.tokens.output': { label: 'AI output tokens' },
  'upload.bytes': { label: 'Uploaded bytes' },
  'upload.files': { label: 'Uploaded files' },
  'storage.bytes': { label: 'Stored bytes (daily snapshot)' },
  'storage.files': { label: 'Stored files (daily snapshot)' },
  'users.total': { label: 'Total users (daily snapshot)' },
} as const satisfies Record<string, { label: string }>;

export type FeatureMetric = keyof typeof FEATURE_METRICS;
export type AggregateMetric = keyof typeof AGGREGATE_METRICS;
export type UsageMetric = FeatureMetric | AggregateMetric;

export function isFeatureMetric(value: unknown): value is FeatureMetric {
  return typeof value === 'string' && Object.hasOwn(FEATURE_METRICS, value);
}

export function isAggregateMetric(value: unknown): value is AggregateMetric {
  return typeof value === 'string' && Object.hasOwn(AGGREGATE_METRICS, value);
}

export function isUsageMetric(value: unknown): value is UsageMetric {
  return isFeatureMetric(value) || isAggregateMetric(value);
}

/**
 * Maps a sync operation name (`'account.rename'`, `'group.addExpense'` …) onto a feature
 * metric, or null when the operation isn't counted.
 */
export function metricForOperation(operation: string): FeatureMetric | null {
  if (isFeatureMetric(operation)) return operation;
  const [entity, verb = ''] = operation.split('.');
  switch (entity) {
    case 'account':
      return verb === 'create' ? 'account.create' : 'account.update';
    case 'category':
      return verb === 'create' ? 'category.create' : 'category.update';
    case 'goal':
      return verb === 'create'
        ? 'goal.create'
        : verb === 'contribute'
          ? 'goal.contribute'
          : 'goal.update';
    case 'recurring':
      return verb === 'create' ? 'recurring.create' : 'recurring.update';
    case 'group':
      if (verb === 'create') return 'group.create';
      if (verb === 'addExpense') return 'split.create';
      if (verb === 'updateExpense' || verb === 'deleteExpense' || verb === 'addMembersToExpenses')
        return 'split.update';
      if (verb === 'respondToInvitation') return 'group.join';
      return 'group.update';
    case 'settlement':
      return verb === 'create' ? 'settlement.create' : null;
    case 'notification':
      return verb === 'markRead' || verb === 'markAllRead' ? 'notification.read' : null;
    case 'user':
      return 'profile.update';
    default:
      return null;
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight of the day containing `time`. */
export function dayStart(time: number): number {
  return Math.floor(time / DAY_MS) * DAY_MS;
}

export const USAGE_SHARDS = 8;

/** A stable shard per key (user id), so one user's writes always hit the same counter row. */
export function shardFor(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1)
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return (hash >>> 0) % USAGE_SHARDS;
}
