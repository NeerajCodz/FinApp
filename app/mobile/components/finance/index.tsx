import React, { useState } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import {
  Button,
  Card,
  Input,
  Progress,
  Separator,
  Text,
  Typography,
} from '@/components/ui';
import {
  Car,
  CaretRight,
  Eye,
  EyeOff,
  Landmark,
  ReceiptText,
  ShoppingBag,
  Utensils,
} from '@/lib/icons';
import { useTheme } from '@/providers/ThemeProvider';
import { formatMinor, signedMinor } from '@/lib/money';

type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
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
  const formatted = hidden ? `${currency === 'INR' ? '₹' : ''}••••••` : formatMinor(amount, currency);
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
          onPress={() => setHidden((current) => !current)}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.64 : 1 })}
        >
          {hidden ? (
            <EyeOff size={17} color={tokens.foregroundSubtle} />
          ) : (
            <Eye size={17} color={tokens.foregroundSubtle} />
          )}
        </Pressable>
      </View>
      <Money amountMinor={amountMinor} currency={currency} size="hero" hidden={hidden} />
      {delta && (
        <Typography variant="small" style={{ color: tokens.primary, fontFamily: 'SpaceGrotesk_500Medium' }}>
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

export function CategoryIcon({ label, selected = false }: { label: string; selected?: boolean }) {
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
      <Icon size={19} color={selected ? tokens.background : tokens.foregroundMuted} />
    </View>
  );
}

export function TransactionRow({
  title,
  merchant,
  category,
  account,
  date,
  status,
  amountMinor,
  currency,
  type,
  onPress,
}: {
  title: string;
  merchant?: string;
  category?: string;
  account?: string;
  date?: string;
  status?: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
  onPress?: PressableProps['onPress'];
}) {
  const { tokens } = useTheme();
  const detail = [merchant ?? category, account].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${detail}, ${formatMinor(signedMinor(amountMinor, type), currency)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <CategoryIcon label={category ?? title} />
      <View style={{ flex: 1, gap: 3 }}>
        <Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
          {title}
        </Typography>
        {!!detail && <Typography variant="caption">{detail}</Typography>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Money amountMinor={amountMinor} currency={currency} type={type} />
        <Typography variant="caption">{status ?? date}</Typography>
      </View>
    </Pressable>
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
        <Typography variant="small" style={{ color: tokens.foreground }}>{name}</Typography>
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
    <View style={{ minHeight: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="bodyLarge">{name}</Typography>
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
    <View style={{ minHeight: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
  return <BalanceRow name={name} balanceMinor={amountMinor} currency={currency} />;
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 2 }}>
          <Typography variant="bodyLarge">{title}</Typography>
          <Typography variant="caption">
            {formatMinor(spentMinor, currency)} of {formatMinor(limitMinor, currency)}
          </Typography>
        </View>
        <Typography variant="small" style={{ color: over ? tokens.destructive : tokens.foreground }}>
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
}: {
  label: string;
  value?: string;
  onPress?: PressableProps['onPress'];
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Typography variant="bodyLarge" style={{ flex: 1, fontSize: 15 }}>
        {label}
      </Typography>
      {value && <Typography variant="small">{value}</Typography>}
      {onPress && <CaretRight size={18} color={tokens.foregroundSubtle} />}
    </Pressable>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meaning} ${balance}`}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
        padding: 18,
        gap: 20,
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
    </Pressable>
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
