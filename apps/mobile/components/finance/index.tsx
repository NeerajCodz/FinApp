import React, { useState } from 'react';
import { TouchableOpacity, View, type PressableProps } from 'react-native';
import { Button, Card, Input, Progress, Separator, Text, Typography } from '@finapp/ui/native';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Car,
  CaretRight,
  Check,
  Eye,
  EyeOff,
  Landmark,
  ReceiptText,
  ShoppingBag,
  Utensils,
  UsersThree,
} from '@/lib/icons';
import { useTheme } from '@finapp/ui/native';
import { formatMinor, parseMinor, signedMinor } from '@/lib/money';

type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
export type SemanticType = TransactionType | 'split' | 'settlement';
type MoneySize = 'hero' | 'display' | 'body';

export function Money({
  amountMinor,
  currency,
  type = 'income',
  size = 'body',
  hidden = false,
  emphasize = false,
}: {
  amountMinor: bigint;
  currency: string;
  type?: TransactionType;
  size?: MoneySize;
  hidden?: boolean;
  emphasize?: boolean;
}) {
  const amount = signedMinor(amountMinor, type);
  const { tokens } = useTheme();
  const formatted = hidden
    ? `${currency === 'INR' ? '₹' : ''}••••••`
    : formatMinor(amount, currency);
  const sizeStyle =
    size === 'hero'
      ? { fontSize: 48, lineHeight: 52, letterSpacing: -2 }
      : size === 'display'
        ? { fontSize: 30, lineHeight: 34, letterSpacing: -0.9 }
        : { fontSize: 15, lineHeight: 20, letterSpacing: -0.1 };
  return (
    <Text
      accessibilityLabel={hidden ? 'Balance hidden' : `${type} ${amount.toString()} ${currency}`}
      style={{
        color: emphasize ? tokens.primary : tokens.foreground,
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontVariant: ['tabular-nums'],
        ...sizeStyle,
      }}
    >
      {formatted}
    </Text>
  );
}

export function MoneyText(props: {
  amountMinor: bigint;
  currency: string;
  type?: TransactionType;
}) {
  return <Money {...props} />;
}

export function BalanceHero({
  label = 'Available',
  amountMinor,
  currency,
  delta,
}: {
  label?: string;
  amountMinor: bigint;
  currency: string;
  delta?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Typography variant="label">{label}</Typography>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
          onPress={() => setHidden((current) => !current)}
          hitSlop={10}
          activeOpacity={0.64}
        >
          {hidden ? (
            <EyeOff size={17} color={tokens.foregroundSubtle} />
          ) : (
            <Eye size={17} color={tokens.foregroundSubtle} />
          )}
        </TouchableOpacity>
      </View>
      <Money amountMinor={amountMinor} currency={currency} size="hero" hidden={hidden} />
      {delta && (
        <Typography
          variant="small"
          style={{ color: tokens.primary, fontFamily: 'SpaceGrotesk_500Medium' }}
        >
          {delta}
        </Typography>
      )}
    </View>
  );
}

function resolveCategoryIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('food') || normalized.includes('coffee')) return Utensils;
  if (normalized.includes('transport') || normalized.includes('uber')) return Car;
  if (normalized.includes('shop')) return ShoppingBag;
  if (normalized.includes('bank') || normalized.includes('account')) return Landmark;
  return ReceiptText;
}

export function CategoryIcon({
  label,
  icon,
  selected = false,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
}) {
  const { tokens } = useTheme();
  const Icon = resolveCategoryIcon(label);
  return (
    <View
      accessibilityLabel={`${label} category`}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: selected ? tokens.primary : tokens.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <Text style={{ fontSize: 21, lineHeight: 26 }}>{icon}</Text>
      ) : (
        <Icon size={19} color={selected ? tokens.primaryForeground : tokens.foregroundMuted} />
      )}
    </View>
  );
}
const semanticLabels: Record<SemanticType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  split: 'Split',
  settlement: 'Settlement',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

export function SemanticMarker({ type }: { type: SemanticType }) {
  const { tokens } = useTheme();
  const color =
    type === 'expense'
      ? tokens.expense
      : type === 'income' || type === 'refund'
        ? tokens.income
        : type === 'split'
          ? tokens.split
          : type === 'settlement'
            ? tokens.settlement
            : tokens.transfer;
  const Icon =
    type === 'expense'
      ? ArrowUpRight
      : type === 'income' || type === 'refund'
        ? ArrowDownRight
        : type === 'split'
          ? UsersThree
          : type === 'settlement'
            ? Check
            : ArrowLeftRight;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${semanticLabels[type]} transaction type`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: `${color}24`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={13} color={color} strokeWidth={2.2} />
      </View>
      <Typography variant="caption" style={{ color, fontFamily: 'SpaceGrotesk_600SemiBold' }}>
        {semanticLabels[type]}
      </Typography>
    </View>
  );
}

export function TransactionRow({
  title,
  merchant,
  category,
  account,
  categoryIcon,
  date,
  status,
  amountMinor,
  currency,
  type,
  semanticType,
  onPress,
}: {
  title: string;
  merchant?: string;
  category?: string;
  categoryIcon?: string;
  account?: string;
  date?: string;
  status?: string;
  amountMinor: bigint;
  currency: string;
  semanticType?: SemanticType;
  type: TransactionType;
  onPress?: PressableProps['onPress'];
}) {
  const detail = [merchant ?? category, account].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${semanticLabels[semanticType ?? type]}, ${detail}, ${formatMinor(signedMinor(amountMinor, type), currency)}`}
      onPress={onPress ?? undefined}
      disabled={!onPress}
      activeOpacity={0.72}
      style={{
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <CategoryIcon label={category ?? title} icon={categoryIcon} />
      <View style={{ flex: 1, gap: 3 }}>
        <Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
          {title}
        </Typography>
        {!!detail && (
          <Typography variant="caption" numberOfLines={1}>
            {detail}
          </Typography>
        )}
        <SemanticMarker type={semanticType ?? type} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Money amountMinor={amountMinor} currency={currency} type={type} />
        <Typography variant="caption">{status ?? date}</Typography>
      </View>
    </TouchableOpacity>
  );
}

export function AccountCard({
  name,
  balanceMinor,
  currency,
  kind = 'Account',
}: {
  name: string;
  balanceMinor: bigint;
  currency: string;
  kind?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Card style={{ width: 148, minHeight: 96, justifyContent: 'space-between', gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="small" style={{ color: tokens.foreground }}>
          {name}
        </Typography>
        <Landmark size={16} color={tokens.foregroundSubtle} />
      </View>
      <View style={{ gap: 2 }}>
        <Money amountMinor={balanceMinor} currency={currency} />
        <Typography variant="caption">{kind}</Typography>
      </View>
    </Card>
  );
}

export function CurrencyInput({
  currency,
  value,
  onChangeText,
}: {
  currency: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Typography variant="label">Amount</Typography>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            color: tokens.foreground,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 44,
            lineHeight: 50,
            letterSpacing: -1.6,
          }}
        >
          {currency === 'INR' ? '₹' : currency}
        </Text>
        <Input
          accessibilityLabel={`Amount in ${currency}`}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          style={{
            minWidth: 80,
            maxWidth: 240,
            minHeight: 60,
            borderWidth: 0,
            paddingHorizontal: 8,
            backgroundColor: 'transparent',
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 44,
            lineHeight: 50,
            letterSpacing: -1.6,
            textAlign: 'center',
          }}
        />
      </View>
    </View>
  );
}

export function AmountKeypad({ onDigit }: { onDigit: (digit: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {'1234567890.'.split('').map((digit) => (
        <Button
          key={digit}
          size="lg"
          variant="ghost"
          onPress={() => onDigit(digit)}
          style={{ width: '30%' }}
        >
          {digit}
        </Button>
      ))}
    </View>
  );
}

export function PeriodSelector({ label = 'This month' }: { label?: string }) {
  return (
    <Button variant="ghost" size="sm">
      {label}
    </Button>
  );
}

export function RecurringBadge() {
  return <Typography variant="caption">Recurring</Typography>;
}

export function SplitMemberRow({
  name,
  amountMinor,
  currency,
}: {
  name: string;
  amountMinor: bigint;
  currency: string;
}) {
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="bodyLarge" numberOfLines={1}>
          {name}
        </Typography>
        <SemanticMarker type="split" />
      </View>
      <Money amountMinor={amountMinor} currency={currency} />
    </View>
  );
}

export function BalanceRow({
  name,
  balanceMinor,
  currency,
}: {
  name: string;
  balanceMinor: bigint;
  currency: string;
}) {
  const owesYou = balanceMinor >= 0n;
  const absolute = owesYou ? balanceMinor : -balanceMinor;
  return (
    <View
      style={{
        minHeight: 60,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View style={{ gap: 2 }}>
        <Typography variant="bodyLarge">{name}</Typography>
        <Typography variant="caption">{owesYou ? 'owes you' : 'you owe'}</Typography>
      </View>
      <Money amountMinor={absolute} currency={currency} />
    </View>
  );
}

export function SettlementRow({
  name,
  amountMinor,
  currency,
}: {
  name: string;
  amountMinor: bigint;
  currency: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      <SemanticMarker type="settlement" />
      <BalanceRow name={name} balanceMinor={amountMinor} currency={currency} />
    </View>
  );
}

export function BudgetProgress({
  spentMinor,
  limitMinor,
  currency,
  title = 'Budget',
  primary = false,
}: {
  spentMinor: bigint;
  limitMinor: bigint;
  currency: string;
  title?: string;
  primary?: boolean;
}) {
  const { tokens } = useTheme();
  const percentage = limitMinor > 0n ? Number((spentMinor * 100n) / limitMinor) : 0;
  const over = spentMinor > limitMinor;
  const left = over ? spentMinor - limitMinor : limitMinor - spentMinor;
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View style={{ gap: 2 }}>
          <Typography variant="bodyLarge">{title}</Typography>
          <Typography variant="caption">
            {formatMinor(spentMinor, currency)} of {formatMinor(limitMinor, currency)}
          </Typography>
        </View>
        <Typography
          variant="small"
          style={{ color: over ? tokens.destructive : tokens.foreground }}
        >
          {over ? `${formatMinor(left, currency)} over` : `${formatMinor(left, currency)} left`}
        </Typography>
      </View>
      <Progress
        value={percentage}
        color={over ? tokens.destructive : primary ? tokens.primary : tokens.foreground}
      />
      <Typography variant="caption">{percentage}%</Typography>
    </View>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Typography variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Typography>
      <Typography variant="caption">{label}</Typography>
    </View>
  );
}

export function MetricPair({
  left,
  right,
}: {
  left: { label: string; value: string };
  right: { label: string; value: string };
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 1 }}>
        <Metric {...left} />
      </View>
      <View style={{ flex: 1 }}>
        <Metric {...right} />
      </View>
    </View>
  );
}

export function BrandMark() {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLabel="Finapp"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.primary }} />
      <Text
        style={{
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 19,
          lineHeight: 24,
          letterSpacing: -0.4,
        }}
      >
        finapp
      </Text>
    </View>
  );
}

export function DateSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Typography variant="caption" style={{ letterSpacing: 0.8 }}>
        {title.toUpperCase()}
      </Typography>
      <View>{children}</View>
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  onPress,
  leadingIcon,
}: {
  label: string;
  value?: string;
  onPress?: PressableProps['onPress'];
  leadingIcon?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={value ? [label, value].join(', ') : label}
      accessibilityRole={onPress ? 'button' : undefined}
      activeOpacity={onPress ? 0.72 : 1}
      disabled={!onPress}
      onPress={onPress ?? undefined}
      style={{
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {leadingIcon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: tokens.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {leadingIcon}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
          {label}
        </Typography>
        {value && <Typography variant="small">{value}</Typography>}
      </View>
      <View
        style={{
          width: 24,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {onPress && <CaretRight size={18} color={tokens.foregroundSubtle} />}
      </View>
    </TouchableOpacity>
  );
}
export function SettlementEditor({
  memberName,
  currency,
  direction,
  maxAmountMinor,
  disabledReason,
  saving = false,
  error,
  onSave,
}: {
  memberName: string;
  currency: string;
  direction: 'pay' | 'receive';
  maxAmountMinor: bigint;
  disabledReason?: string;
  saving?: boolean;
  error?: string;
  onSave: (amountMinor: bigint) => void;
}) {
  const [amount, setAmount] = useState('');
  const { tokens } = useTheme();
  let amountMinor: bigint | null = null;
  try {
    amountMinor = parseMinor(amount, currency);
  } catch {
    // Incomplete or invalid amounts remain editable, but cannot be submitted.
  }
  const invalidAmount = amount.length > 0 && (amountMinor === null || amountMinor <= 0n);
  const tooMuch = amountMinor !== null && amountMinor > maxAmountMinor;
  const disabled =
    saving || !!disabledReason || amountMinor === null || amountMinor <= 0n || tooMuch;
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 14 }}>
        <SemanticMarker type="settlement" />
        <Typography variant="title">Record a settlement</Typography>
        <Typography variant="small">
          {maxAmountMinor > 0n
            ? direction === 'pay'
              ? `You paid ${memberName}. `
              : `${memberName} paid you. `
            : 'Choose a group and member with an outstanding balance. '}
          This records a payment already made; it does not send money.
        </Typography>
        {maxAmountMinor > 0n && (
          <Typography variant="caption">
            Outstanding up to {formatMinor(maxAmountMinor, currency)}
          </Typography>
        )}
      </View>
      <CurrencyInput currency={currency} value={amount} onChangeText={setAmount} />
      {disabledReason && (
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          {disabledReason}
        </Typography>
      )}
      {invalidAmount && (
        <Typography variant="small" style={{ color: tokens.destructive }}>
          Enter a positive amount in {currency}.
        </Typography>
      )}
      {tooMuch && (
        <Typography variant="small" style={{ color: tokens.destructive }}>
          Amount exceeds the outstanding balance.
        </Typography>
      )}
      {!!error && (
        <View accessibilityRole="alert">
          <Typography variant="small" style={{ color: tokens.destructive }}>
            {error}
          </Typography>
        </View>
      )}
      <Button
        size="lg"
        disabled={disabled}
        onPress={() => amountMinor !== null && onSave(amountMinor)}
        accessibilityLabel={saving ? 'Saving settlement' : 'Record settlement'}
        style={!disabled ? { backgroundColor: tokens.settlement } : undefined}
      >
        <Check size={18} color={disabled ? tokens.controlDisabledForeground : tokens.background} />
        <Text
          style={{
            marginLeft: 8,
            color: disabled ? tokens.controlDisabledForeground : tokens.background,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            fontSize: 15,
          }}
        >
          {saving ? 'Saving…' : 'Record settlement'}
        </Text>
      </Button>
    </View>
  );
}

export function GroupCard({
  name,
  meta,
  balance,
  meaning,
  onPress,
}: {
  name: string;
  meta: string;
  balance: string;
  meaning: string;
  onPress?: PressableProps['onPress'];
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meaning} ${balance}`}
      onPress={onPress ?? undefined}
      activeOpacity={0.78}
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
        padding: 18,
        gap: 20,
      }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View style={{ gap: 4 }}>
          <Typography variant="heading">{name}</Typography>
          <Typography variant="caption">{meta}</Typography>
        </View>
        <CaretRight size={18} color={tokens.foregroundSubtle} />
      </View>
      <View style={{ gap: 3 }}>
        <Typography variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
          {balance}
        </Typography>
        <Typography variant="caption">{meaning}</Typography>
      </View>
    </TouchableOpacity>
  );
}

export function InsightCard({ title, body }: { title: string; body: string }) {
  const { tokens } = useTheme();
  return (
    <Card style={{ gap: 8 }}>
      <Typography variant="heading">{title}</Typography>
      <Text style={{ color: tokens.foregroundMuted }}>{body}</Text>
      <Separator />
    </Card>
  );
}
export { PeopleRail } from './PeopleRail';
