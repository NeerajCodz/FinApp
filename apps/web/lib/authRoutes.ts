const pendingGroupInvitationKey = 'finapp.pending-group-invitation';

export function groupInvitationPath(token: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const query = new URLSearchParams({ token });
  return `/group-invite?${query.toString()}`;
}

export function rememberPendingGroupInvitation(token: string): boolean {
  if (!groupInvitationPath(token) || typeof window === 'undefined') return false;
  try {
    window.sessionStorage.setItem(pendingGroupInvitationKey, token);
    return true;
  } catch {
    return false;
  }
}

export function pendingGroupInvitationPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.sessionStorage.getItem(pendingGroupInvitationKey);
    return token ? groupInvitationPath(token) : null;
  } catch {
    return null;
  }
}

export function clearPendingGroupInvitation(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(pendingGroupInvitationKey);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

export function unverifiedSignInVerificationUrl(email: string): string {
  const query = new URLSearchParams({ email, next: 'onboarding' });
  return `/verify?${query.toString()}`;
}
