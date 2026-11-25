import React from 'react';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Trash2 } from 'lucide-react-native';
import {
  SettingsChips,
  SettingsGroup,
  SettingsLink,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '0', label: 'Never' },
] as const;
const back = () => (router.canGoBack() ? router.back() : router.navigate('/settings' as never));

export default function TrashSettingsScreen() {
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const tone = useSettingsToneColor();
  const data = useQuery(api.trash.list, live ? {} : 'skip');
  const setRetention = useMutation(api.trash.setRetention);
  const [value, setValue] = React.useState<string | null>(null);
  const current = value ?? (data ? String(data.retentionDays) : '30');
  return (
    <SettingsScreen title="Trash" subtitle="When deleted items are cleared for good" onBack={back}>
      <SettingsGroup title="Automatic cleanup">
        <SettingsChips
          title="Delete items for good after"
          description="Checked daily. “Never” keeps everything until you empty Trash."
          value={current as (typeof OPTIONS)[number]['value']}
          disabled={!live || !data}
          options={OPTIONS}
          onChange={async (next) => {
            const previous = current;
            setValue(next);
            try {
              await setRetention({ days: Number(next) });
            } catch {
              setValue(previous);
            }
          }}
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsLink
          icon={<Trash2 size={19} color={tone('danger')} />}
          tone="danger"
          title="Open Trash"
          value={data ? String(data.items.length) : undefined}
          onPress={() => router.push('/trash' as never)}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
