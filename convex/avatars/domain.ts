export const avatarGenders = ['neutral', 'male', 'female'] as const;
export type AvatarGender = (typeof avatarGenders)[number];

export function avatarIndex(avatarId: string): number | null {
  const match = /^AV(0|[1-9]\d?|100)$/.exec(avatarId);
  if (!match) return null;
  const index = Number(match[1]);
  return index <= 100 ? index : null;
}

export function avatarGenderForId(avatarId: string): AvatarGender | null {
  const index = avatarIndex(avatarId);
  if (index === null) return null;
  if (index === 0) return 'neutral';
  return index <= 50 ? 'male' : 'female';
}
