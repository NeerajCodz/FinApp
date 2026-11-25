/**
 * The People hub: one place for the people you talk to and the groups you share. Shared model
 * for the web and native screens.
 */

export type HubPerson = {
  id: string;
  username?: string;
  displayName: string;
  avatarId?: string;
  avatarUrl?: string | null;
  conversationId?: string | null;
  unreadCount: number;
  unreadCapped?: boolean;
  active?: boolean | null;
  lastSeenAt?: number | null;
};

export type HubGroup = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  memberCount: number;
  /** "You're owed ₹720" / "You owe ₹1,200" / "Settled up". */
  balanceLabel?: string;
  balanceTone?: 'positive' | 'negative' | 'neutral';
  unreadCount?: number;
};

/** "Active now" / "Active 5m ago" / "" (privacy hides it). */
export function personStatus(person: Pick<HubPerson, 'active' | 'lastSeenAt'>, now = Date.now()) {
  if (person.active) return 'Active now';
  if (!person.lastSeenAt) return '';
  const minutes = Math.max(0, Math.round((now - person.lastSeenAt) / 60_000));
  if (minutes < 1) return 'Active just now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `Active ${days}d ago` : 'Active a while ago';
}

/** Case-insensitive match on name and handle. */
export function matchesHubSearch(
  item: { displayName?: string; name?: string; username?: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase().replace(/^@/, '');
  if (!needle) return true;
  return [item.displayName, item.name, item.username].some((value) =>
    value?.toLowerCase().includes(needle),
  );
}

export function unreadBadge(count: number | undefined, capped?: boolean): string | null {
  if (!count) return null;
  return capped || count > 9 ? '9+' : String(count);
}
