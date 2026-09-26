import { describe, expect, it } from 'vitest';
import { deliverDueReminders, type DueReminder } from '../../apps/web/lib/browser/recurring-reminders';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('foreground recurring reminders', () => {
  it('delivers each due occurrence once and ignores paused or future rules', () => {
    const storage = createStorage();
    const sent = new Set<string>();
    const now = 10_000;
    const rules: DueReminder[] = [
      { id: 'due', enabled: true, nextOccurrence: now },
      { id: 'future', enabled: true, nextOccurrence: now + 1 },
      { id: 'paused', enabled: false, nextOccurrence: now - 1 },
    ];
    const delivered: DueReminder[] = [];
    const deliver = (rule: DueReminder) => delivered.push(rule);

    expect(deliverDueReminders('user-a', rules, now, storage, deliver, sent)).toBe(1);
    expect(delivered.map((rule) => rule.id)).toEqual(['due']);
    expect(deliverDueReminders('user-a', rules, now, storage, deliver, sent)).toBe(0);
    expect(delivered).toHaveLength(1);
  });

  it('keeps a due occurrence eligible until delivery succeeds', () => {
    const storage = createStorage();
    const rule: DueReminder = { id: 'due', enabled: true, nextOccurrence: 10_000 };
    const sent = new Set<string>();

    expect(
      deliverDueReminders('user-a', [rule], 10_000, storage, () => {
        throw new Error('notification permission was revoked');
      }, sent),
    ).toBe(0);
    let delivered = 0;
    expect(
      deliverDueReminders('user-a', [rule], 10_000, storage, () => {
        delivered += 1;
      }, sent),
    ).toBe(1);
    expect(delivered).toBe(1);
  });
});
