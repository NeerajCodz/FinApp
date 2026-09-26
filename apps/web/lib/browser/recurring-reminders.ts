export type DueReminder = {
  id?: unknown;
  _id?: unknown;
  name?: string;
  enabled?: boolean;
  nextOccurrence?: number;
};

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function deliverDueReminders(
  userId: string,
  rules: readonly DueReminder[],
  now: number,
  storage: KeyValueStorage,
  deliver: (rule: DueReminder) => void,
  sentThisSession = new Set<string>(),
): number {
  const key = `finapp.web.recurring-reminders.v1:${userId}`;
  const sent = new Set(sentThisSession);
  try {
    const saved = JSON.parse(storage.getItem(key) ?? '[]');
    if (Array.isArray(saved)) {
      for (const value of saved) if (typeof value === 'string') sent.add(value);
    }
  } catch {
    // Keep the in-memory set when storage is unavailable or corrupt.
  }

  let count = 0;
  const newlySent: string[] = [];
  for (const rule of rules) {
    const occurrence = Number(rule.nextOccurrence ?? 0);
    if (!rule.enabled || occurrence <= 0 || occurrence > now) continue;
    const id = String(rule.id ?? rule._id ?? '');
    const identity = `${id}:${occurrence}`;
    if (!id || sent.has(identity)) continue;
    try {
      deliver(rule);
      sent.add(identity);
      sentThisSession.add(identity);
      newlySent.push(identity);
      count += 1;
    } catch {
      // A notification may be revoked after permission was checked.
    }
  }

  if (newlySent.length > 0) {
    try {
      storage.setItem(key, JSON.stringify([...sent].slice(-500)));
    } catch {
      // The in-memory set still prevents duplicates for this page session.
    }
  }
  return count;
}
