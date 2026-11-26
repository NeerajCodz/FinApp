import { describe, expect, it } from 'vitest';
import {
  defaultNotificationPreferences,
  isSafeNotificationUrl,
  normalizeNotificationPreferences,
  notificationRoute,
  notificationTypes,
  nudgeErrorCode,
  nudgeMessage,
  paymentReminderEntityId,
} from '../../convex/notifications/domain';
import {
  buildPushMessages,
  chunk,
  isExpoPushToken,
  unregisteredTokens,
} from '../../convex/notifications/push';

describe('notification preferences', () => {
  it('defaults every type, including split', () => {
    expect(normalizeNotificationPreferences(undefined)).toEqual(defaultNotificationPreferences);
    expect(notificationTypes).toContain('split');
    expect(defaultNotificationPreferences.split).toBe(true);
  });

  it('maps preferences stored before split existed from the group preference', () => {
    const legacy = { ...defaultNotificationPreferences, group: false } as Record<string, boolean>;
    delete legacy.split;
    expect(normalizeNotificationPreferences(legacy)).toMatchObject({ group: false, split: false });
    expect(normalizeNotificationPreferences({ group: true })).toMatchObject({ split: true });
  });

  it('keeps an explicit split preference', () => {
    expect(normalizeNotificationPreferences({ group: false, split: true })).toMatchObject({
      group: false,
      split: true,
    });
    expect(normalizeNotificationPreferences({ group: true, split: 'yes' })).toMatchObject({
      split: true,
    });
  });
});

describe('notification routes', () => {
  it('opens security settings for account and session alerts only when they are security events', () => {
    expect(notificationRoute({ type: 'security', entityType: 'account', entityId: 'u1' })).toBe(
      '/settings/security',
    );
    expect(notificationRoute({ type: 'security', entityType: 'session' })).toBe(
      '/settings/security',
    );
    expect(notificationRoute({ type: 'transaction', entityType: 'account' })).toBe(
      '/notifications',
    );
  });

  it('deep-links split edits to the expense', () => {
    expect(notificationRoute({ type: 'split', entityType: 'transaction', entityId: 'tx 1' })).toBe(
      '/transaction/tx%201',
    );
  });

  it('opens a group balances view for settlement events', () => {
    expect(
      notificationRoute({ type: 'settlement', entityType: 'settlement', entityId: 'g1' }),
    ).toBe('/group/g1/balances');
  });

  it('opens settle-up with the creditor for payment reminders', () => {
    expect(
      notificationRoute({
        type: 'settlement',
        entityType: 'paymentReminder',
        entityId: paymentReminderEntityId('g1', 'u2'),
      }),
    ).toBe('/settle/new?groupId=g1&member=u2');
  });

  it('keeps existing routes', () => {
    expect(notificationRoute({ type: 'split', entityType: 'group', entityId: 'g1' })).toBe(
      '/group/g1',
    );
    expect(notificationRoute({ type: 'group', entityType: 'groupInvitation' })).toBe(
      '/groups?invitations=1',
    );
    expect(notificationRoute({ type: 'recurring', entityType: 'recurring' })).toBe('/recurring');
    expect(notificationRoute({ type: 'budget', entityType: 'budget', entityId: 'b1' })).toBe(
      '/budget/b1',
    );
    expect(notificationRoute({ type: 'goal' })).toBe('/notifications');
  });

  it('accepts only in-app paths', () => {
    expect(isSafeNotificationUrl('/group/1')).toBe(true);
    expect(isSafeNotificationUrl('https://evil.example')).toBe(false);
    expect(isSafeNotificationUrl('//evil.example')).toBe(false);
    expect(isSafeNotificationUrl('/\\evil.example')).toBe(false);
    expect(isSafeNotificationUrl(42)).toBe(false);
  });
});

describe('nudge copy', () => {
  it('maps server outcomes to messages', () => {
    expect(nudgeMessage({ status: 'sent' }, 'Asha')).toBe('Reminder sent to Asha.');
    expect(nudgeMessage({ status: 'alreadySent' })).toBe('Already reminded today.');
    expect(nudgeErrorCode(new Error('[CONVEX M] Uncaught Error: NOTHING_OWED at handler'))).toBe(
      'NOTHING_OWED',
    );
    expect(nudgeMessage({ status: 'error', code: 'NOTHING_OWED' }, 'Asha')).toContain(
      'doesn’t owe you',
    );
    expect(nudgeErrorCode('boom')).toBe('UNKNOWN');
  });
});

describe('push helpers', () => {
  it('validates Expo push tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abcdefgh1234]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abcdefgh1234]')).toBe(true);
    expect(isExpoPushToken('fcm-token')).toBe(false);
  });

  it('builds deduplicated messages with a safe url and batches them', () => {
    const messages = buildPushMessages(['a', 'a', 'b'], {
      notificationId: 'n1',
      title: 'T',
      body: 'B',
      url: 'https://evil.example',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]!.data).toEqual({ url: '/notifications', notificationId: 'n1' });
    expect(
      chunk(
        Array.from({ length: 250 }, (_, i) => i),
        100,
      ).map((c) => c.length),
    ).toEqual([100, 100, 50]);
  });

  it('reports tokens Expo no longer recognises', () => {
    const messages = buildPushMessages(['a', 'b', 'c'], {
      notificationId: 'n1',
      title: 'T',
      body: 'B',
      url: '/x',
    });
    expect(
      unregisteredTokens(messages, [
        { status: 'ok' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', details: { error: 'MessageRateExceeded' } },
      ]),
    ).toEqual(['b']);
  });
});
