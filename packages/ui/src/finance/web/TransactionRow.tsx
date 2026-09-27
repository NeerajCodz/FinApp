import React from 'react';
import { Typography } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { signedMinor } from '../money';
import { semanticLabels, type SemanticType, type TransactionType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
import { SemanticMarker } from './SemanticMarker';

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
  onPress?: () => void;
}) {
  const detail = [merchant ?? category, account].filter(Boolean).join(' · ');
  const contents = (
    <>
      <CategoryIcon label={category ?? title} icon={categoryIcon} />
      <span style={{ display: 'grid', minWidth: 0, flex: 1, gap: 3, textAlign: 'left' }}>
        <Typography variant="bodyLarge" style={{ overflow: 'hidden', fontSize: 15, lineHeight: '20px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
        {!!detail && (
          <Typography variant="caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {detail}
          </Typography>
        )}
        <SemanticMarker type={semanticType ?? type} />
      </span>
      <span style={{ display: 'grid', flexShrink: 0, justifyItems: 'end', gap: 3 }}>
        <Money amountMinor={amountMinor} currency={currency} type={type} />
        <Typography variant="caption">{status ?? date}</Typography>
      </span>
    </>
  );
  const style: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    minHeight: 72,
    alignItems: 'center',
    gap: 12,
    border: 0,
    padding: 0,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    textDecoration: 'none',
  };
  const accessibleLabel = `${title}, ${semanticLabels[semanticType ?? type]}, ${detail}, ${formatMinor(signedMinor(amountMinor, type), currency)}`;
  return onPress ? (
    <button type="button" aria-label={accessibleLabel} onClick={onPress} style={{ ...style, cursor: 'pointer' }}>
      {contents}
    </button>
  ) : (
    <div aria-label={accessibleLabel} style={style}>
      {contents}
    </div>
  );
}
