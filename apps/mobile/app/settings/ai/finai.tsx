import React from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
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
} from 'lucide-react-native';
import {
  SettingsChips,
  SettingsChoice,
  SettingsGroup,
  SettingsLink,
  SettingsScreen,
  SettingsSwitch,
  SettingsTextArea,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { toast } from '@/lib/toast';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Patch = Partial<Omit<FinaiSettings, 'dataScopes'>> & {
  dataScopes?: Partial<FinaiSettings['dataScopes']>;
};
const back = () => (router.canGoBack() ? router.back() : router.navigate('/settings/ai' as never));

export default function FinaiSettingsScreen() {
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const tone = useSettingsToneColor();
  const stored = useQuery(api.ai.settings.get, live ? {} : 'skip');
  const update = useMutation(api.ai.settings.update);
  const clearHistory = useMutation(api.ai.settings.clearHistory);
  const [local, setLocal] = React.useState<FinaiSettings | null>(null);
  React.useEffect(() => {
    if (stored) setLocal(stored);
  }, [stored]);
  const settings = local ?? stored ?? FINAI_DEFAULTS;
  const disabled = !live || !stored;
  const off = disabled || !settings.enabled;

  const save = async (patch: Patch) => {
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
      toast.error(cause instanceof Error ? cause.message : 'Could not save. Try again.');
    }
  };
  const wipe = () =>
    Alert.alert('Clear FinAI history?', 'Every FinAI conversation will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          let total = 0;
          for (let round = 0; round < 20; round += 1) {
            const result = await clearHistory({});
            total += result.deleted;
            if (!result.more) break;
          }
          toast.success(`Deleted ${total} ${total === 1 ? 'conversation' : 'conversations'}`);
        },
      },
    ]);

  return (
    <SettingsScreen
      title="FinAI"
      subtitle={
        live ? 'Make FinAI work the way you like' : 'Connect to the internet to change these'
      }
      onBack={back}
    >
      <SettingsGroup>
        <SettingsSwitch
          icon={<Bot size={19} color={tone('violet')} />}
          tone="violet"
          title="FinAI"
          description="The assistant, the floating button and @finai in chats"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(enabled) => void save({ enabled })}
        />
      </SettingsGroup>

      <SettingsGroup title="Personality">
        <SettingsChoice
          title="Tone"
          value={settings.tone}
          disabled={off}
          options={[
            { value: 'friendly', label: 'Friendly' },
            { value: 'concise', label: 'Concise' },
            { value: 'professional', label: 'Pro' },
            { value: 'playful', label: 'Playful' },
          ]}
          onChange={(value) => void save({ tone: value })}
        />
        <SettingsChoice
          title="Answer length"
          value={settings.length}
          disabled={off}
          options={[
            { value: 'short', label: 'Short' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'detailed', label: 'Detailed' },
          ]}
          onChange={(value) => void save({ length: value })}
        />
        <SettingsChips
          title="Language"
          description="Auto replies in the language you write in"
          value={settings.language}
          disabled={off}
          options={FINAI_LANGUAGES.map((value) => ({
            value,
            label: value === 'auto' ? 'Auto' : value,
          }))}
          onChange={(value) => void save({ language: value })}
        />
        <SettingsSwitch
          icon={<Smile size={19} color={tone()} />}
          title="Emoji"
          description="Allow a few emoji in replies"
          checked={settings.useEmoji}
          disabled={off}
          onChange={(useEmoji) => void save({ useEmoji })}
        />
      </SettingsGroup>

      <SettingsGroup title="Personalise">
        <SettingsTextArea
          title="About you"
          description="e.g. “Student, paid on the 1st, saving for a laptop.”"
          value={settings.aboutMe}
          maxLength={FINAI_LIMITS.aboutMe}
          disabled={off}
          placeholder="What should FinAI know about you?"
          onSave={(aboutMe) => save({ aboutMe })}
        />
        <SettingsTextArea
          title="Custom instructions"
          description="e.g. “Always compare with last month.”"
          value={settings.customInstructions}
          maxLength={FINAI_LIMITS.customInstructions}
          disabled={off}
          placeholder="Instructions FinAI follows in every reply"
          onSave={(customInstructions) => save({ customInstructions })}
        />
      </SettingsGroup>

      <SettingsGroup title="What FinAI can read">
        <SettingsSwitch
          icon={<Wallet size={19} color={tone('primary')} />}
          tone="primary"
          title="Money"
          description="Accounts, transactions and spending"
          checked={settings.dataScopes.money}
          disabled={off}
          onChange={(money) => void save({ dataScopes: { money } })}
        />
        <SettingsSwitch
          icon={<CalendarCheck2 size={19} color={tone('positive')} />}
          tone="positive"
          title="Category limits and goals"
          checked={settings.dataScopes.planning}
          disabled={off}
          onChange={(planning) => void save({ dataScopes: { planning } })}
        />
        <SettingsSwitch
          icon={<UsersRound size={19} color={tone('info')} />}
          tone="info"
          title="Groups"
          checked={settings.dataScopes.groups}
          disabled={off}
          onChange={(groups) => void save({ dataScopes: { groups } })}
        />
        <SettingsSwitch
          icon={<UsersRound size={19} color={tone('violet')} />}
          tone="violet"
          title="People"
          checked={settings.dataScopes.people}
          disabled={off}
          onChange={(people) => void save({ dataScopes: { people } })}
        />
      </SettingsGroup>

      <SettingsGroup title="Actions and chats">
        <SettingsSwitch
          icon={<MousePointerClick size={19} color={tone('warning')} />}
          tone="warning"
          title="Prepare changes"
          description="Drafts wait for your Confirm"
          checked={settings.allowActions}
          disabled={off}
          onChange={(allowActions) => void save({ allowActions })}
        />
        <SettingsSwitch
          icon={<MessagesSquare size={19} color={tone('info')} />}
          tone="info"
          title="@finai in chats"
          checked={settings.allowChatMentions}
          disabled={off}
          onChange={(allowChatMentions) => void save({ allowChatMentions })}
        />
        <SettingsSwitch
          icon={<ReceiptText size={19} color={tone('positive')} />}
          tone="positive"
          title="Auto-categorise receipts"
          checked={settings.autoCategorizeReceipts}
          disabled={off}
          onChange={(autoCategorizeReceipts) => void save({ autoCategorizeReceipts })}
        />
      </SettingsGroup>

      <SettingsGroup title="Attachments">
        <SettingsSwitch
          icon={<Paperclip size={19} color={tone('info')} />}
          tone="info"
          title="Attach files"
          description="Images, PDFs, Excel and CSV up to 10 MB"
          checked={settings.allowAttachments}
          disabled={off}
          onChange={(allowAttachments) => void save({ allowAttachments })}
        />
        <SettingsChips
          title="Delete attachments after"
          description="Files leave storage after this; chats keep their names"
          value={settings.attachmentRetention}
          disabled={off || !settings.allowAttachments}
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
          icon={<Sparkles size={19} color={tone('violet')} />}
          tone="violet"
          title="Floating FinAI button"
          checked={settings.showLauncher}
          disabled={off}
          onChange={(showLauncher) => void save({ showLauncher })}
        />
        <SettingsSwitch
          icon={<ListTree size={19} color={tone()} />}
          title="Show steps"
          description="Tools FinAI used, under each reply"
          checked={settings.showSteps}
          disabled={off}
          onChange={(showSteps) => void save({ showSteps })}
        />
      </SettingsGroup>

      <SettingsGroup title="History">
        <SettingsLink
          icon={<Trash2 size={19} color={tone('danger')} />}
          danger
          title="Clear FinAI history"
          description="Delete every assistant conversation"
          onPress={disabled ? undefined : wipe}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
