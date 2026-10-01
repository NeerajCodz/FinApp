import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight } from '@finapp/ui/icons/native';
import {
  Button,
  IconButton,
  Input,
  Label,
  Separator,
  Tabs,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '@convex/shared/money';
import { CurrencyInput } from './CurrencyInput';
import { SemanticMarker } from './SemanticMarker';

export type GroupExpenseMethod = 'equal' | 'exact' | 'percentage' | 'shares';
export type GroupExpenseGroupOption = { id: string; name: string; currency?: string };
export type GroupExpenseAccountOption = { id: string; name: string };
export type GroupExpenseMemberOption = { userId: string; name: string };
export type GroupExpenseShare = { userId: string; amountMinor: bigint };
export type GroupExpenseFormScreenProps = {
  signedIn: boolean;
  fixedGroupId?: string;
  groups: readonly GroupExpenseGroupOption[];
  selectedGroupId: string;
  groupName?: string;
  currency: string;
  accounts: readonly GroupExpenseAccountOption[];
  selectedAccountId: string;
  members: readonly GroupExpenseMemberOption[];
  payerName: string;
  title: string;
  amount: string;
  method: GroupExpenseMethod;
  selectedMemberIds: readonly string[];
  basis: Readonly<Record<string, string>>;
  shares: readonly GroupExpenseShare[];
  totalMinor: bigint | null;
  validation?: string;
  error?: string;
  saving?: boolean;
  onGroupChange: (id: string) => void;
  onAccountChange: (id: string) => void;
  onTitleChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMethodChange: (method: GroupExpenseMethod) => void;
  onParticipantChange: (userId: string, selected: boolean) => void;
  onBasisChange: (userId: string, value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onCreateGroup?: () => void;
  onSignIn?: () => void;
};

export function GroupExpenseFormScreen(props: GroupExpenseFormScreenProps) {
  const {
    signedIn,
    fixedGroupId,
    groups,
    selectedGroupId,
    groupName,
    currency,
    accounts,
    selectedAccountId,
    members,
    payerName,
    title,
    amount,
    method,
    selectedMemberIds,
    basis,
    shares,
    totalMinor,
    validation,
    error,
    saving = false,
    onGroupChange,
    onAccountChange,
    onTitleChange,
    onAmountChange,
    onMethodChange,
    onParticipantChange,
    onBasisChange,
    onSubmit,
    onBack,
    onCreateGroup,
    onSignIn,
  } = props;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const content = {
    paddingHorizontal: 20,
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 32,
    gap: 20,
  } as const;
  if (!signedIn)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 24, gap: 14 }}>
        <Typography variant="heading">Split a cost fairly</Typography>
        <Typography variant="body">
          Sign in to create an offline-first shared expense for a saved group.
        </Typography>
        <Button onPress={onSignIn}>
          Sign in <ArrowRight size={16} color={tokens.foreground} />
        </Button>
      </View>
    );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={onBack}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="heading" style={{ flex: 1 }}>
            Split expense{groupName ? ` · ${groupName}` : ''}
          </Typography>
          <SemanticMarker type="split" />
        </View>
        {!fixedGroupId && (
          <View style={{ gap: 10 }}>
            <Label>Group</Label>
            {groups.map((item) => {
              const chosen = item.id === selectedGroupId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.name}, ${item.currency ?? 'currency unavailable'}`}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => onGroupChange(item.id)}
                  style={{
                    minHeight: 52,
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: chosen ? tokens.split : tokens.borderSubtle,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: chosen ? tokens.split : tokens.foreground }}>
                    {item.name}
                  </Text>
                  <Typography variant="small">{item.currency ?? ''}</Typography>
                </Pressable>
              );
            })}
            {!groups.length && <Typography variant="small">No saved groups yet.</Typography>}
            <Button variant="outline" onPress={onCreateGroup}>
              Create a group
            </Button>
          </View>
        )}
        {selectedGroupId && (
          <>
            <CurrencyInput currency={currency} value={amount} onChangeText={onAmountChange} />
            <View style={{ gap: 8 }}>
              <Label>What was it for?</Label>
              <Input
                accessibilityLabel="Split expense title"
                placeholder="Dinner, travel, supplies"
                value={title}
                onChangeText={onTitleChange}
                maxLength={120}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Label>Paid by</Label>
              <Typography variant="bodyLarge">{payerName}</Typography>
              <Typography variant="caption">
                Recorded from your account. Another payer is not supported here.
              </Typography>
              <Label>Account in {currency}</Label>
              {accounts.map((item) => {
                const chosen = selectedAccountId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityLabel={item.name}
                    accessibilityState={{ selected: chosen }}
                    onPress={() => onAccountChange(item.id)}
                    style={{
                      minHeight: 48,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: chosen ? tokens.split : tokens.borderSubtle,
                    }}
                  >
                    <Text style={{ color: chosen ? tokens.split : tokens.foreground }}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
              {!accounts.length && (
                <Typography variant="small">
                  No account uses {currency}. Add one before saving a split.
                </Typography>
              )}
            </View>
            <Separator />
            <View style={{ gap: 12 }}>
              <Label>Split method</Label>
              <Tabs
                value={method}
                onChange={(value) => onMethodChange(value as GroupExpenseMethod)}
                tabs={[
                  { label: 'Equal', value: 'equal' },
                  { label: 'Exact', value: 'exact' },
                  { label: '%', value: 'percentage' },
                  { label: 'Shares', value: 'shares' },
                ]}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Label>Group members sharing this expense</Label>
              {members.map((member) => {
                const selected = selectedMemberIds.includes(member.userId);
                const share = shares.find((item) => item.userId === member.userId);
                const basisLabel =
                  method === 'exact'
                    ? `Amount for ${member.name}`
                    : method === 'percentage'
                      ? `Percentage for ${member.name}`
                      : `Shares for ${member.name}`;
                return (
                  <View key={member.userId} style={{ gap: 8, paddingVertical: 4 }}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Include ${member.name}`}
                      accessibilityState={{ checked: selected }}
                      onPress={() => onParticipantChange(member.userId, !selected)}
                      style={{
                        minHeight: 44,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: selected ? tokens.split : tokens.foregroundMuted }}>
                        {selected ? '●' : '○'} {member.name}
                      </Text>
                      {share && (
                        <Typography variant="small">
                          {formatMinor(share.amountMinor, currency)}
                        </Typography>
                      )}
                    </Pressable>
                    {selected && method !== 'equal' && (
                      <View style={{ gap: 4 }}>
                        <Label>{basisLabel}</Label>
                        <Input
                          accessibilityLabel={`${method} value for ${member.name}`}
                          keyboardType={method === 'shares' ? 'number-pad' : 'decimal-pad'}
                          placeholder={
                            method === 'percentage'
                              ? '0–100%'
                              : method === 'shares'
                                ? 'Whole shares'
                                : currency
                          }
                          value={basis[member.userId] ?? ''}
                          onChangeText={(value) => onBasisChange(member.userId, value)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
              {members.length === 1 && (
                <Typography variant="small">
                  Other group members will be available once their memberships are saved on this
                  device.
                </Typography>
              )}
            </View>
            <Separator />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Typography variant="bodyLarge">Total</Typography>
              <Typography variant="bodyLarge" style={{ color: tokens.split }}>
                {totalMinor !== null ? formatMinor(totalMinor, currency) : currency}
              </Typography>
            </View>
          </>
        )}
        {!!validation && (
          <Typography
            accessibilityRole="alert"
            variant="small"
            style={{ color: tokens.foregroundMuted }}
          >
            {validation}
          </Typography>
        )}
        {!!error && (
          <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {error}
          </Typography>
        )}
        <Button
          size="lg"
          disabled={saving || !!validation}
          onPress={onSubmit}
          style={{
            backgroundColor:
              saving || !!validation ? tokens.controlDisabledBackground : tokens.split,
          }}
        >
          <Text
            style={{
              color: saving || !!validation ? tokens.controlDisabledForeground : '#FFFFFF',
              fontFamily: 'SpaceGrotesk_600SemiBold',
            }}
          >
            {saving ? 'Saving…' : 'Save split'}
          </Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
