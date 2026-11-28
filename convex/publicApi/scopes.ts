/**
 * Public API scopes: fine-grained read/write per resource. A scope only narrows what a token may
 * call; every write still runs through the domain's own permission checks.
 */

export const API_SCOPES = [
  'profile:read',
  'accounts:read',
  'accounts:write',
  'transactions:read',
  'transactions:write',
  'categories:read',
  'categories:write',
  'budgets:read',
  'budgets:write',
  'goals:read',
  'goals:write',
  'groups:read',
  'groups:write',
  'splits:read',
  'splits:write',
  'recurring:read',
  'recurring:write',
  'notifications:read',
  'analytics:read',
  'export:read',
  'webhooks:manage',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

const known: ReadonlySet<string> = new Set(API_SCOPES);

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  'profile:read': 'Read your profile (name, username, default currency, timezone).',
  'accounts:read': 'Read accounts and balances.',
  'accounts:write': 'Create, update and archive accounts.',
  'transactions:read': 'Read transactions.',
  'transactions:write': 'Create, update and delete transactions.',
  'categories:read': 'Read categories.',
  'categories:write': 'Create, update and archive categories.',
  'budgets:read': 'Read category limits (budgets) and how much is spent.',
  'budgets:write': 'Set or remove category limits.',
  'goals:read': 'Read goals and contributions.',
  'goals:write': 'Create, update, archive and contribute to goals.',
  'groups:read': 'Read groups you belong to, their members and balances.',
  'groups:write': 'Create groups.',
  'splits:read': 'Read shared group expenses and settlements.',
  'splits:write': 'Add or delete shared expenses and record or undo settlements.',
  'recurring:read': 'Read recurring rules.',
  'recurring:write': 'Create, pause, resume and delete recurring rules.',
  'notifications:read': 'Read your notifications.',
  'analytics:read': 'Read spending and income analytics.',
  'export:read': 'Export raw records of your own data.',
  'webhooks:manage': 'Create, change and delete webhook endpoints.',
};

export function isApiScope(value: string): value is ApiScope {
  return known.has(value);
}

/**
 * Parses a space- or comma-separated scope string (or a list). Unknown scopes are rejected
 * rather than dropped, so a typo never silently grants less (or more) than intended.
 */
export function parseScopes(
  input: string | readonly string[],
): { ok: true; scopes: ApiScope[] } | { ok: false; invalid: string[] } {
  const raw = typeof input === 'string' ? input.split(/[\s,]+/) : [...input];
  const values = raw.map((value) => value.trim()).filter(Boolean);
  const invalid = values.filter((value) => !isApiScope(value));
  if (invalid.length) return { ok: false, invalid: [...new Set(invalid)] };
  return { ok: true, scopes: normalizeScopes(values as ApiScope[]) };
}

/** Deduplicated, in canonical order. */
export function normalizeScopes(scopes: readonly ApiScope[]): ApiScope[] {
  const set = new Set(scopes);
  return API_SCOPES.filter((scope) => set.has(scope));
}

/**
 * Whether `granted` covers `required`. A `:write` scope implies the matching `:read` scope
 * (you can't safely write what you can't read back); nothing else is implied.
 */
export function hasScope(granted: readonly string[], required: ApiScope): boolean {
  if (granted.includes(required)) return true;
  if (required.endsWith(':read')) {
    const write = required.replace(/:read$/, ':write');
    return granted.includes(write);
  }
  return false;
}

/** Scopes in `requested` that are not within `allowed` (used for apps' maximum scopes). */
export function scopesOutside(
  requested: readonly ApiScope[],
  allowed: readonly ApiScope[],
): ApiScope[] {
  return requested.filter((scope) => !hasScope(allowed, scope));
}

/** Resources grouped for scope pickers. */
export const SCOPE_GROUPS: { resource: string; label: string; scopes: ApiScope[] }[] = [
  { resource: 'profile', label: 'Profile', scopes: ['profile:read'] },
  { resource: 'accounts', label: 'Accounts', scopes: ['accounts:read', 'accounts:write'] },
  {
    resource: 'transactions',
    label: 'Transactions',
    scopes: ['transactions:read', 'transactions:write'],
  },
  { resource: 'categories', label: 'Categories', scopes: ['categories:read', 'categories:write'] },
  { resource: 'budgets', label: 'Budgets', scopes: ['budgets:read', 'budgets:write'] },
  { resource: 'goals', label: 'Goals', scopes: ['goals:read', 'goals:write'] },
  { resource: 'groups', label: 'Groups', scopes: ['groups:read', 'groups:write'] },
  { resource: 'splits', label: 'Splits & settlements', scopes: ['splits:read', 'splits:write'] },
  { resource: 'recurring', label: 'Recurring', scopes: ['recurring:read', 'recurring:write'] },
  { resource: 'notifications', label: 'Notifications', scopes: ['notifications:read'] },
  { resource: 'analytics', label: 'Analytics', scopes: ['analytics:read'] },
  { resource: 'export', label: 'Export', scopes: ['export:read'] },
  { resource: 'webhooks', label: 'Webhooks', scopes: ['webhooks:manage'] },
];
