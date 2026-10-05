export type SocialProfileSummary = {
  id: string;
  username?: string;
  displayName: string;
  avatarId?: string;
  avatarUrl?: string | null;
};

export type SocialRelationshipStatus =
  'unknown' | 'self' | 'none' | 'incoming' | 'outgoing' | 'friends';
