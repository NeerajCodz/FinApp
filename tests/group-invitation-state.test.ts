import { describe, expect, it } from 'vitest';
import { groupInvitationState } from '../packages/ui/src/finance/groupInvitationState';
import { isGroupInvitationOffline } from '../apps/mobile/lib/groupInvitationNetwork';

const ready = {
  validToken: true,
  authLoading: false,
  authenticated: true,
  offline: false,
  connected: true,
  preview: { groupId: 'group', groupName: 'Household', currency: 'USD' },
};

describe('group invitation state on web and mobile', () => {
  it('waits for authentication rather than treating a loading identity as signed out', () => {
    expect(
      groupInvitationState({
        ...ready,
        authLoading: true,
        authenticated: false,
        connected: false,
        preview: undefined,
      }),
    ).toBe('auth-loading');
  });

  it('rejects malformed tokens before authentication or network status', () => {
    expect(
      groupInvitationState({
        ...ready,
        validToken: false,
        authLoading: true,
        authenticated: false,
        offline: true,
        connected: false,
        preview: undefined,
      }),
    ).toBe('invalid');
  });

  it('shows confirmed offline during authentication without hiding the signed-out prompt', () => {
    const offline = { ...ready, offline: true, connected: false, preview: undefined };
    expect(groupInvitationState({ ...offline, authLoading: true, authenticated: false })).toBe(
      'offline',
    );
    expect(groupInvitationState({ ...offline, authenticated: false })).toBe('signed-out');
  });

  it('offers sign-in for a valid link even before the service connects', () => {
    expect(
      groupInvitationState({
        ...ready,
        authenticated: false,
        connected: false,
        preview: undefined,
      }),
    ).toBe('signed-out');
  });

  it('does not call a disconnected or pending preview invalid', () => {
    expect(
      groupInvitationState({ ...ready, offline: true, connected: false, preview: undefined }),
    ).toBe('offline');
    expect(groupInvitationState({ ...ready, connected: false, preview: undefined })).toBe(
      'connecting',
    );
    expect(groupInvitationState({ ...ready, preview: undefined })).toBe('preview-loading');
  });

  it('tracks mobile reachability transitions without treating unknown as offline', () => {
    const stateFor = (
      network: Parameters<typeof isGroupInvitationOffline>[0],
      connected: boolean,
    ) =>
      groupInvitationState({
        ...ready,
        offline: isGroupInvitationOffline(network),
        connected,
        preview: connected ? ready.preview : undefined,
      });

    expect(stateFor({ isConnected: null, isInternetReachable: null }, false)).toBe('connecting');
    expect(stateFor({}, false)).toBe('connecting');
    expect(stateFor({ isConnected: false, isInternetReachable: null }, false)).toBe('offline');
    expect(stateFor({ isConnected: true, isInternetReachable: false }, false)).toBe('offline');
    expect(stateFor({ isConnected: true, isInternetReachable: null }, false)).toBe('connecting');
    expect(stateFor({ isConnected: true, isInternetReachable: true }, true)).toBe('valid');
  });

  it('distinguishes malformed, unavailable and valid invitations', () => {
    expect(groupInvitationState({ ...ready, validToken: false })).toBe('invalid');
    expect(groupInvitationState({ ...ready, preview: null })).toBe('invalid');
    expect(groupInvitationState(ready)).toBe('valid');
  });
});
