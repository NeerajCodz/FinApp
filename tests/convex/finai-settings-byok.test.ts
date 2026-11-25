import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import {
  FINAI_DEFAULTS,
  finaiPreferencePrompt,
  finaiToolAllowed,
  resolveFinaiSettings,
} from '../../convex/shared/finaiSettings';
import { keyHint, validCustomBaseUrl } from '../../convex/shared/aiProviders';
import { anthropicMessages, openAiMessages, toJsonSchema } from '../../convex/ai/providers';
import { decryptSecret, encryptSecret } from '../../convex/ai/keyVault';

const modules = import.meta.glob('../../convex/**/*.ts');
const SECRET = Buffer.alloc(32, 7).toString('base64');

async function signedIn() {
  const t = convexTest(schema, modules);
  const subject = 'finai-settings-user';
  const userId = await t.run((ctx) =>
    ctx.db.insert('users', { identityId: subject, email: `${subject}@example.com`, displayName: 'Asha' }),
  );
  return { t, userId, me: t.withIdentity({ subject, email: `${subject}@example.com` }) };
}

describe('FinAI settings', () => {
  it('defaults, partial updates and validation', async () => {
    const { me, t } = await signedIn();
    expect(await me.query(api.ai.settings.get, {})).toEqual(FINAI_DEFAULTS);
    const next = await me.mutation(api.ai.settings.update, {
      tone: 'concise',
      dataScopes: { people: false },
      aboutMe: 'Student',
    });
    expect(next).toMatchObject({
      tone: 'concise',
      aboutMe: 'Student',
      dataScopes: { money: true, planning: true, groups: true, people: false },
    });
    expect(await me.query(api.ai.settings.get, {})).toEqual(next);
    await expect(
      me.mutation(api.ai.settings.update, { aboutMe: 'x'.repeat(1001) }),
    ).rejects.toThrow('TEXT_TOO_LONG');
    await expect(t.mutation(api.ai.settings.update, { tone: 'friendly' })).rejects.toThrow();
  });

  it('turns preferences into prompt lines and filters tools', () => {
    const settings = resolveFinaiSettings({
      tone: 'professional',
      language: 'Tamil',
      allowActions: false,
      dataScopes: { money: false, planning: true, groups: true, people: true },
      customInstructions: 'Compare with last month.',
    });
    const prompt = finaiPreferencePrompt(settings);
    expect(prompt).toContain('always reply in Tamil');
    expect(prompt).toContain('access to: money');
    expect(prompt).toContain('Compare with last month.');
    expect(finaiToolAllowed(settings, 'search_transactions')).toBe(false);
    expect(finaiToolAllowed(settings, 'list_budgets')).toBe(true);
    expect(finaiToolAllowed(settings, 'propose_transaction')).toBe(false);
  });

  it('drops unknown or malformed stored values', () => {
    expect(resolveFinaiSettings({ tone: 'angry' as never, enabled: 'yes' as never })).toMatchObject({
      tone: 'friendly',
      enabled: true,
    });
  });

  it('clears every conversation', async () => {
    const { me, t, userId } = await signedIn();
    await t.run(async (ctx) => {
      for (let index = 0; index < 3; index += 1)
        await ctx.db.insert('finaiConversations', { userId, createdAt: index, updatedAt: index });
    });
    expect(await me.mutation(api.ai.settings.clearHistory, {})).toEqual({ deleted: 3, more: false });
    expect(await t.run((ctx) => ctx.db.query('finaiConversations').collect())).toHaveLength(0);
  });
});

describe('BYOK adapters', () => {
  const contents = [
    { role: 'user' as const, parts: [{ text: 'How much on food?' }] },
    {
      role: 'model' as const,
      parts: [{ text: 'Checking.' }, { functionCall: { name: 'spending_breakdown', args: { days: 30 } } }],
    },
    {
      role: 'user' as const,
      parts: [{ functionResponse: { name: 'spending_breakdown', response: { total: '₹4,320' } } }],
    },
  ];

  it('maps turns to OpenAI chat messages with paired tool call ids', () => {
    const messages = openAiMessages('System', contents);
    expect(messages[0]).toEqual({ role: 'system', content: 'System' });
    const assistant = messages[2] as { tool_calls: { id: string; function: { arguments: string } }[] };
    const tool = messages[3] as { role: string; tool_call_id: string; content: string };
    expect(assistant.tool_calls[0]!.function.arguments).toBe('{"days":30}');
    expect(tool.role).toBe('tool');
    expect(tool.tool_call_id).toBe(assistant.tool_calls[0]!.id);
  });

  it('maps turns to Anthropic blocks with alternating roles', () => {
    const messages = anthropicMessages(contents);
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
    const toolUse = messages[1]!.content[1] as { type: string; id: string };
    const toolResult = messages[2]!.content[0] as { type: string; tool_use_id: string };
    expect(toolUse.type).toBe('tool_use');
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: toolUse.id });
  });

  it('converts Gemini schemas to JSON Schema', () => {
    expect(
      toJsonSchema({ type: 'OBJECT', properties: { days: { type: 'INTEGER', description: 'd' } } } as never),
    ).toEqual({ type: 'object', properties: { days: { type: 'integer', description: 'd' } } });
  });

  it('validates base URLs and hides keys', () => {
    expect(validCustomBaseUrl('https://api.example.com/v1')).toBe(true);
    expect(validCustomBaseUrl('http://api.example.com/v1')).toBe(false);
    expect(validCustomBaseUrl('https://127.0.0.1/v1')).toBe(false);
    expect(keyHint('sk-proj-abcdefgh1234')).toBe('sk-…1234');
  });
});

describe('BYOK key vault and storage', () => {
  beforeEach(() => vi.stubEnv('AI_KEYS_SECRET', SECRET));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('round-trips and binds ciphertext to the user', async () => {
    const stored = await encryptSecret('sk-secret', 'user-a');
    expect(stored).not.toContain('sk-secret');
    expect(await decryptSecret(stored, 'user-a')).toBe('sk-secret');
    await expect(decryptSecret(stored, 'user-b')).rejects.toThrow();
  });

  it('adds a checked key, activates it, and never returns the secret', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"data":[]}', { status: 200 })));
    const { me } = await signedIn();
    const result = await me.action(api.ai.keys.add, {
      provider: 'openai',
      apiKey: 'sk-test-abcdefgh9999',
      model: 'gpt-5.1',
    });
    expect(result.status).toBe('ok');
    const listed = await me.query(api.ai.keys.list, {});
    expect(listed.vault).toBe(true);
    expect(listed.keys).toEqual([
      expect.objectContaining({ provider: 'openai', active: true, keyHint: 'sk-…9999', status: 'ok' }),
    ]);
    expect(JSON.stringify(listed)).not.toContain('abcdefgh9999');
    await me.mutation(api.ai.keys.setActive, { keyId: null });
    expect((await me.query(api.ai.keys.list, {})).keys[0]!.active).toBe(false);
  });

  it('refuses a key the provider rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const { me } = await signedIn();
    await expect(
      me.action(api.ai.keys.add, { provider: 'anthropic', apiKey: 'sk-ant-bad', model: 'claude-sonnet-5-5' }),
    ).rejects.toThrow('AI_KEY_INVALID');
    expect((await me.query(api.ai.keys.list, {})).keys).toHaveLength(0);
  });

  it('requires an HTTPS base URL for custom endpoints', async () => {
    const { me } = await signedIn();
    await expect(
      me.action(api.ai.keys.add, { provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'http://x.example.com' }),
    ).rejects.toThrow('INVALID_BASE_URL');
  });
});
