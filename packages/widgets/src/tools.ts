/**
 * Tool → widget links, in one place so new tools can be mapped as they land. Only tools that exist
 * in `packages/mcp/src/tools/*.ts` are listed; each widget's data contract matches that tool's
 * result shape. The server prefers this map over a tool's own `widget` field.
 */
export const widgetForTool: Record<string, string> = {
  // Finance
  'finapp.finance.overview': 'overview',
  'finapp.finance.transactions.list': 'transactions',
  'finapp.finance.transactions.get': 'expense',
  'finapp.finance.accounts.list': 'accounts.list',
  'finapp.finance.categories.list': 'categories.limits',
  'finapp.finance.goals.list': 'goals.list',
  'finapp.finance.goal_contributions.list': 'goals.contributions',
  'finapp.finance.recurring.list': 'recurring.rules',
  'finapp.finance.trash.list': 'trash.list',
  'finapp.finance.dashboard.summary': 'cashflow.periodSummary',
  'finapp.finance.category_limits.list': 'categories.limitUsage',
  // Groups
  'finapp.groups.list': 'groups.list',
  'finapp.groups.detail.get': 'groups.detail',
  'finapp.groups.members.list': 'groups.members',
  'finapp.groups.invitations.list': 'groups.invitations',
  'finapp.groups.balances': 'groupBalances',
  'finapp.groups.settle_up.prepare': 'settleUp',
  'finapp.groups.expenses.list': 'transactions',
  'finapp.groups.expenses.get': 'expense',
  'finapp.groups.expenses.history': 'groups.expenseHistory',
  'finapp.groups.settlements.list': 'groups.settlements',
  'finapp.groups.messages.list': 'groups.chat',
  // Social
  'finapp.social.friends.list': 'people.friends',
  'finapp.social.requests.list': 'people.requests',
  'finapp.social.people.search': 'people.search',
  'finapp.social.direct_messages.conversations.list': 'chats.conversations',
  'finapp.social.direct_messages.list': 'chats.thread',
  'finapp.social.inbox': 'chats.inbox',
  'finapp.social.people.analytics': 'people.analytics',
  // Personal
  'finapp.personal.notifications.list': 'notifications.list',
  'finapp.personal.profile.get': 'settings.profile',
  'finapp.personal.notifications.summary': 'notifications.status',
  'finapp.personal.sessions.list': 'security.sessions',
  'finapp.personal.finai_settings.get': 'finai.settings',
};
