/**
 * FinAI preferences: one canonical shape for the backend (prompt, tools, mentions, receipts) and
 * the settings screens on web and mobile. Stored per user in `finaiSettings`; missing fields fall
 * back to `FINAI_DEFAULTS`.
 */

export const FINAI_TONES = ['friendly', 'concise', 'professional', 'playful'] as const;
export const FINAI_LENGTHS = ['short', 'balanced', 'detailed'] as const;
export const FINAI_LANGUAGES = [
  'auto',
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Japanese',
  'Arabic',
] as const;
/** How long FinAI chat attachments are kept before their files are deleted. */
export const FINAI_ATTACHMENT_RETENTIONS = ['1h', '24h', '7d', '30d', 'never'] as const;
export type FinaiAttachmentRetention = (typeof FINAI_ATTACHMENT_RETENTIONS)[number];

/** Milliseconds for a retention choice, or null for "never". */
export function attachmentRetentionMs(retention: FinaiAttachmentRetention): number | null {
  const hour = 60 * 60 * 1000;
  switch (retention) {
    case '1h':
      return hour;
    case '24h':
      return 24 * hour;
    case '7d':
      return 7 * 24 * hour;
    case '30d':
      return 30 * 24 * hour;
    case 'never':
      return null;
  }
}

/** What FinAI may read. Each maps to a set of tools. */
export const FINAI_DATA_SCOPES = ['money', 'planning', 'groups', 'people'] as const;

export type FinaiTone = (typeof FINAI_TONES)[number];
export type FinaiLength = (typeof FINAI_LENGTHS)[number];
export type FinaiLanguage = (typeof FINAI_LANGUAGES)[number];
export type FinaiDataScope = (typeof FINAI_DATA_SCOPES)[number];

export type FinaiSettings = {
  /** Master switch: off hides FinAI and refuses requests. */
  enabled: boolean;
  tone: FinaiTone;
  length: FinaiLength;
  language: FinaiLanguage;
  /** Extra instructions appended to the system prompt (≤ 1500 chars). */
  customInstructions: string;
  /** What FinAI should know about you (≤ 1000 chars), e.g. "Student, paid monthly". */
  aboutMe: string;
  useEmoji: boolean;
  /** Data FinAI may read through tools. */
  dataScopes: Record<FinaiDataScope, boolean>;
  /** May prepare confirm-first cards (transactions, splits, settlements, contributions). */
  allowActions: boolean;
  /** Answer when you @finai in group chats and DMs. */
  allowChatMentions: boolean;
  /** Pick a category for scanned receipts automatically. */
  autoCategorizeReceipts: boolean;
  /** Show the step-by-step process list on replies. */
  showSteps: boolean;
  /** Show the floating FinAI button across the app. */
  showLauncher: boolean;
  /** Attach images, PDFs and spreadsheets to FinAI chats. */
  allowAttachments: boolean;
  /** When attached files are deleted from storage (the chat keeps their names). */
  attachmentRetention: FinaiAttachmentRetention;
};

export const FINAI_DEFAULTS: FinaiSettings = {
  enabled: true,
  tone: 'friendly',
  length: 'balanced',
  language: 'auto',
  customInstructions: '',
  aboutMe: '',
  useEmoji: false,
  dataScopes: { money: true, planning: true, groups: true, people: true },
  allowActions: true,
  allowChatMentions: true,
  autoCategorizeReceipts: true,
  showSteps: true,
  showLauncher: true,
  allowAttachments: true,
  attachmentRetention: '24h',
};

export const FINAI_LIMITS = { customInstructions: 1500, aboutMe: 1000 } as const;

/** Assistant tools grouped by the data they read. `propose_*` tools follow `allowActions`. */
export const FINAI_SCOPE_TOOLS: Record<FinaiDataScope, readonly string[]> = {
  money: [
    'get_overview',
    'search_transactions',
    'spending_breakdown',
    'list_accounts',
    'list_categories',
    'list_recurring',
    'list_trash',
  ],
  planning: ['list_category_limits', 'list_goals'],
  groups: ['list_groups', 'group_balances', 'group_expenses'],
  people: ['list_friends'],
};

/** Merges a stored (possibly partial or older) record over the defaults, dropping bad values. */
export function resolveFinaiSettings(
  stored: Partial<FinaiSettings> | null | undefined,
): FinaiSettings {
  const value = stored ?? {};
  const pick = <T extends string>(options: readonly T[], candidate: unknown, fallback: T): T =>
    typeof candidate === 'string' && (options as readonly string[]).includes(candidate)
      ? (candidate as T)
      : fallback;
  const bool = (candidate: unknown, fallback: boolean) =>
    typeof candidate === 'boolean' ? candidate : fallback;
  const text = (candidate: unknown, max: number) =>
    typeof candidate === 'string' ? candidate.slice(0, max) : '';
  const scopes = (value.dataScopes ?? {}) as Partial<Record<FinaiDataScope, unknown>>;
  return {
    enabled: bool(value.enabled, FINAI_DEFAULTS.enabled),
    tone: pick(FINAI_TONES, value.tone, FINAI_DEFAULTS.tone),
    length: pick(FINAI_LENGTHS, value.length, FINAI_DEFAULTS.length),
    language: pick(FINAI_LANGUAGES, value.language, FINAI_DEFAULTS.language),
    customInstructions: text(value.customInstructions, FINAI_LIMITS.customInstructions),
    aboutMe: text(value.aboutMe, FINAI_LIMITS.aboutMe),
    useEmoji: bool(value.useEmoji, FINAI_DEFAULTS.useEmoji),
    dataScopes: {
      money: bool(scopes.money, true),
      planning: bool(scopes.planning, true),
      groups: bool(scopes.groups, true),
      people: bool(scopes.people, true),
    },
    allowActions: bool(value.allowActions, FINAI_DEFAULTS.allowActions),
    allowChatMentions: bool(value.allowChatMentions, FINAI_DEFAULTS.allowChatMentions),
    autoCategorizeReceipts: bool(
      value.autoCategorizeReceipts,
      FINAI_DEFAULTS.autoCategorizeReceipts,
    ),
    showSteps: bool(value.showSteps, FINAI_DEFAULTS.showSteps),
    showLauncher: bool(value.showLauncher, FINAI_DEFAULTS.showLauncher),
    allowAttachments: bool(value.allowAttachments, FINAI_DEFAULTS.allowAttachments),
    attachmentRetention: pick(
      FINAI_ATTACHMENT_RETENTIONS,
      value.attachmentRetention,
      FINAI_DEFAULTS.attachmentRetention,
    ),
  };
}

/** Tools that change data immediately (no confirmation card); they follow `allowActions`. */
const DIRECT_ACTION_TOOLS = ['delete_transaction', 'restore_from_trash'];

/** Whether a tool is allowed by these settings (unknown tools follow their family). */
export function finaiToolAllowed(settings: FinaiSettings, toolName: string): boolean {
  if (toolName.startsWith('propose_') || DIRECT_ACTION_TOOLS.includes(toolName))
    return settings.allowActions;
  for (const scope of FINAI_DATA_SCOPES)
    if (FINAI_SCOPE_TOOLS[scope].includes(toolName)) return settings.dataScopes[scope];
  return true;
}

const toneCopy: Record<FinaiTone, string> = {
  friendly: 'Warm, encouraging and plain-spoken.',
  concise: 'Brief and to the point; no pleasantries.',
  professional: 'Polished and neutral, like a financial analyst.',
  playful: 'Light and upbeat, with a touch of humour, never at the expense of accuracy.',
};
const lengthCopy: Record<FinaiLength, string> = {
  short: 'Answer in one or two sentences unless asked for more.',
  balanced: 'Lead with the answer, then at most a few bullets.',
  detailed: 'Give a thorough answer with context and the reasoning behind figures.',
};

/** The user's preferences as system-prompt lines (empty when everything is default). */
export function finaiPreferencePrompt(settings: FinaiSettings): string {
  const lines = [`Tone: ${toneCopy[settings.tone]}`, `Length: ${lengthCopy[settings.length]}`];
  lines.push(
    settings.language === 'auto'
      ? 'Language: reply in the language the user writes in.'
      : `Language: always reply in ${settings.language}.`,
  );
  lines.push(settings.useEmoji ? 'Emoji: a few are welcome.' : 'Emoji: do not use emoji.');
  const blocked = FINAI_DATA_SCOPES.filter((scope) => !settings.dataScopes[scope]);
  if (blocked.length)
    lines.push(
      `The user turned off your access to: ${blocked.join(', ')}. If asked about those, say access is off in FinAI settings.`,
    );
  if (!settings.allowActions)
    lines.push('You cannot prepare changes; explain what the user can do themselves in the app.');
  if (settings.aboutMe.trim()) lines.push(`About the user (from them): ${settings.aboutMe.trim()}`);
  if (settings.customInstructions.trim())
    lines.push(
      `The user's own instructions (follow them unless they conflict with the rules above):\n${settings.customInstructions.trim()}`,
    );
  return `User preferences:\n${lines.map((line) => `- ${line}`).join('\n')}`;
}
