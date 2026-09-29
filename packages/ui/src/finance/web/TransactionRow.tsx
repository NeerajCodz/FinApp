import React from 'react';
import { useTheme } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { signedMinor } from '../money';
import { semanticLabels, type SemanticType, type TransactionType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';

export function TransactionRow({
  title,
  merchant,
  category,
  account,
  categoryIcon,
  date,
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
  const { tokens } = useTheme();
  const amountColor =
    type === 'expense'
      ? tokens.expense
      : type === 'income' || type === 'refund'
        ? tokens.income
        : tokens.transfer;
  const categoryDetails = [
    category ? { label: 'Category', value: category } : undefined,
    merchant ? { label: 'Merchant', value: merchant } : undefined,
    account ? { label: 'Account', value: account } : undefined,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    gap: 10,
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
  };
  const mainStyle: React.CSSProperties = {
    display: 'flex',
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: 10,
    border: 0,
    padding: 0,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    textDecoration: 'none',
  };
  const info = (
    <>
      <span
        style={{
          minWidth: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 15,
          lineHeight: '20px',
        }}
      >
        {title}
      </span>
      <time
        style={{ flexShrink: 0, color: tokens.foregroundMuted, fontSize: 12, whiteSpace: 'nowrap' }}
      >
        {date ?? 'Date unavailable'}
      </time>
      <Money amountMinor={amountMinor} currency={currency} type={type} color={amountColor} />
    </>
  );
  const accessibleLabel = `${title}, ${date ?? 'Date unavailable'}, ${semanticLabels[semanticType ?? type]}, ${category ?? 'Uncategorized'}${merchant ? `, ${merchant}` : ''}${account ? `, ${account}` : ''}, ${formatMinor(signedMinor(amountMinor, type), currency)}`;
  return (
    <div style={{ ...rowStyle, position: 'relative' }}>
      <span
        style={{ position: 'relative', display: 'inline-flex', flex: '0 0 40px' }}
        onMouseEnter={() => categoryDetails.length > 0 && setDetailsOpen(true)}
        onMouseLeave={() => setDetailsOpen(false)}
        onFocus={() => categoryDetails.length > 0 && setDetailsOpen(true)}
        onBlur={() => setDetailsOpen(false)}
      >
        <button
          type="button"
          aria-label={`Show category details for ${category ?? title}`}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen(true)}
          style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}
        >
          <CategoryIcon label={category ?? title} icon={categoryIcon} />
        </button>
        {detailsOpen && categoryDetails.length > 0 && (
          <span
            role="tooltip"
            style={{
              position: 'absolute',
              zIndex: 10,
              top: 46,
              left: 0,
              display: 'grid',
              minWidth: 180,
              gap: 6,
              padding: '10px 12px',
              border: `1px solid ${tokens.borderSubtle}`,
              borderRadius: 10,
              background: tokens.surfaceRaised,
              boxShadow: '0 8px 28px rgba(0,0,0,.22)',
              color: tokens.foreground,
              fontSize: 12,
            }}
          >
            {categoryDetails.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong> · {item.value}
              </span>
            ))}
          </span>
        )}
      </span>
      {onPress ? (
        <button
          type="button"
          aria-label={accessibleLabel}
          onClick={onPress}
          style={{ ...mainStyle, cursor: 'pointer' }}
        >
          {info}
        </button>
      ) : (
        <div aria-label={accessibleLabel} style={mainStyle}>
          {info}
        </div>
      )}
    </div>
  );
}
