import { describe, expect, it } from 'vitest';
import { groupInvitationState } from '../packages/ui/src/finance/groupInvitationState';

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

  it('offers sign-in for a valid link even before the service connects', () => {
    expect(
      groupInvitationState({ ...ready, authenticated: false, connected: false, preview: undefined }),
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

  it('distinguishes malformed, unavailable and valid invitations', () => {
    expect(groupInvitationState({ ...ready, validToken: false })).toBe('invalid');
    expect(groupInvitationState({ ...ready, preview: null })).toBe('invalid');
    expect(groupInvitationState(ready)).toBe('valid');
  });
});
