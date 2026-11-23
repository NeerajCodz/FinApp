export type GroupInvitationState =
  | 'auth-loading'
  | 'invalid'
  | 'signed-out'
  | 'offline'
  | 'connecting'
  | 'preview-loading'
  | 'valid';

export function groupInvitationState(input: {
  validToken: boolean;
  authLoading: boolean;
  authenticated: boolean;
  offline: boolean;
  connected: boolean;
  preview: unknown | null | undefined;
}): GroupInvitationState {
  if (!input.validToken) return 'invalid';
  if (input.authLoading) return input.offline ? 'offline' : 'auth-loading';
  if (!input.authenticated) return 'signed-out';
  if (input.offline) return 'offline';
  if (!input.connected) return 'connecting';
  if (input.preview === undefined) return 'preview-loading';
  return input.preview === null ? 'invalid' : 'valid';
}
