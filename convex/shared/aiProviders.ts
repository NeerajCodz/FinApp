/**
 * Bring-your-own-key (BYOK) providers FinAI can run on. Shared by the backend (adapters, key
 * checks) and the settings screens. `api` picks the wire format:
 * - `openai`: Chat Completions with tools (OpenAI, OpenRouter, Groq, Mistral, xAI, DeepSeek,
 *   and any OpenAI-compatible endpoint);
 * - `anthropic`: the Messages API;
 * - `gemini`: Google's Generative Language API (the same client FinAI uses by default).
 */

export const AI_PROVIDER_IDS = [
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'groq',
  'mistral',
  'xai',
  'deepseek',
  'custom',
] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];
export type AiProviderApi = 'openai' | 'anthropic' | 'gemini';

export type AiProvider = {
  id: AiProviderId;
  label: string;
  api: AiProviderApi;
  /** Default API base (no trailing slash). `custom` requires the user's own. */
  baseUrl: string;
  /** Suggested models (first is the default); any model id the account can use is accepted. */
  models: readonly string[];
  /** Where to create a key. */
  keyUrl: string;
  /** Typical key prefix, shown as a hint only. */
  keyPrefix?: string;
};

export const AI_PROVIDERS: Record<AiProviderId, AiProvider> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.1', 'gpt-5.1-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    api: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-pro-latest'],
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-5.1',
      'anthropic/claude-sonnet-5-5',
      'google/gemini-3.8-flash',
      'meta-llama/llama-4-maverick',
    ],
    keyUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    api: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct', 'openai/gpt-oss-120b'],
    keyUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    api: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  xai: {
    id: 'xai',
    label: 'xAI',
    api: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4', 'grok-4-fast'],
    keyUrl: 'https://console.x.ai',
    keyPrefix: 'xai-',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    api: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPrefix: 'sk-',
  },
  custom: {
    id: 'custom',
    label: 'OpenAI-compatible',
    api: 'openai',
    baseUrl: '',
    models: [],
    keyUrl: '',
  },
};

export const AI_KEY_LIMITS = { keys: 10, label: 60, model: 120, key: 512, baseUrl: 300 } as const;

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

/** A custom base URL: HTTPS, a public hostname, no credentials or fragment. */
export function validCustomBaseUrl(value: string): boolean {
  if (!value || value.length > AI_KEY_LIMITS.baseUrl) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      host.includes('.') &&
      host !== 'localhost' &&
      !/^\d{1,3}(\.\d{1,3}){3}$/.test(host) &&
      !host.includes(':')
    );
  } catch {
    return false;
  }
}

/** "sk-…a1b2" style hint; never more than the last four characters. */
export function keyHint(key: string): string {
  const trimmed = key.trim();
  const prefix = trimmed.match(/^[A-Za-z]+[-_]?/)?.[0]?.slice(0, 7) ?? '';
  return `${prefix}…${trimmed.slice(-4)}`;
}
