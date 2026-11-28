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
