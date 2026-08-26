import React from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Input, Progress, Text, Typography } from '@/components/ui';
import { formatMinor, signedMinor } from '@/lib/money';

export function MoneyText({
  amountMinor,
  currency,
  type = 'income',
}: {
  amountMinor: bigint;
  currency: string;
  type?: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
}) {
  const amount = signedMinor(amountMinor, type);
  return (
    <Text
      accessibilityLabel={`${type} ${amount.toString()} ${currency}`}
      style={{ color: type === 'expense' ? '#D92D20' : '#0E9F6E', fontWeight: '700' }}
    >
      {formatMinor(amount, currency)}
    </Text>
  );
}
export function TransactionRow({
  title,
  merchant,
  amountMinor,
  currency,
  type,
}: {
  title: string;
  merchant?: string;
  amountMinor: bigint;
  currency: string;
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
}) {
  return (
    <Card
      accessibilityLabel={`${title}, ${merchant ?? ''}, ${type}, ${formatMinor(signedMinor(amountMinor, type), currency)}`}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <View>
        <Typography>{title}</Typography>
        {merchant && <Text style={{ color: '#667085' }}>{merchant}</Text>}
      </View>
      <MoneyText amountMinor={amountMinor} currency={currency} type={type} />
    </Card>
  );
}
export function AccountCard({
  name,
  balanceMinor,
  currency,
}: {
  name: string;
  balanceMinor: bigint;
  currency: string;
}) {
  return (
    <Card>
      <Text style={{ color: '#667085' }}>{name}</Text>
      <Typography variant="heading">{formatMinor(balanceMinor, currency)}</Typography>
    </Card>
  );
}
export function CategoryIcon({ label }: { label: string }) {
  return <Badge>{label.slice(0, 1).toUpperCase()}</Badge>;
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
  return (
    <View>
      <Text style={{ color: '#667085' }}>{currency}</Text>
      <Input
        accessibilityLabel={`Amount in ${currency}`}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}
export function AmountKeypad({ onDigit }: { onDigit: (digit: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {'1234567890.'.split('').map((digit) => (
        <Button key={digit} variant="secondary" onPress={() => onDigit(digit)}>
          {digit}
        </Button>
      ))}
    </View>
  );
}
export function PeriodSelector({ label = 'This month' }: { label?: string }) {
  return <Button variant="secondary">{label}</Button>;
}
export function RecurringBadge() {
  return <Badge>Recurring</Badge>;
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
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text>{name}</Text>
      <MoneyText amountMinor={amountMinor} currency={currency} />
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
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text>{name}</Text>
      <MoneyText
        amountMinor={balanceMinor < 0n ? -balanceMinor : balanceMinor}
        currency={currency}
        type={balanceMinor < 0n ? 'expense' : 'income'}
      />
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
    <BalanceRow name={`Settlement with ${name}`} balanceMinor={amountMinor} currency={currency} />
  );
}
export function BudgetProgress({
  spentMinor,
  limitMinor,
  currency,
}: {
  spentMinor: bigint;
  limitMinor: bigint;
  currency: string;
}) {
  const percentage = limitMinor > 0n ? Number((spentMinor * 100n) / limitMinor) : 0;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>Budget</Text>
        <Text>
          {formatMinor(spentMinor, currency)} / {formatMinor(limitMinor, currency)}
        </Text>
      </View>
      <Progress value={percentage} />
    </Card>
  );
}
export function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Typography variant="heading">{title}</Typography>
      <Text style={{ color: '#667085' }}>{body}</Text>
    </Card>
  );
}
