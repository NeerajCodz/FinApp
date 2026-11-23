import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  FadeIn,
  HeroCard,
  IconTile,
  Input,
  Label,
  PressableScale,
  StatusPill,
  Switch,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { Illustration } from '@finapp/ui/illustrations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinor } from '@convex/shared/money';
import { withAlpha } from '../../tokens';
import type { GroupExpenseMethod } from '../groupExpenseDraft';
import {
  composerStepLabels,
  composerSteps,
  type ComposerStep,
  type ExpenseComposer,
} from '../useExpenseComposer';
import { AmountKeypad } from './AmountKeypad';
import { DateTimePicker } from './DateTimePicker';
import { EntityIcon } from './EntityIconPicker';
import { GroupAvatar, GroupHeading, GroupPanel, GroupTile } from './GroupPrimitives';
import { MemberShareRow, StepProgress, allocationVisualTone } from './SplitVisuals';

export type { GroupExpenseMethod } from '../groupExpenseDraft';
export type GroupExpenseGroupOption = { id: string; name: string; currency?: string };
export type GroupExpenseAccountOption = { id: string; name: string };
export type GroupExpenseMemberOption = {
  userId: string;
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
export type GroupExpenseShare = { userId: string; amountMinor: bigint };
export type GroupExpenseCategoryOption = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};
export type GroupExpenseFormScreenProps = {
  signedIn: boolean;
  mode?: 'create' | 'edit';
  loading?: boolean;
  dataError?: string;
  unavailableMessage?: string;
  onRetry?: () => void;
  fixedGroupId?: string;
  groups: readonly GroupExpenseGroupOption[];
  selectedGroupId: string;
  groupName?: string;
  groupIcon?: string;
  groupColor?: string;
  currency: string;
  accounts: readonly GroupExpenseAccountOption[];
  /** The expense stays on its creator's account (an admin editing someone else's expense). */
  accountLocked?: boolean;
  categories?: readonly GroupExpenseCategoryOption[];
  members: readonly GroupExpenseMemberOption[];
  currentUserId?: string | null;
  composer: ExpenseComposer;
  /**
   * New expenses are recorded with you as the payer (that is what the server accepts when
   * adding). Choosing someone else, or several payers, is available when editing.
   */
  payerEditable: boolean;
  /** Offline: the change is saved on this device and syncs later. */
  offline?: boolean;
  error?: string;
  saving?: boolean;
  onGroupChange?: (id: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onCreateGroup?: () => void;
  onSignIn?: () => void;
};

const methods: readonly {
  value: GroupExpenseMethod;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'equal',
    title: 'Equally',
    description: 'Everyone pays the same',
    icon: 'phosphor:UsersThree',
  },
  {
    value: 'exact',
    title: 'Exact',
    description: 'Type each amount',
    icon: 'phosphor:SlidersHorizontal',
  },
  {
    value: 'percentage',
    title: 'Percent',
    description: 'Shares of 100%',
    icon: 'phosphor:Percent',
  },
  { value: 'shares', title: 'Shares', description: 'Units, e.g. 2 : 1', icon: 'phosphor:ChartBar' },
];

function money(value: bigint | null | undefined, currency: string): string {
  if (value === null || value === undefined) return '—';
  try {
    return formatMinor(value, currency);
  } catch {
    return value.toString();
  }
}

export function GroupExpenseFormScreen(p: GroupExpenseFormScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const c = p.composer;
  const [stepIndex, setStepIndex] = React.useState(0);
  const step: ComposerStep = composerSteps[stepIndex]!;
  const completed = composerSteps.map((key) => !c.stepErrors[key]);
  const memberById = (id: string) => p.members.find((member) => member.userId === id);
  const isLast = stepIndex === composerSteps.length - 1;
  const groupReady = Boolean(p.selectedGroupId);
  const stepError = c.stepErrors[step];
  const title = p.mode === 'edit' ? 'Edit expense' : 'New expense';

  const body = !p.signedIn ? (
    <GroupPanel>
      <Illustration scene="welcome" size={150} />
      <Typography variant="heading">Sign in to split an expense</Typography>
      <Typography variant="small">Shared expenses live in your saved groups.</Typography>
      {!!p.onSignIn && <Button onPress={p.onSignIn}>Sign in</Button>}
    </GroupPanel>
  ) : p.loading ? (
    <GroupPanel>
      <Illustration scene="splitBill" size={150} />
      <Typography variant="small">Loading expense…</Typography>
    </GroupPanel>
  ) : p.dataError || p.unavailableMessage ? (
    <GroupPanel>
      <Illustration scene="error" size={150} />
      <Typography accessibilityRole="alert">{p.dataError || p.unavailableMessage}</Typography>
      {!!p.dataError && !!p.onRetry && (
        <Button variant="outline" onPress={p.onRetry}>
          Retry
        </Button>
      )}
    </GroupPanel>
  ) : (
    <>
      <HeroCard tone="split">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Typography variant="overline" style={{ color: tokens.split }}>
              {p.groupName ?? 'Shared expense'}
            </Typography>
            <Typography
              variant="display"
              accessibilityLabel={`Total ${money(c.draft.totalMinor, p.currency)}`}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {c.draft.totalMinor === null
                ? money(0n, p.currency || 'INR')
                : money(c.draft.totalMinor, p.currency)}
            </Typography>
            <Typography variant="caption" numberOfLines={1}>
              {c.title.trim() || 'What was it for?'} · {c.participantIds.length}{' '}
              {c.participantIds.length === 1 ? 'person' : 'people'}
            </Typography>
          </View>
          <Illustration scene="splitBill" size={120} backdrop={false} />
        </View>
        <StepProgress
          steps={composerSteps.map((key) => ({ key, label: composerStepLabels[key] }))}
          current={stepIndex}
          completed={completed}
          onSelect={setStepIndex}
        />
      </HeroCard>

      {!p.fixedGroupId && (
        <GroupPanel>
          <Typography variant="heading">Which group?</Typography>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {p.groups.map((group) => {
                const selected = group.id === p.selectedGroupId;
                return (
                  <PressableScale
                    key={group.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${group.name}, ${group.currency ?? 'no currency'}`}
                    accessibilityState={{ selected }}
                    disabled={p.saving}
                    onPress={() => p.onGroupChange?.(group.id)}
                    style={{
                      padding: 12,
                      minWidth: 120,
                      gap: 4,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: selected ? tokens.primary : tokens.borderSubtle,
                      backgroundColor: selected ? withAlpha(tokens.primary, 0.08) : tokens.card,
                    }}
                  >
                    <Typography variant="label">{group.name}</Typography>
                    <Typography variant="caption">{group.currency ?? '—'}</Typography>
                  </PressableScale>
                );
              })}
            </View>
          </ScrollView>
          {!p.groups.length && (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Illustration scene="group" size={130} />
              <Typography variant="small">No saved groups yet.</Typography>
            </View>
          )}
          {!!p.onCreateGroup && (
            <Button variant="outline" size="sm" onPress={p.onCreateGroup}>
              Create a group
            </Button>
          )}
        </GroupPanel>
      )}

      {groupReady && (
        <FadeIn key={step}>
          <GroupPanel>
            {step === 'amount' && <AmountStep p={p} />}
            {step === 'details' && <DetailsStep p={p} />}
            {step === 'paid' && <PaidStep p={p} memberById={memberById} />}
            {step === 'split' && <SplitStep p={p} memberById={memberById} />}
          </GroupPanel>
        </FadeIn>
      )}

      {!!stepError && groupReady && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <EntityIcon value="phosphor:Info" size={16} color={tokens.warning} />
          <Typography variant="small" accessibilityRole="alert" style={{ flex: 1 }}>
            {stepError}
          </Typography>
        </View>
      )}
      {!!p.error && (
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: withAlpha(tokens.destructive, 0.1),
          }}
        >
          <EntityIcon value="phosphor:WarningCircle" size={18} color={tokens.destructive} />
          <Typography accessibilityRole="alert" style={{ flex: 1, color: tokens.destructive }}>
            {p.error}
          </Typography>
        </View>
      )}
      {p.offline && (
        <StatusPill label="Offline · saves on this device and syncs later" tone="warning" />
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          variant="outline"
          style={{ flex: 1 }}
          disabled={p.saving}
          onPress={() => (stepIndex ? setStepIndex(stepIndex - 1) : p.onBack())}
        >
          {stepIndex ? 'Back' : 'Cancel'}
        </Button>
        <Button
          style={{ flex: 2 }}
          disabled={
            p.saving || !groupReady || (isLast ? Boolean(c.validation) : Boolean(stepError))
          }
          onPress={() => (isLast ? p.onSubmit() : setStepIndex(stepIndex + 1))}
        >
          {isLast
            ? p.saving
              ? 'Saving…'
              : p.mode === 'edit'
                ? 'Review changes'
                : 'Add expense'
            : `Next: ${composerStepLabels[composerSteps[stepIndex + 1]!]}`}
        </Button>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 28,
          gap: 16,
        }}
      >
        <GroupHeading
          title={title}
          subtitle={
            p.mode === 'edit'
              ? 'Change the amount, who paid or how it is split.'
              : 'Four quick steps: amount, details, who paid and the split.'
          }
          onBack={p.onBack}
        />
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepTitle({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <IconTile tone="split" size={40}>
        <EntityIcon value={icon} size={22} color={tokens.split} />
      </IconTile>
      <View style={{ flex: 1 }}>
        <Typography variant="heading">{title}</Typography>
        <Typography variant="caption">{hint}</Typography>
      </View>
    </View>
  );
}

function AmountStep({ p }: { p: GroupExpenseFormScreenProps }) {
  const { tokens } = useTheme();
  const c = p.composer;
  const type = (digit: string) => {
    const next = `${c.amount}${digit}`;
    if (digit === '.' && c.amount.includes('.')) return;
    if (/^\d{0,12}(\.\d{0,3})?$/.test(next)) c.set('amount', next === '.' ? '0.' : next);
  };
  return (
    <View style={{ gap: 14 }}>
      <StepTitle icon="phosphor:Coins" title="How much was it?" hint={`In ${p.currency}`} />
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 18,
          borderRadius: 18,
          backgroundColor: withAlpha(tokens.split, 0.08),
        }}
      >
        <Input
          accessibilityLabel={`Amount in ${p.currency}`}
          keyboardType="decimal-pad"
          placeholder="0.00"
          value={c.amount}
          onChangeText={(value) => c.set('amount', value)}
          editable={!p.saving}
          style={{
            fontSize: 40,
            lineHeight: 48,
            textAlign: 'center',
            borderWidth: 0,
            backgroundColor: 'transparent',
            minWidth: 200,
            fontVariant: ['tabular-nums'],
          }}
        />
        <Typography variant="caption">{p.currency}</Typography>
      </View>
      <AmountKeypad onDigit={type} />
      <Button
        variant="ghost"
        accessibilityLabel="Delete last digit"
        disabled={!c.amount}
        onPress={() => c.set('amount', c.amount.slice(0, -1))}
      >
        ⌫ Delete
      </Button>
    </View>
  );
}

function DetailsStep({ p }: { p: GroupExpenseFormScreenProps }) {
  const { tokens } = useTheme();
  const c = p.composer;
  return (
    <View style={{ gap: 12 }}>
      <StepTitle icon="phosphor:Receipt" title="What was it for?" hint="Title, category and date" />
      <Label>Title *</Label>
      <Input
        accessibilityLabel="Expense title"
        placeholder="Dinner, travel, groceries"
        value={c.title}
        onChangeText={(value) => c.set('title', value)}
        maxLength={120}
        editable={!p.saving}
      />
      {!!p.categories?.length && (
        <View style={{ gap: 8 }}>
          <Label>Category</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { id: '', name: 'None', icon: 'phosphor:Tag', color: undefined },
                ...p.categories,
              ].map((category) => {
                const selected = c.categoryId === category.id;
                return (
                  <PressableScale
                    key={category.id || 'none'}
                    accessibilityRole="radio"
                    accessibilityLabel={category.name}
                    accessibilityState={{ selected }}
                    disabled={p.saving}
                    onPress={() => c.set('categoryId', category.id)}
                    style={{
                      alignItems: 'center',
                      gap: 6,
                      padding: 10,
                      width: 84,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: selected ? tokens.primary : tokens.borderSubtle,
                      backgroundColor: selected ? withAlpha(tokens.primary, 0.08) : tokens.card,
                    }}
                  >
                    <GroupTile
                      icon={category.icon ?? 'phosphor:Tag'}
                      color={category.color ?? tokens.surfaceRaised}
                      size={34}
                    />
                    <Typography variant="caption" numberOfLines={1}>
                      {category.name}
                    </Typography>
                  </PressableScale>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
      <Label>Date</Label>
      <DateTimePicker value={c.occurredAt} onChange={(value) => c.set('occurredAt', value)} />
      {p.accountLocked ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <IconTile tone="neutral" size={36}>
            <EntityIcon value="phosphor:Lock" size={18} color={tokens.foregroundMuted} />
          </IconTile>
          <Typography variant="small" style={{ flex: 1 }}>
            Stays on the account of the person who added it.
          </Typography>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Label>Booked to account *</Label>
          {p.accounts.map((account) => {
            const selected = account.id === c.accountId;
            return (
              <PressableScale
                key={account.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={account.name}
                disabled={p.saving}
                onPress={() => c.set('accountId', account.id)}
                style={{
                  minHeight: 48,
                  padding: 12,
                  borderWidth: 1.5,
                  borderColor: selected ? tokens.primary : tokens.borderSubtle,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: selected ? withAlpha(tokens.primary, 0.08) : tokens.card,
                }}
              >
                <IconTile tone="income" size={32}>
                  <EntityIcon value="phosphor:Wallet" size={18} color={tokens.income} />
                </IconTile>
                <Typography variant="small" style={{ flex: 1, color: tokens.foreground }}>
                  {account.name}
                </Typography>
                {selected && (
                  <EntityIcon value="phosphor:CheckCircle" size={20} color={tokens.primary} />
                )}
              </PressableScale>
            );
          })}
          {!p.accounts.length && (
            <Typography variant="small">
              No account uses {p.currency}. Add one before saving a split.
            </Typography>
          )}
        </View>
      )}
      <Label>Merchant (optional)</Label>
      <Input
        accessibilityLabel="Merchant"
        placeholder="Where was it?"
        value={c.merchant}
        onChangeText={(value) => c.set('merchant', value)}
        editable={!p.saving}
      />
      <Label>Note (optional)</Label>
      <Input
        accessibilityLabel="Note"
        placeholder="Anything the group should know"
        value={c.note}
        onChangeText={(value) => c.set('note', value)}
        multiline
        editable={!p.saving}
      />
    </View>
  );
}

function PaidStep({
  p,
  memberById,
}: {
  p: GroupExpenseFormScreenProps;
  memberById: (id: string) => GroupExpenseMemberOption | undefined;
}) {
  const { tokens } = useTheme();
  const c = p.composer;
  const multiple = c.payerIds.length > 1;
  if (!p.payerEditable) {
    const me = p.currentUserId ? memberById(p.currentUserId) : undefined;
    return (
      <View style={{ gap: 12 }}>
        <StepTitle icon="phosphor:HandCoins" title="Who paid?" hint="You covered the bill" />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Illustration scene="owedToYou" size={150} />
          <GroupAvatar
            name={me?.name ?? 'You'}
            avatarId={me?.avatarId}
            avatarUrl={me?.avatarUrl}
            size={52}
          />
          <Typography variant="label">
            {me?.name ?? 'You'} paid {money(c.draft.totalMinor, p.currency)}
          </Typography>
          <StatusPill label="Paid in full" tone="income" />
        </View>
        <Typography variant="caption">
          New expenses are recorded with you as the payer. If someone else paid, save it and then
          choose Edit on the expense to change who paid or add several payers.
        </Typography>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <StepTitle
        icon="phosphor:HandCoins"
        title="Who paid?"
        hint={multiple ? 'Enter what each person paid' : 'Tap the person who paid'}
      />
      <Switch
        label="Several people paid"
        value={multiple}
        onValueChange={(next) =>
          c.set(
            'payerIds',
            next
              ? c.payerIds
                  .concat(p.members.map((m) => m.userId).filter((id) => !c.payerIds.includes(id)))
                  .slice(0, 2)
              : c.payerIds.slice(0, 1),
          )
        }
      />
      {p.members.map((member) => {
        const selected = c.payerIds.includes(member.userId);
        return (
          <PressableScale
            key={member.userId}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={multiple ? { checked: selected } : { selected }}
            accessibilityLabel={`${member.name} paid`}
            disabled={p.saving}
            onPress={() =>
              multiple ? c.togglePayer(member.userId) : c.set('payerIds', [member.userId])
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: selected ? tokens.primary : tokens.borderSubtle,
              backgroundColor: selected ? withAlpha(tokens.primary, 0.08) : tokens.card,
            }}
          >
            <GroupAvatar
              name={member.name}
              avatarId={member.avatarId}
              avatarUrl={member.avatarUrl}
              size={36}
            />
            <Typography variant="label" style={{ flex: 1 }}>
              {member.name}
            </Typography>
            {multiple && selected ? (
              <Input
                accessibilityLabel={`Amount ${member.name} paid`}
                keyboardType="decimal-pad"
                placeholder="0.00"
                value={c.payerAmounts[member.userId] ?? ''}
                onChangeText={(value) => c.setPayerAmount(member.userId, value)}
                style={{ width: 110, textAlign: 'right' }}
              />
            ) : selected ? (
              <EntityIcon value="phosphor:CheckCircle" size={22} color={tokens.primary} />
            ) : null}
          </PressableScale>
        );
      })}
      <StatusPill
        label={c.payerDraft.allocation.label}
        tone={allocationVisualTone(c.payerDraft.allocation.tone)}
      />
    </View>
  );
}

function SplitStep({
  p,
  memberById,
}: {
  p: GroupExpenseFormScreenProps;
  memberById: (id: string) => GroupExpenseMemberOption | undefined;
}) {
  const { tokens } = useTheme();
  const c = p.composer;
  const allSelected =
    p.members.length > 0 && p.members.every((m) => c.participantIds.includes(m.userId));
  const previewFor = (id: string) => c.draft.preview.find((row) => row.userId === id)?.amountMinor;
  return (
    <View style={{ gap: 12 }}>
      <StepTitle
        icon="phosphor:ChartPieSlice"
        title="How is it split?"
        hint="Live preview per person"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {methods.map((method) => {
          const selected = c.method === method.value;
          return (
            <PressableScale
              key={method.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${method.title}, ${method.description}`}
              disabled={p.saving}
              onPress={() => c.setMethod(method.value)}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                padding: 12,
                gap: 6,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: selected ? tokens.split : tokens.borderSubtle,
                backgroundColor: selected ? withAlpha(tokens.split, 0.1) : tokens.card,
              }}
            >
              <IconTile tone="split" solid={selected} size={34}>
                <EntityIcon
                  value={method.icon}
                  size={18}
                  color={selected ? tokens.background : tokens.split}
                />
              </IconTile>
              <Typography variant="label">{method.title}</Typography>
              <Typography variant="caption">{method.description}</Typography>
            </PressableScale>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="label">
          {c.participantIds.length} of {p.members.length} sharing
        </Typography>
        <Button
          size="sm"
          variant="ghost"
          disabled={p.saving || !p.members.length}
          onPress={() => c.setAllParticipants(allSelected ? [] : p.members.map((m) => m.userId))}
        >
          {allSelected ? 'Clear all' : 'Everyone'}
        </Button>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {p.members.map((member) => {
            const included = c.participantIds.includes(member.userId);
            return (
              <Pressable
                key={member.userId}
                accessibilityRole="checkbox"
                accessibilityLabel={`Include ${member.name}`}
                accessibilityState={{ checked: included }}
                disabled={p.saving}
                onPress={() => c.toggleParticipant(member.userId, !included)}
                style={{ alignItems: 'center', gap: 4, width: 64, opacity: included ? 1 : 0.5 }}
              >
                <View
                  style={{
                    borderRadius: 30,
                    borderWidth: 2,
                    borderColor: included ? tokens.split : 'transparent',
                    padding: 2,
                  }}
                >
                  <GroupAvatar
                    name={member.name}
                    avatarId={member.avatarId}
                    avatarUrl={member.avatarUrl}
                    size={44}
                  />
                </View>
                <Typography variant="caption" numberOfLines={1}>
                  {member.name.split(' ')[0]}
                </Typography>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <StatusPill
        label={c.draft.allocation.label}
        tone={allocationVisualTone(c.draft.allocation.tone)}
      />
      <View>
        {c.participantIds.map((id) => {
          const member = memberById(id);
          const name = member?.name ?? 'Member';
          return (
            <MemberShareRow
              key={id}
              name={name}
              avatarId={member?.avatarId}
              avatarUrl={member?.avatarUrl}
              amount={money(previewFor(id), p.currency)}
            >
              {c.method !== 'equal' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Input
                    accessibilityLabel={`${c.method === 'exact' ? 'Amount' : c.method === 'percentage' ? 'Percent' : 'Shares'} for ${name}`}
                    keyboardType={c.method === 'shares' ? 'number-pad' : 'decimal-pad'}
                    placeholder={
                      c.method === 'percentage' ? '33.33' : c.method === 'shares' ? '1' : '0.00'
                    }
                    value={c.basis[id] ?? ''}
                    onChangeText={(value) => c.setBasis(id, value)}
                    editable={!p.saving}
                    style={{ width: 84, textAlign: 'right' }}
                  />
                  {c.method === 'percentage' && <Typography variant="label">%</Typography>}
                </View>
              )}
            </MemberShareRow>
          );
        })}
      </View>
      {!c.participantIds.length && (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Illustration scene="memberJoined" size={130} />
          <Typography variant="small">Tap people above to share this expense.</Typography>
        </View>
      )}
    </View>
  );
}
