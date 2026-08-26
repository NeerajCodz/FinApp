import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { SettingsRow } from '@/components/finance';
import { Button, IconButton, Separator, Sheet, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function GroupSettingsScreen() {
  const [confirming, setConfirming] = React.useState(false);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          gap: 32,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="title">Group settings</Typography>
        </View>

        <View>
          <Typography variant="label" style={{ marginBottom: 8 }}>
            General
          </Typography>
          <SettingsRow label="Group name" value="Untitled" />
          <Separator />
          <SettingsRow label="Members" value="0" />
          <Separator />
          <SettingsRow label="Currency" value="INR" />
        </View>

        <View style={{ gap: 12 }}>
          <Typography variant="label">Danger zone</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
            Archived groups stay visible in history but no longer accept expenses.
          </Text>
          <Button
            variant="destructive"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setConfirming(true)}
          >
            Archive group
          </Button>
        </View>
      </ScrollView>

      <Sheet visible={confirming} onClose={() => setConfirming(false)} title="Archive this group?">
        <Text style={{ color: tokens.foregroundMuted }}>
          Existing expenses remain in your history. New group activity will stop.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="outline" style={{ flex: 1 }} onPress={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            style={{ flex: 1 }}
            onPress={() => {
              setConfirming(false);
              toast.success('Group archived');
              router.back();
            }}
          >
            Archive
          </Button>
        </View>
      </Sheet>
    </>
  );
}
