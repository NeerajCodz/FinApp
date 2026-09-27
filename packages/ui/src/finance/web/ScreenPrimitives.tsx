import React from 'react';
import { ChevronRight, Landmark } from 'lucide-react';
import { Card, Typography, useTheme } from '@finapp/ui/web';
import { Money } from './Money';

export function BrandMark() {
  const { tokens } = useTheme();
  return (
    <span aria-label="Finapp" style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: tokens.primary }} />
      <Typography variant="bodyLarge" style={{ fontSize: 19, lineHeight: '24px', letterSpacing: -0.4 }}>
        finapp
      </Typography>
    </span>
  );
}

export function DateSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <Typography variant="caption" style={{ letterSpacing: 0.8 }}>
        {title.toUpperCase()}
      </Typography>
      <div>{children}</div>
    </section>
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
  onPress?: () => void;
  leadingIcon?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const contents = (
    <>
      {leadingIcon && (
        <span
          aria-hidden="true"
          style={{
            display: 'grid',
            width: 40,
            height: 40,
            flex: '0 0 40px',
            placeItems: 'center',
            borderRadius: 13,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          {leadingIcon}
        </span>
      )}
      <span style={{ display: 'grid', flex: 1, gap: 2 }}>
        <Typography variant="bodyLarge" style={{ fontSize: 15 }}>
          {label}
        </Typography>
        {value && <Typography variant="small">{value}</Typography>}
      </span>
      <span style={{ display: 'grid', width: 24, flex: '0 0 24px', placeItems: 'center' }}>
        {onPress && <ChevronRight size={18} color={tokens.foregroundSubtle} />}
      </span>
    </>
  );
  const style: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    minHeight: 58,
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
  return onPress ? (
    <button type="button" aria-label={value ? `${label}, ${value}` : label} onClick={onPress} style={{ ...style, cursor: 'pointer' }}>
      {contents}
    </button>
  ) : (
    <div aria-label={value ? `${label}, ${value}` : label} style={style}>
      {contents}
    </div>
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
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="small" style={{ color: tokens.foreground }}>
          {name}
        </Typography>
        <Landmark size={16} color={tokens.foregroundSubtle} />
      </span>
      <span style={{ display: 'grid', gap: 2 }}>
        <Money amountMinor={balanceMinor} currency={currency} />
        <Typography variant="caption">{kind}</Typography>
      </span>
    </Card>
  );
}
