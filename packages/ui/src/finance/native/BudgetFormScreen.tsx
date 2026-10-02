import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Button, IconButton, Input, Label, Text, Typography, useTheme } from '@finapp/ui/native';
import { CategoryIcon } from './CategoryIcon';
import { EntityIconPicker } from './EntityIconPicker';
import type { BudgetSettings } from '../budgetDashboard';

export type BudgetCategoryOption = { id: string; name: string; icon?: string };
export type BudgetFormScreenProps = {
  mode: 'create' | 'edit';
  name: string;
  amount: string;
  currency: string;
  categoryId: string;
  categories: readonly BudgetCategoryOption[];
  startDate: string;
  endDate: string;
  loading?: boolean;
  pending?: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onCategoryChange: (id: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  settings?: BudgetSettings;
  onSettingsChange?: (settings: BudgetSettings) => void;
  accounts?: readonly { id: string; name: string }[];
  onAnalytics?: () => void;
  onArchive?: () => void;
};

export function BudgetFormScreen(props: BudgetFormScreenProps) {
  const { tokens } = useTheme();
  const creating = props.mode === 'create';
  const settings = props.settings ?? {};
  const setSettings = (next: Partial<BudgetSettings>) =>
    props.onSettingsChange?.({ ...settings, ...next });
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 24,
        paddingTop: 16,
        paddingBottom: 40,
        gap: 20,
        flexGrow: 1,
      }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <IconButton
        label="Back to budgets"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={props.onBack}
      >
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <View style={{ gap: 6 }}>
        <Typography variant="title">{creating ? 'New budget' : 'Edit budget'}</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          Set a category spending limit and review real expenses against it.
        </Text>
      </View>
      {(props.onAnalytics || props.onArchive) && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {props.onAnalytics && (
            <Button variant="outline" onPress={props.onAnalytics} style={{ flex: 1 }}>
              View analytics
            </Button>
          )}
          {props.onArchive && (
            <Button
              variant="outline"
              disabled={props.pending}
              onPress={props.onArchive}
              style={{ flex: 1 }}
            >
              Archive budget
            </Button>
          )}
        </View>
      )}
      <View
        style={{
          gap: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 18,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <Typography variant="bodyLarge">Budget details</Typography>
        {props.loading ? (
          <Text>Loading categories and currency…</Text>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Label>Budget name</Label>
              <Input
                accessibilityLabel="Budget name"
                value={props.name}
                onChangeText={props.onNameChange}
                maxLength={80}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Label>Spending limit ({props.currency})</Label>
              <Input
                accessibilityLabel="Budget spending limit"
                keyboardType="decimal-pad"
                value={props.amount}
                onChangeText={props.onAmountChange}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Label>Category</Label>
              {props.categories.length ? (
                props.categories.map((category) => {
                  const selected = props.categoryId === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => props.onCategoryChange(category.id)}
                      style={{
                        minHeight: 56,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: selected ? tokens.primary : tokens.border,
                        borderRadius: 14,
                      }}
                    >
                      <CategoryIcon
                        label={category.name}
                        icon={category.icon}
                        selected={selected}
                      />
                      <Text>{category.name}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text>No available categories. Create a category first.</Text>
              )}
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 8 }}>
                <Label>Starts (YYYY-MM-DD, UTC)</Label>
                <Input
                  accessibilityLabel="Budget start date"
                  value={props.startDate}
                  onChangeText={props.onStartDateChange}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Label>Ends (exclusive, YYYY-MM-DD, UTC)</Label>
                <Input
                  accessibilityLabel="Budget end date"
                  value={props.endDate}
                  onChangeText={props.onEndDateChange}
                />
              </View>
            </View>
            <View style={{ gap: 12, borderTopWidth: 1, borderColor: tokens.borderSubtle, paddingTop: 14 }}>
              <Typography variant="bodyLarge">Account scope</Typography>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: !settings.accountIds?.length }}
                onPress={() => setSettings({ accountIds: [] })}
                style={{ padding: 12, borderWidth: 1, borderColor: tokens.border, borderRadius: 12 }}
              >
                <Text>All accounts</Text>
                <Text style={{ color: tokens.foregroundMuted }}>Include expenses from every linked account.</Text>
              </Pressable>
              {(props.accounts ?? []).map((account) => {
                const selected = settings.accountIds?.includes(account.id) ?? false;
                return (
                  <Pressable
                    key={account.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() =>
                      setSettings({
                        accountIds: selected
                          ? (settings.accountIds ?? []).filter((id) => id !== account.id)
                          : [...(settings.accountIds ?? []), account.id],
                      })
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}
                  >
                    <Text style={{ color: selected ? tokens.primary : tokens.foregroundMuted }}>
                      {selected ? '☑' : '□'}
                    </Text>
                    <Text>{account.name}</Text>
                  </Pressable>
                );
              })}
              <View style={{ gap: 8 }}>
                <Label>Alert threshold (%)</Label>
                <Input
                  accessibilityLabel="Budget alert threshold"
                  keyboardType="decimal-pad"
                  value={String(settings.alertThreshold ?? 80)}
                  onChangeText={(value) => setSettings({ alertThreshold: Number(value) })}
                />
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: settings.includeInAnalytics !== false }}
                onPress={() => setSettings({ includeInAnalytics: settings.includeInAnalytics === false })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Text style={{ color: tokens.primary }}>
                  {settings.includeInAnalytics === false ? '□' : '☑'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text>Include in analytics</Text>
                  <Text style={{ color: tokens.foregroundMuted }}>Show this budget in charts and insights.</Text>
                </View>
              </Pressable>
              <View style={{ gap: 8 }}>
                <Label>Notes (optional)</Label>
                <Input
                  accessibilityLabel="Budget notes"
                  multiline
                  maxLength={300}
                  value={settings.notes ?? ''}
                  onChangeText={(notes) => setSettings({ notes })}
                />
                <Text style={{ color: tokens.foregroundMuted, textAlign: 'right' }}>
                  {settings.notes?.length ?? 0}/300
                </Text>
              </View>
              <EntityIconPicker
                mode="all"
                value={settings.icon}
                onChange={(icon) => setSettings({ icon })}
                label="Budget icon"
              />
            </View>
          </>
        )}
      </View>
      {!!props.error && <Text style={{ color: tokens.destructive }}>{props.error}</Text>}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button
          size="lg"
          disabled={props.loading || props.pending || !props.name.trim() || !props.categoryId}
          onPress={props.onSubmit}
          style={{ flex: 1 }}
        >
          {props.pending ? 'Saving…' : creating ? 'Create budget' : 'Save changes'}
        </Button>
        <Button size="lg" variant="outline" disabled={props.pending} onPress={props.onBack}>
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}
