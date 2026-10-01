import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Input, Label, Typography, useTheme } from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '@convex/shared/money';
import { GroupAvatar, GroupHeading, GroupNote, GroupPanel, GroupTile } from './GroupPrimitives';

export type GroupExpenseMethod = 'equal' | 'exact' | 'percentage' | 'shares';
export type GroupExpenseGroupOption = { id: string; name: string; currency?: string };
export type GroupExpenseAccountOption = { id: string; name: string };
export type GroupExpenseMemberOption = { userId: string; name: string; avatarUrl?: string | null };
export type GroupExpenseShare = { userId: string; amountMinor: bigint };
export type GroupExpenseFormScreenProps = {
  signedIn: boolean; fixedGroupId?: string; groups: readonly GroupExpenseGroupOption[]; selectedGroupId: string;
  groupName?: string; groupIcon?: string; groupColor?: string; currency: string;
  accounts: readonly GroupExpenseAccountOption[]; selectedAccountId: string;
  members: readonly GroupExpenseMemberOption[]; payerName: string; title: string; amount: string;
  date?: string; onDateChange?: (value: string) => void;
  categories?: readonly { id: string; name: string; icon?: string; color?: string }[];
  selectedCategoryId?: string; onCategoryChange?: (id: string) => void;
  merchant?: string; onMerchantChange?: (value: string) => void;
  note?: string; onNoteChange?: (value: string) => void;
  method: GroupExpenseMethod; selectedMemberIds: readonly string[]; basis: Readonly<Record<string, string>>;
  shares: readonly GroupExpenseShare[]; totalMinor: bigint | null; validation?: string; error?: string; saving?: boolean;
  onGroupChange: (id: string) => void; onAccountChange: (id: string) => void;
  onTitleChange: (value: string) => void; onAmountChange: (value: string) => void;
  onMethodChange: (method: GroupExpenseMethod) => void;
  onParticipantChange: (userId: string, selected: boolean) => void;
  onBasisChange: (userId: string, value: string) => void; onSubmit: () => void; onBack: () => void;
  onCreateGroup?: () => void; onSignIn?: () => void;
};

const methods: readonly { value: GroupExpenseMethod; title: string; description: string; icon: string }[] = [
  { value: 'equal', title: 'Equal', description: 'Split equally', icon: 'phosphor:UsersThree' },
  { value: 'exact', title: 'Custom', description: 'Set exact amounts', icon: 'phosphor:SlidersHorizontal' },
  { value: 'percentage', title: 'Percentage', description: 'Split by percentage', icon: 'phosphor:Percent' },
  { value: 'shares', title: 'Shares', description: 'Split by shares / units', icon: 'phosphor:ChartBar' },
];

export function GroupExpenseFormScreen(p: GroupExpenseFormScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const selected = p.members.filter(member => p.selectedMemberIds.includes(member.userId));
  const validPreview = !p.validation && p.totalMinor !== null;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: tokens.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28, gap: 16 }}>
    <GroupHeading title="New expense" subtitle="Add an expense and split it with specific people in your group." onBack={p.onBack} />
    {!p.signedIn ? <GroupPanel><Typography variant="heading">Sign in to share an expense</Typography><Typography variant="small">Sign in to create an offline-first shared expense for a saved group.</Typography>{p.onSignIn && <Button onPress={p.onSignIn}>Sign in</Button>}</GroupPanel> : <>
      {p.selectedGroupId && <GroupPanel><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><GroupTile icon={p.groupIcon} color={p.groupColor} size={72} /><View style={{ flex: 1, gap: 5 }}><Typography variant="heading">{p.groupName ?? p.groups.find(group => group.id === p.selectedGroupId)?.name ?? 'Saved group'}</Typography><Typography variant="caption">Shared expenses · {p.currency}</Typography><View style={{ flexDirection: 'row' }}>{p.members.slice(0, 5).map((member, index) => <View key={member.userId} style={{ marginLeft: index ? -6 : 0 }}><GroupAvatar name={member.name} avatarUrl={member.avatarUrl} size={26} /></View>)}</View></View></View></GroupPanel>}
      {!p.fixedGroupId && <GroupPanel><Typography variant="heading">Choose a group</Typography>{p.groups.map(group => <Pressable key={group.id} accessibilityRole="radio" accessibilityLabel={`${group.name}, ${group.currency ?? 'currency unavailable'}`} accessibilityState={{ selected: group.id === p.selectedGroupId }} disabled={p.saving} onPress={() => p.onGroupChange(group.id)} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: group.id === p.selectedGroupId ? tokens.primary : tokens.borderSubtle, flexDirection: 'row', justifyContent: 'space-between' }}><Typography variant="label">{group.name}</Typography><Typography variant="caption">{group.currency}</Typography></Pressable>)}{!p.groups.length && <Typography variant="small">No saved groups yet.</Typography>}{p.onCreateGroup && <Button variant="outline" onPress={p.onCreateGroup}>Create a group</Button>}</GroupPanel>}
      {!!p.selectedGroupId && <>
        <GroupPanel>
          <Typography variant="heading">Expense details</Typography>
          <Label>Expense title *</Label>
          <Input accessibilityLabel="Split expense title" placeholder="Dinner, travel, supplies" value={p.title} onChangeText={p.onTitleChange} maxLength={120} editable={!p.saving} />
          {p.onMerchantChange && <View><Label>Merchant / description</Label><Input accessibilityLabel="Expense merchant" placeholder="Where did you spend?" value={p.merchant ?? ''} onChangeText={p.onMerchantChange} editable={!p.saving} /></View>}
          {p.onCategoryChange && <View style={{ gap: 8 }}>
            <Label>Category</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button size="sm" variant={!p.selectedCategoryId ? 'secondary' : 'outline'} disabled={p.saving} onPress={() => p.onCategoryChange?.('')}>Uncategorized</Button>
              {p.categories?.map(category => <Pressable key={category.id} accessibilityRole="radio" accessibilityLabel={category.name} accessibilityState={{ selected: p.selectedCategoryId === category.id }} disabled={p.saving} onPress={() => p.onCategoryChange?.(category.id)} style={{ padding: 8, borderWidth: 1, borderColor: p.selectedCategoryId === category.id ? tokens.primary : tokens.borderSubtle, borderRadius: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}><GroupTile icon={category.icon ?? 'phosphor:Tag'} color={category.color ?? tokens.warning} size={26} /><Typography variant="small" style={{ color: tokens.foreground }}>{category.name}</Typography></Pressable>)}
            </View>
            {!p.categories?.length && <Typography variant="caption">No saved categories are available.</Typography>}
          </View>}
          <Label>Amount · {p.currency} *</Label>
          <Input accessibilityLabel={`Amount in ${p.currency}`} keyboardType="decimal-pad" placeholder="0.00" value={p.amount} onChangeText={p.onAmountChange} editable={!p.saving} />
          {p.onDateChange && <View><Label>Date *</Label><Input accessibilityLabel="Expense date" value={p.date ?? ''} onChangeText={p.onDateChange} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10} editable={!p.saving} /></View>}
          <Label>Who paid?</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><GroupAvatar name={p.payerName} /><Typography variant="label">{p.payerName}</Typography></View>
          <Typography variant="caption">Recorded from your account. Another payer is not supported here.</Typography>
          <Label>Paid from account *</Label>
          {p.accounts.map(account => <Pressable key={account.id} accessibilityRole="radio" accessibilityState={{ selected: account.id === p.selectedAccountId }} accessibilityLabel={account.name} disabled={p.saving} onPress={() => p.onAccountChange(account.id)} style={{ minHeight: 44, padding: 12, borderWidth: 1, borderColor: account.id === p.selectedAccountId ? tokens.primary : tokens.borderSubtle, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}><GroupTile icon="phosphor:Wallet" color={tokens.income} size={28} /><Typography variant="small" style={{ flex: 1, color: tokens.foreground }}>{account.name}</Typography><Typography style={{ color: tokens.primary }}>{account.id === p.selectedAccountId ? '●' : '○'}</Typography></Pressable>)}
          {!p.accounts.length && <Typography variant="small">No account uses {p.currency}. Add one before saving a split.</Typography>}
          {p.onNoteChange && <View><Label>Notes (optional)</Label><Input accessibilityLabel="Expense notes" value={p.note ?? ''} onChangeText={p.onNoteChange} placeholder="Add a note for this expense" multiline editable={!p.saving} /></View>}
        </GroupPanel>
        <GroupPanel><Typography variant="heading">Split method</Typography><Typography variant="caption">Choose how to divide the amount among selected people.</Typography><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{methods.map(method => <Pressable key={method.value} accessibilityRole="radio" accessibilityState={{ selected: p.method === method.value }} accessibilityLabel={`${method.title}, ${method.description}`} disabled={p.saving} onPress={() => p.onMethodChange(method.value)} style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, padding: 12, gap: 7, opacity: pressed ? 0.7 : 1, borderRadius: 9, borderWidth: 1, borderColor: p.method === method.value ? tokens.primary : tokens.borderSubtle, backgroundColor: p.method === method.value ? tokens.secondary : tokens.surfaceRaised })}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><GroupTile icon={method.icon} size={32} color={p.method === method.value ? tokens.primary : tokens.split} /><Typography style={{ color: p.method === method.value ? tokens.primary : tokens.foregroundMuted }}>{p.method === method.value ? '●' : '○'}</Typography></View><Typography variant="label">{method.title}</Typography><Typography variant="caption">{method.description}</Typography></Pressable>)}</View></GroupPanel>
        <GroupPanel><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><Typography variant="heading">Split with</Typography><Button size="sm" variant="outline" disabled={p.saving || !p.members.length} onPress={() => { const selectAll = selected.length !== p.members.length; for (const member of p.members) if (p.selectedMemberIds.includes(member.userId) !== selectAll) p.onParticipantChange(member.userId, selectAll); }}>{selected.length === p.members.length && p.members.length ? 'Clear all' : 'Select all'}</Button></View><Typography variant="caption">{selected.length} of {p.members.length} selected. Only participants are included.</Typography><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{p.members.map(member => {
          const included = p.selectedMemberIds.includes(member.userId);
          return <Pressable key={member.userId} accessibilityRole="checkbox" accessibilityLabel={`Include ${member.name}`} accessibilityState={{ checked: included }} disabled={p.saving} onPress={() => p.onParticipantChange(member.userId, !included)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 8, borderWidth: 1, borderColor: included ? tokens.primary : tokens.borderSubtle, borderRadius: 9, backgroundColor: included ? tokens.secondary : tokens.surfaceRaised }}><GroupAvatar name={member.name} avatarUrl={member.avatarUrl} size={30} /><Typography variant="small" style={{ color: tokens.foreground }}>{member.name}</Typography><Typography style={{ color: included ? tokens.primary : tokens.foregroundMuted }}>{included ? '●' : '○'}</Typography></Pressable>;
        })}</View>{p.method !== 'equal' && selected.map(member => <View key={member.userId} style={{ gap: 4 }}><Label>{member.name} · {p.method === 'exact' ? `amount in ${p.currency}` : p.method === 'percentage' ? 'percentage' : 'shares'}</Label><Input accessibilityLabel={`${p.method} value for ${member.name}`} keyboardType={p.method === 'shares' ? 'number-pad' : 'decimal-pad'} placeholder={p.method === 'percentage' ? '0–100%' : p.method === 'shares' ? 'Whole shares' : '0.00'} value={p.basis[member.userId] ?? ''} onChangeText={value => p.onBasisChange(member.userId, value)} editable={!p.saving} /></View>)}{p.members.length <= 1 && <Typography variant="caption">Other members appear after their memberships are saved on this device.</Typography>}</GroupPanel>
        <GroupPanel><Typography variant="heading">Split summary</Typography><Typography variant="caption">Preview · this expense only</Typography><Typography variant="small">Total amount</Typography><Typography variant="title" style={{ fontVariant: ['tabular-nums'] }}>{p.totalMinor !== null ? formatMinor(p.totalMinor, p.currency) : 'Enter an amount'}</Typography><Typography variant="label">{methods.find(method => method.value === p.method)?.title} split · {selected.length} participants</Typography>{validPreview ? p.shares.map(share => {
          const member = p.members.find(person => person.userId === share.userId);
          return <View key={share.userId} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 5 }}><GroupAvatar name={member?.name ?? 'Member'} avatarUrl={member?.avatarUrl} size={30} /><Typography variant="small" style={{ flex: 1, color: tokens.foreground }}>{member?.name ?? 'Member'}</Typography><Typography variant="label" style={{ fontVariant: ['tabular-nums'] }}>{formatMinor(share.amountMinor, p.currency)}</Typography></View>;
        }) : <Typography variant="small">Complete the amount and split values to preview each participant’s share.</Typography>}<View style={{ paddingTop: 12, borderTopWidth: 1, borderColor: tokens.borderSubtle, gap: 5 }}><Typography variant="label">Who paid?</Typography><Typography variant="small">{p.payerName} covers the full payment from the selected account.</Typography><Typography variant="caption">These are this expense’s allocations, not existing group debt or a scheduled settlement.</Typography></View></GroupPanel>
      </>}
      <GroupPanel><Typography variant="heading">Smart tips</Typography><GroupNote title="Split with specific people" text="Select only people who took part. Others won’t be included in this expense." icon="phosphor:UsersThree" color={tokens.split} /><GroupNote title="Share a receipt" text="After saving, share the bill image in your connected group chat. Receipt upload is not part of this form." icon="phosphor:Receipt" color={tokens.warning} /><GroupNote title="Settle up later" text="The group ledger tracks balances. Record an actual settlement from the group when payment is made." icon="phosphor:ArrowsLeftRight" color={tokens.income} /></GroupPanel>
      {!!p.validation && <Typography accessibilityRole="alert" variant="small">{p.validation}</Typography>}{!!p.error && <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>{p.error}</Typography>}<Button disabled={p.saving || !!p.validation || !p.selectedGroupId} onPress={p.onSubmit}>{p.saving ? 'Saving…' : 'Add expense'}</Button><Button variant="outline" disabled={p.saving} onPress={p.onBack}>Cancel</Button>
    </>}
  </ScrollView></KeyboardAvoidingView>;
}
