export const INVITATION_LINK_DEFAULT_EXPIRY_MS = 7 * 86_400_000;

export const INVITATION_LINK_EXPIRY_OPTIONS = [
  { value: 86_400_000, label: '1 day' },
  { value: INVITATION_LINK_DEFAULT_EXPIRY_MS, label: '7 days' },
  { value: 30 * 86_400_000, label: '30 days' },
] as const;

export type InvitationLinkExpiryMs = (typeof INVITATION_LINK_EXPIRY_OPTIONS)[number]['value'];
