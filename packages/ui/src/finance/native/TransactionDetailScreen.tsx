import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight, NotePencil } from '@finapp/ui/icons/native';
import {
  Button,
  Empty,
  IconButton,
  Separator,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
import { TransactionCards, type TransactionTableItem } from './TransactionsScreen';
import { SemanticMarker } from './SemanticMarker';
import { SettingsRow } from './ScreenPrimitives';
import type { SemanticType, TransactionType } from '../types';

export type TransactionDetailScreenProps = {
  title: string;
  amountMinor: bigint;
  currency: string;
  type: TransactionType;
  semanticType: SemanticType;
  status?: string;
  category: string;
  categoryIcon?: string;
  account: string;
  destination?: string;
  date: string;
  merchant?: string;
  note?: string;
  loading?: boolean;
  error?: string | null;
  unavailable?: boolean;
  missingId?: boolean;
  canEdit?: boolean;
  canDuplicate?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onRetry?: () => void;
  referenceId?: string;
  relatedTransactions?: readonly TransactionTableItem[];
  onOpenTransaction?: (id: string) => void;
};

export function TransactionDetailScreen(props: TransactionDetailScreenProps) {
  const {
    title,
    amountMinor,
    currency,
    type,
    semanticType,
    status,
    category,
    categoryIcon,
    account,
    destination,
    date,
    merchant,
    note,
    loading = false,
    error,
    unavailable = false,
    missingId = false,
    canEdit = false,
    canDuplicate = false,
    onBack,
    onEdit,
    onDuplicate,
    onRetry,
  } = props;
  const { tokens } = useTheme();
  const contentStyle = { padding: 16, gap: 16, paddingBottom: 32 } as const;
  if (missingId)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 20, gap: 12 }}>
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} color={tokens.foreground} /> Back to transactions
        </Button>
        <Empty
          title="Missing transaction ID"
          description="Choose a transaction from your saved activity."
        />
      </View>
    );
  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 24 }}>
        <Typography variant="heading">Loading transaction…</Typography>
      </View>
    );
  if (error)
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={contentStyle}
      >
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} color={tokens.foreground} /> Back to transactions
        </Button>
        <Text accessibilityRole="alert" style={{ color: tokens.expense }}>
          Transaction data could not be opened: {error}
        </Text>
        {onRetry && (
          <Button variant="outline" onPress={onRetry}>
            Try again
          </Button>
        )}
      </ScrollView>
    );
  if (unavailable)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 20, gap: 12 }}>
        <Button variant="ghost" onPress={onBack}>
          <ArrowLeft size={18} color={tokens.foreground} /> Back to transactions
        </Button>
        <Empty
          title="Transaction unavailable"
          description="This transaction was removed or is no longer available in your saved data."
        />
      </View>
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={contentStyle}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Back to transactions" variant="ghost" onPress={onBack}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading">Transaction</Typography>
      </View>
      <View
        style={{
          gap: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: 12,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{width:64,height:64,borderRadius:14,backgroundColor:tokens.surfaceRaised,alignItems:'center',justifyContent:'center'}}><CategoryIcon label={category} icon={categoryIcon} /></View>
          <View style={{ flex: 1 }}>
            <Typography variant="heading">{title}</Typography>
            {merchant && <Typography variant="caption">{merchant}</Typography>}
          </View>
        </View>
        <Money amountMinor={amountMinor} currency={currency} type={type} size="hero" color={type==='income'||type==='refund'?tokens.income:tokens.expense} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="outline" disabled={!canEdit || !onEdit} onPress={onEdit}>
            <NotePencil size={17} color={tokens.foreground} /> Edit
          </Button>
          <Button variant="outline" disabled={!canDuplicate || !onDuplicate} onPress={onDuplicate}>
            <ArrowRight size={17} color={tokens.foreground} /> Duplicate
          </Button>
        </View>
        <Typography variant="caption">{date}</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SemanticMarker type={semanticType} />
          {status && <Typography variant="caption">{status}</Typography>}
        </View>
        {note && (
          <View
            style={{
              gap: 8,
              padding: 14,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              borderRadius: 14,
            }}
          >
            <Typography variant="label">Transaction notes</Typography>
            <Text>{note}</Text>
          </View>
        )}
      </View>
      <View
        style={{
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: 16,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <SettingsRow
          label="Category"
          leadingIcon={<CategoryIcon label={category} icon={categoryIcon} />}
          value={category}
        />
        <Separator />
        <SettingsRow
          label="Type"
          value={semanticType === 'split' ? 'Split expense' : semanticType}
        />
        <Separator />
        <SettingsRow label="Account" value={account} />
        {destination && (
          <>
            <Separator />
            <SettingsRow label="Destination" value={destination} />
          </>
        )}
        <Separator />
        <SettingsRow label="Date & time" value={date} />
        <Separator />
        <SettingsRow label="Status" value={status ?? 'Saved'} />
        {props.referenceId && <><Separator/><SettingsRow label="Reference ID" value={props.referenceId}/></>}
        {merchant && (
          <>
            <Separator />
            <SettingsRow label="Merchant / Payee" value={merchant} />
          </>
        )}
      </View>
      <View style={{padding:16,borderWidth:1,borderColor:tokens.borderSubtle,borderRadius:12,backgroundColor:tokens.surfaceRaised}}>
        <Typography variant="heading">Related transactions</Typography>
        <Typography variant="caption">Other transactions from this merchant or in this category.</Typography>
        <TransactionCards items={props.relatedTransactions??[]} onSelect={props.onOpenTransaction}/>
      </View>
    </ScrollView>
  );
}
