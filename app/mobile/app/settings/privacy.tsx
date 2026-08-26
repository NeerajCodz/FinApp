import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { writeExportBundle } from '@/lib/export';
import { Button, IconButton, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function PrivacySettingsScreen() {
  const [exporting, setExporting] = useState(false);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  async function exportData() {
    setExporting(true);
    try {
      await writeExportBundle({
        transactions: [],
        accounts: [],
        categories: [],
        groups: [],
        settlements: [],
      });
      toast.success('Export ready');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
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
        <Typography variant="title">Privacy</Typography>
      </View>

      <View style={{ gap: 12 }}>
        <Typography variant="heading">Your financial values stay private.</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
          Ordinary telemetry never includes balances, amounts, account names, or transaction notes.
        </Text>
      </View>

      <Separator />

      <View style={{ gap: 12 }}>
        <Typography variant="label">Your data</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
          Export portable CSV files for accounts, transactions, categories, groups, and settlements.
        </Text>
        <Button
          variant="outline"
          disabled={exporting}
          onPress={exportData}
          style={{ alignSelf: 'flex-start' }}
        >
          {exporting ? 'Preparing export' : 'Export data'}
        </Button>
      </View>

      <View style={{ gap: 10 }}>
        <Typography variant="label" style={{ color: tokens.destructive }}>
          Account deletion
        </Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
          Contact support from your verified email to request permanent deletion.
        </Text>
      </View>
    </ScrollView>
  );
}
