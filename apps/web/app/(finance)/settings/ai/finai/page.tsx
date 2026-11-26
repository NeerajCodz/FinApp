'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  FINAI_DEFAULTS,
  FINAI_LANGUAGES,
  FINAI_LIMITS,
  type FinaiSettings,
} from '@convex/shared/finaiSettings';
import {
  Bot,
  CalendarCheck2,
  ListTree,
  MessagesSquare,
  MousePointerClick,
  Paperclip,
  ReceiptText,
  Smile,
  Sparkles,
  Trash2,
  UsersRound,
  Wallet,
} from 'lucide-react';
import {
  SettingsChoice,
  SettingsGroup,
  SettingsLink,
  SettingsSelect,
  SettingsShell,
  SettingsSwitch,
  SettingsTextArea,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type Patch = Partial<Omit<FinaiSettings, 'dataScopes'>> & {
  dataScopes?: Partial<FinaiSettings['dataScopes']>;
};

/** Every FinAI preference: personality, language, what it can read, actions, chats, history. */
export default function FinaiSettingsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const stored = useQuery(api.ai.settings.get, live ? {} : 'skip');
  const update = useMutation(api.ai.settings.update);
  const clearHistory = useMutation(api.ai.settings.clearHistory);
  const [local, setLocal] = React.useState<FinaiSettings | null>(null);
  const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    if (stored) setLocal(stored);
  }, [stored]);
  const settings = local ?? stored ?? FINAI_DEFAULTS;
  const disabled = !live || !stored;
  const off = !settings.enabled;

  const save = async (patch: Patch) => {
    setMessage('');
    const previous = settings;
    setLocal({
      ...settings,
      ...patch,
      dataScopes: { ...settings.dataScopes, ...patch.dataScopes },
    } as FinaiSettings);
    try {
      await update(patch);
    } catch (cause) {
      setLocal(previous);
      setMessage(cause instanceof Error ? cause.message : 'Could not save. Try again.');
    }
  };

  const wipe = async () => {
    if (!window.confirm('Delete every FinAI conversation? This cannot be undone.')) return;
    let total = 0;
    for (let round = 0; round < 20; round += 1) {
      const result = await clearHistory({});
      total += result.deleted;
      if (!result.more) break;
    }
    setMessage(`Deleted ${total} ${total === 1 ? 'conversation' : 'conversations'}.`);
  };

  return (
    <SettingsShell
      title="FinAI"
      subtitle={
        live
          ? 'Make FinAI work the way you like'
          : 'Connect to the internet to change FinAI settings'
      }
      onBack={() => router.push('/settings/ai')}
      wide
    >
      <SettingsGroup span>
        <SettingsSwitch
          icon={<Bot size={19} />}
          tone="violet"
          title="FinAI"
          description="Turn the assistant on or off everywhere: the assistant, the floating button and @finai in chats."
          checked={settings.enabled}
          disabled={disabled}
          onChange={(enabled) => void save({ enabled })}
        />
      </SettingsGroup>

      <SettingsGroup title="Personality" description="How FinAI talks to you">
        <SettingsChoice
          title="Tone"
          value={settings.tone}
          disabled={disabled || off}
          options={[
            { value: 'friendly', label: 'Friendly' },
            { value: 'concise', label: 'Concise' },
            { value: 'professional', label: 'Professional' },
            { value: 'playful', label: 'Playful' },
          ]}
          onChange={(tone) => void save({ tone })}
        />
        <SettingsChoice
          title="Answer length"
          value={settings.length}
          disabled={disabled || off}
          options={[
            { value: 'short', label: 'Short' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'detailed', label: 'Detailed' },
          ]}
          onChange={(length) => void save({ length })}
        />
        <SettingsSelect
          title="Language"
          description="Auto replies in the language you write in"
          value={settings.language}
          disabled={disabled || off}
          options={FINAI_LANGUAGES.map((language) => ({
            value: language,
            label: language === 'auto' ? 'Auto' : language,
          }))}
          onChange={(language) => void save({ language })}
        />
        <SettingsSwitch
          icon={<Smile size={19} />}
          title="Emoji"
          description="Allow a few emoji in replies"
          checked={settings.useEmoji}
          disabled={disabled || off}
          onChange={(useEmoji) => void save({ useEmoji })}
        />
      </SettingsGroup>

      <SettingsGroup title="Personalise" description="Context FinAI keeps in mind for every answer">
        <SettingsTextArea
          title="About you"
          description="e.g. “Student in Chennai, paid on the 1st, saving for a laptop.”"
          value={settings.aboutMe}
          maxLength={FINAI_LIMITS.aboutMe}
          disabled={disabled || off}
          placeholder="What should FinAI know about you?"
          onSave={(aboutMe) => save({ aboutMe })}
        />
        <SettingsTextArea
          title="Custom instructions"
          description="How FinAI should answer, e.g. “Always compare with last month.”"
          value={settings.customInstructions}
          maxLength={FINAI_LIMITS.customInstructions}
          disabled={disabled || off}
          placeholder="Instructions FinAI follows in every reply"
          onSave={(customInstructions) => save({ customInstructions })}
        />
      </SettingsGroup>

      <SettingsGroup title="What FinAI can read" description="Turning one off removes those tools">
        <SettingsSwitch
          icon={<Wallet size={19} />}
          tone="primary"
          title="Money"
          description="Accounts, transactions, categories and spending"
          checked={settings.dataScopes.money}
          disabled={disabled || off}
          onChange={(money) => void save({ dataScopes: { money } })}
        />
        <SettingsSwitch
          icon={<CalendarCheck2 size={19} />}
          tone="positive"
          title="Category limits and goals"
          description="Limits, progress and savings goals"
          checked={settings.dataScopes.planning}
          disabled={disabled || off}
          onChange={(planning) => void save({ dataScopes: { planning } })}
        />
        <SettingsSwitch
          icon={<UsersRound size={19} />}
          tone="info"
          title="Groups"
          description="Group balances and shared expenses"
          checked={settings.dataScopes.groups}
          disabled={disabled || off}
          onChange={(groups) => void save({ dataScopes: { groups } })}
        />
        <SettingsSwitch
          icon={<UsersRound size={19} />}
          tone="violet"
          title="People"
          description="Your friends list"
          checked={settings.dataScopes.people}
          disabled={disabled || off}
          onChange={(people) => void save({ dataScopes: { people } })}
        />
      </SettingsGroup>

      <SettingsGroup title="Actions and chats">
        <SettingsSwitch
          icon={<MousePointerClick size={19} />}
          tone="warning"
          title="Prepare changes"
          description="Let FinAI draft transactions, splits, settlements and contributions. Nothing is saved until you press Confirm."
          checked={settings.allowActions}
          disabled={disabled || off}
          onChange={(allowActions) => void save({ allowActions })}
        />
        <SettingsSwitch
          icon={<MessagesSquare size={19} />}
          tone="info"
          title="@finai in chats"
          description="Answer when you mention @finai in group chats and DMs"
          checked={settings.allowChatMentions}
          disabled={disabled || off}
          onChange={(allowChatMentions) => void save({ allowChatMentions })}
        />
        <SettingsSwitch
          icon={<ReceiptText size={19} />}
          tone="positive"
          title="Auto-categorise receipts"
          description="Pick a category when you scan a receipt"
          checked={settings.autoCategorizeReceipts}
          disabled={disabled || off}
          onChange={(autoCategorizeReceipts) => void save({ autoCategorizeReceipts })}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Attachments"
        description="Images, PDFs, spreadsheets (.xlsx, .csv) and text files up to 10 MB"
      >
        <SettingsSwitch
          icon={<Paperclip size={19} />}
          tone="info"
          title="Attach files"
          description="Let FinAI read receipts, statements and sheets you attach, and import their rows"
          checked={settings.allowAttachments}
          disabled={disabled || off}
          onChange={(allowAttachments) => void save({ allowAttachments })}
        />
        <SettingsSelect
          title="Delete attachments after"
          description="Files are removed from storage after this; chats keep their names. Applies to new attachments."
          value={settings.attachmentRetention}
          disabled={disabled || off || !settings.allowAttachments}
          options={[
            { value: '1h', label: '1 hour' },
            { value: '24h', label: '24 hours' },
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
            { value: 'never', label: 'Never' },
          ]}
          onChange={(attachmentRetention) => void save({ attachmentRetention })}
        />
      </SettingsGroup>

      <SettingsGroup title="Display">
        <SettingsSwitch
          icon={<Sparkles size={19} />}
          tone="violet"
          title="Floating FinAI button"
          description="Show the FinAI button on every screen"
          checked={settings.showLauncher}
          disabled={disabled || off}
          onChange={(showLauncher) => void save({ showLauncher })}
        />
        <SettingsSwitch
          icon={<ListTree size={19} />}
          title="Show steps"
          description="Show the tools FinAI used under each reply"
          checked={settings.showSteps}
          disabled={disabled || off}
          onChange={(showSteps) => void save({ showSteps })}
        />
      </SettingsGroup>

      <SettingsGroup title="History">
        <SettingsLink
          icon={<Trash2 size={19} />}
          danger
          title="Clear FinAI history"
          description="Delete every assistant conversation"
          onPress={disabled ? undefined : () => void wipe()}
        />
      </SettingsGroup>

      {message ? (
        <p
          role="status"
          style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--finapp-foreground-muted)' }}
        >
          {message}
        </p>
      ) : null}
    </SettingsShell>
  );
}
