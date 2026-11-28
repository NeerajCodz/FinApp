import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decryptOrPlaceholder,
  decryptText,
  encryptText,
  hashIdentifier,
  isAdminCryptoConfigured,
  isEncrypted,
} from '../../convex/admin/crypto';
import {
  dayStart,
  DAY_MS,
  FEATURE_METRICS,
  isAggregateMetric,
  isFeatureMetric,
  isUsageMetric,
  metricForOperation,
  shardFor,
  USAGE_SHARDS,
} from '../../convex/admin/usageMetrics';
import { statusAfterMessage } from '../../convex/support/domain';

const KEY_A = Buffer.alloc(32, 7).toString('base64');
const KEY_B = Buffer.alloc(32, 9).toString('base64');

describe('admin encryption', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ADMIN_DATA_KEY;
    delete process.env.AI_KEYS_SECRET;
    delete process.env.ADMIN_HASH_SALT;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('round-trips with ADMIN_DATA_KEY and never stores plaintext', async () => {
    process.env.ADMIN_DATA_KEY = KEY_A;
    const stored = await encryptText('My card was charged twice', 'support-ticket:u1');
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('charged');
    expect(await decryptText(stored, 'support-ticket:u1')).toBe('My card was charged twice');
    // Fresh IV per call.
    expect(await encryptText('same', 'c')).not.toBe(await encryptText('same', 'c'));
  });

  it('binds the context: a ciphertext cannot be read as another record', async () => {
    process.env.ADMIN_DATA_KEY = KEY_A;
    const stored = await encryptText('secret', 'support-ticket:u1');
    await expect(decryptText(stored, 'support-ticket:u2')).rejects.toThrow();
    expect(await decryptOrPlaceholder(stored, 'report:u1')).toMatch(/unreadable/);
  });

  it('fails closed without a key and derives one from AI_KEYS_SECRET', async () => {
    expect(await isAdminCryptoConfigured()).toBe(false);
    await expect(encryptText('x', 'c')).rejects.toThrow('ADMIN_DATA_KEY_NOT_CONFIGURED');
    process.env.AI_KEYS_SECRET = KEY_B;
    expect(await isAdminCryptoConfigured()).toBe(true);
    const stored = await encryptText('derived', 'c');
    expect(await decryptText(stored, 'c')).toBe('derived');
    // The derived key differs from using the vault secret directly.
    process.env.ADMIN_DATA_KEY = KEY_B;
    await expect(decryptText(stored, 'c')).rejects.toThrow();
  });

  it('rejects malformed keys and values', async () => {
    process.env.ADMIN_DATA_KEY = 'too-short';
    expect(await isAdminCryptoConfigured()).toBe(false);
    process.env.ADMIN_DATA_KEY = KEY_A;
    await expect(decryptText('plain text', 'c')).rejects.toThrow('ADMIN_DATA_CORRUPT');
  });

  it('hashes identifiers with a salt, case-insensitively and irreversibly', async () => {
    process.env.ADMIN_DATA_KEY = KEY_A;
    const first = await hashIdentifier('Alice@Example.com ');
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(await hashIdentifier('alice@example.com')).toBe(first);
    expect(first).not.toContain('alice');
    process.env.ADMIN_HASH_SALT = 'another-salt';
    expect(await hashIdentifier('alice@example.com')).not.toBe(first);
  });
});

describe('usage metric whitelist', () => {
  it('accepts only known event kinds', () => {
    expect(isFeatureMetric('transaction.create')).toBe(true);
    expect(isFeatureMetric('ai.tokens.prompt')).toBe(false);
    expect(isAggregateMetric('ai.tokens.prompt')).toBe(true);
    for (const value of [
      'transaction.amount',
      'transaction.create.123',
      'note:groceries',
      '__proto__',
      'toString',
      '',
      42,
      null,
    ])
      expect(isUsageMetric(value)).toBe(false);
  });

  it('every metric is an event kind, not a payload', () => {
    for (const key of Object.keys(FEATURE_METRICS)) expect(key).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('maps sync operations onto feature metrics', () => {
    expect(metricForOperation('transaction.create')).toBe('transaction.create');
    expect(metricForOperation('account.rename')).toBe('account.update');
    expect(metricForOperation('group.addExpense')).toBe('split.create');
    expect(metricForOperation('group.respondToInvitation')).toBe('group.join');
    expect(metricForOperation('goal.contribute')).toBe('goal.contribute');
    expect(metricForOperation('notification.markAllRead')).toBe('notification.read');
    expect(metricForOperation('notification.remove')).toBeNull();
    expect(metricForOperation('something.else')).toBeNull();
  });

  it('buckets days in UTC and shards users stably', () => {
    const time = Date.UTC(2026, 10, 28, 23, 59);
    expect(dayStart(time)).toBe(Date.UTC(2026, 10, 28));
    expect(dayStart(time + 2 * 60_000)).toBe(Date.UTC(2026, 10, 28) + DAY_MS);
    expect(shardFor('user-1')).toBe(shardFor('user-1'));
    for (let index = 0; index < 50; index += 1) {
      const shard = shardFor(`u${index}`);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(USAGE_SHARDS);
    }
  });
});

describe('ticket status flow', () => {
  it('reopens on a user reply and waits on the user after staff replies', () => {
    expect(statusAfterMessage('pending', 'user')).toBe('open');
    expect(statusAfterMessage('resolved', 'user')).toBe('open');
    expect(statusAfterMessage('closed', 'user')).toBe('closed');
    expect(statusAfterMessage('open', 'staff')).toBe('pending');
    expect(statusAfterMessage('resolved', 'staff')).toBe('resolved');
  });
});
