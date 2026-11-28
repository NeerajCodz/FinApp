import { describe, expect, it } from 'vitest';
import {
  createScopeUpdateState,
  queueScopeUpdate,
  syncScopeUpdateFromServer,
} from '../../packages/mcp/src/scopeUpdates';

describe('MCP scope update queue', () => {
  it('uses the latest reactive scopes after a pending toggle fails', async () => {
    const update = createScopeUpdateState(['finapp:read']);
    let rejectMutation!: (error: Error) => void;
    const pendingMutation = new Promise<never>((_resolve, reject) => {
      rejectMutation = reject;
    });
    const pending = queueScopeUpdate(update, 'finapp:write:finance', true, () => pendingMutation);

    syncScopeUpdateFromServer(update, ['finapp:read', 'finapp:write:social']);
    rejectMutation(new Error('mutation failed'));
    await expect(pending).rejects.toThrow('mutation failed');

    expect(update.scopes).toEqual(['finapp:read', 'finapp:write:social']);
  });
  it('rebases a queued toggle on reactive scopes received during an earlier mutation', async () => {
    const update = createScopeUpdateState(['finapp:read']);
    const { promise: started, resolve: markStarted } = Promise.withResolvers<void>();
    const { promise: firstMutation, resolve: finishFirst } = Promise.withResolvers<void>();
    const calls: string[][] = [];
    const first = queueScopeUpdate(update, 'finapp:write:finance', true, (scopes) => {
      calls.push(scopes);
      markStarted();
      return firstMutation;
    });
    const second = queueScopeUpdate(update, 'finapp:write:groups', true, async (scopes) => {
      calls.push(scopes);
    });

    await started;
    syncScopeUpdateFromServer(update, ['finapp:read', 'finapp:write:social']);
    finishFirst();
    await Promise.all([first, second]);

    expect(calls[1]).toEqual(['finapp:read', 'finapp:write:social', 'finapp:write:groups']);
    expect(update.scopes).toEqual(calls[1]);
  });

  it('does not retain a failed optimistic permission when no server update arrives', async () => {
    const update = createScopeUpdateState(['finapp:read']);

    await expect(
      queueScopeUpdate(update, 'finapp:write:finance', true, async () => {
        throw new Error('mutation failed');
      }),
    ).rejects.toThrow('mutation failed');

    expect(update.scopes).toEqual(['finapp:read']);
  });
});
