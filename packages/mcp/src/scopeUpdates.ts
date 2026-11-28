export type ScopeUpdateState = {
  scopes: string[];
  serverScopes: string[];
  pending: Promise<unknown>;
  pendingCount: number;
};

export const createScopeUpdateState = (scopes: readonly string[]): ScopeUpdateState => ({
  scopes: [...scopes],
  serverScopes: [...scopes],
  pending: Promise.resolve(),
  pendingCount: 0,
});

export const syncScopeUpdateFromServer = (update: ScopeUpdateState, scopes: readonly string[]) => {
  update.serverScopes = [...scopes];
  if (update.pendingCount === 0) update.scopes = [...update.serverScopes];
};

export const queueScopeUpdate = (
  update: ScopeUpdateState,
  scope: string,
  enabled: boolean,
  mutate: (scopes: string[]) => Promise<unknown>,
) => {
  update.pendingCount += 1;

  const pending = update.pending
    .catch(() => undefined)
    .then(() => {
      const scopes = enabled
        ? [...new Set([...update.scopes, scope])]
        : update.scopes.filter((item) => item !== scope);
      update.scopes = scopes;
      const serverScopes = update.serverScopes;
      return mutate(scopes).then(
        (result) => {
          if (update.serverScopes === serverScopes) update.serverScopes = [...scopes];
          update.scopes = [...update.serverScopes];
          return result;
        },
        (error: unknown) => {
          update.scopes = [...update.serverScopes];
          throw error;
        },
      );
    });
  update.pending = pending;
  return pending.finally(() => {
    update.pendingCount -= 1;
    if (update.pendingCount === 0) update.scopes = [...update.serverScopes];
  });
};
