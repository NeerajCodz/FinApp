import React from 'react';
import { Pressable, View } from 'react-native';
import {
  AvatarStack,
  Button,
  IconTile,
  Input,
  PressableScale,
  StatusPill,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { withAlpha } from '../../tokens';
import {
  addLineItem,
  computeLineItems,
  formatLineAmount,
  itemSharers,
  MAX_LINE_ITEM_TITLE,
  MAX_LINE_ITEMS,
  moveLineItem,
  removeLineItem,
  toggleItemParticipant,
  updateLineItem,
  type LineItemDraft,
  type LineItemView,
} from '../lineItems';
import { EntityIcon } from './EntityIconPicker';
import { GroupAvatar } from './GroupPrimitives';

export type LineItemPerson = {
  userId: string;
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
};

export type LineItemsEditorProps = {
  rows: readonly LineItemDraft[];
  currency: string;
  onChange: (rows: LineItemDraft[]) => void;
  /** Per-row problems from `computeLineItems`; computed here when omitted. */
  rowErrors?: readonly string[];
  /** People sharing the expense: shows a "who had this" picker on every item. */
  people?: readonly LineItemPerson[];
  disabled?: boolean;
  /** Rows to highlight for review (e.g. lines a receipt scan was unsure about). */
  reviewIds?: readonly string[];
};

/** Add, edit, reorder and remove line items, with a live total. */
export function LineItemsEditor({
  rows,
  currency,
  onChange,
  rowErrors,
  people,
  disabled,
  reviewIds,
}: LineItemsEditorProps) {
  const { tokens } = useTheme();
  const parsed = computeLineItems(rows, currency);
  const errors = rowErrors ?? parsed.rowErrors;
  const participantIds = people?.map((person) => person.userId) ?? [];
  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, index) => {
        const sharers = people ? itemSharers(row, participantIds) : [];
        const error = errors[index] ?? '';
        const nobody = Boolean(people && !sharers.length);
        const review = Boolean(reviewIds?.includes(row.id));
        return (
          <View
            key={row.id}
            style={{
              gap: 8,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: error || nobody || review ? tokens.warning : tokens.borderSubtle,
              backgroundColor: tokens.card,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconTile tone="neutral" size={28}>
                <Typography variant="caption">{index + 1}</Typography>
              </IconTile>
              <Input
                accessibilityLabel={`Item ${index + 1} name`}
                placeholder="Item, e.g. Starters"
                value={row.title}
                maxLength={MAX_LINE_ITEM_TITLE}
                editable={!disabled}
                onChangeText={(title) => onChange(updateLineItem(rows, row.id, { title }))}
                style={{ flex: 1 }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Input
                accessibilityLabel={`Item ${index + 1} amount in ${currency}`}
                keyboardType="decimal-pad"
                placeholder={`0.00 ${currency}`}
                value={row.amount}
                editable={!disabled}
                onChangeText={(amount) => onChange(updateLineItem(rows, row.id, { amount }))}
                style={{ flex: 2, textAlign: 'right', fontVariant: ['tabular-nums'] }}
              />
              <Input
                accessibilityLabel={`Item ${index + 1} quantity (optional)`}
                keyboardType="number-pad"
                placeholder="Qty"
                value={row.quantity}
                editable={!disabled}
                onChangeText={(quantity) => onChange(updateLineItem(rows, row.id, { quantity }))}
                style={{ flex: 1, textAlign: 'center' }}
              />
              <RowButton
                icon="phosphor:CaretUp"
                label={`Move item ${index + 1} up`}
                disabled={disabled || index === 0}
                onPress={() => onChange(moveLineItem(rows, row.id, -1))}
              />
              <RowButton
                icon="phosphor:CaretDown"
                label={`Move item ${index + 1} down`}
                disabled={disabled || index === rows.length - 1}
                onPress={() => onChange(moveLineItem(rows, row.id, 1))}
              />
              <RowButton
                icon="phosphor:Trash"
                label={`Remove item ${index + 1}`}
                tone="destructive"
                disabled={disabled}
                onPress={() => onChange(removeLineItem(rows, row.id))}
              />
            </View>
            {people && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <PersonChip
                  label="Everyone"
                  selected={row.participantIds === null}
                  disabled={disabled}
                  onPress={() =>
                    onChange(
                      updateLineItem(rows, row.id, {
                        participantIds: row.participantIds === null ? [] : null,
                      }),
                    )
                  }
                />
                {people.map((person) => (
                  <PersonChip
                    key={person.userId}
                    label={person.name.split(' ')[0] || person.name}
                    person={person}
                    selected={row.participantIds !== null && sharers.includes(person.userId)}
                    disabled={disabled}
                    onPress={() =>
                      onChange(
                        rows.map((item) =>
                          item.id === row.id
                            ? toggleItemParticipant(item, person.userId, participantIds)
                            : item,
                        ),
                      )
                    }
                  />
                ))}
              </View>
            )}
            {(error || nobody) && (
              <Typography
                variant="caption"
                accessibilityRole="alert"
                style={{ color: tokens.warning }}
              >
                {nobody ? 'Tap the people who had this item.' : error}
              </Typography>
            )}
            {review && !error && !nobody && (
              <Typography variant="caption" style={{ color: tokens.warning }}>
                Check this line against the bill.
              </Typography>
            )}
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          size="sm"
          variant="outline"
          style={{ flex: 1 }}
          disabled={disabled || rows.length >= MAX_LINE_ITEMS}
          onPress={() => onChange(addLineItem(rows))}
        >
          Add item
        </Button>
        <Button
          size="sm"
          variant="ghost"
          style={{ flex: 1 }}
          disabled={disabled || rows.length >= MAX_LINE_ITEMS}
          onPress={() => onChange(addLineItem(rows, 'Tax / tip'))}
        >
          Add tax / tip
        </Button>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: tokens.borderSubtle,
        }}
      >
        <Typography variant="label">
          Total · {rows.length} {rows.length === 1 ? 'item' : 'items'}
        </Typography>
        <Typography
          variant="heading"
          accessibilityLabel={`Items total ${formatLineAmount(parsed.totalMinor, currency)}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatLineAmount(parsed.totalMinor, currency)}
        </Typography>
      </View>
    </View>
  );
}

function RowButton({
  icon,
  label,
  onPress,
  disabled,
  tone,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'destructive';
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 32,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <EntityIcon
        value={icon}
        size={18}
        color={tone === 'destructive' ? tokens.destructive : tokens.foregroundMuted}
      />
    </Pressable>
  );
}

function PersonChip({
  label,
  person,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  person?: LineItemPerson;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={person ? `${person.name} had this` : 'Everyone had this'}
      accessibilityState={{ checked: selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 34,
        paddingVertical: 4,
        paddingLeft: person ? 4 : 12,
        paddingRight: 12,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: selected ? tokens.split : tokens.borderSubtle,
        backgroundColor: selected ? withAlpha(tokens.split, 0.12) : tokens.card,
      }}
    >
      {person ? (
        <GroupAvatar
          name={person.name}
          avatarId={person.avatarId}
          avatarUrl={person.avatarUrl}
          size={24}
        />
      ) : (
        <EntityIcon value="phosphor:UsersThree" size={16} color={tokens.split} />
      )}
      <Typography
        variant="caption"
        style={{ color: selected ? tokens.foreground : tokens.foregroundMuted }}
      >
        {label}
      </Typography>
    </PressableScale>
  );
}

export type LineItemsReceiptProps = {
  items: readonly (LineItemView & { sharers?: readonly string[] })[];
  currency: string;
  /** Resolves people for the "who shared it" stacks on an itemized group expense. */
  people?: readonly LineItemPerson[];
  /** Each person's total, shown under the items. */
  totals?: readonly { userId: string; amountMinor: bigint }[];
  title?: string;
};

/** Receipt-style breakdown of a transaction's items. */
export function LineItemsReceipt({
  items,
  currency,
  people,
  totals,
  title = 'Items',
}: LineItemsReceiptProps) {
  const { tokens } = useTheme();
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.amountMinor, 0n);
  const personFor = (id: string) => people?.find((person) => person.userId === id);
  return (
    <View
      style={{
        gap: 10,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceRaised,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconTile tone="neutral" size={32}>
          <EntityIcon value="phosphor:Receipt" size={18} color={tokens.foregroundMuted} />
        </IconTile>
        <Typography variant="heading" style={{ flex: 1 }}>
          {title}
        </Typography>
        <StatusPill label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`} />
      </View>
      {items.map((item) => {
        const sharers = item.sharers ?? [];
        return (
          <View key={item.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Typography variant="body">
                  {item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ''}
                  {item.title}
                </Typography>
                {people && sharers.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AvatarStack
                      size={20}
                      people={sharers.map((id) => {
                        const person = personFor(id);
                        return {
                          id,
                          name: person?.name ?? 'Member',
                          avatarId: person?.avatarId,
                          imageUrl: person?.avatarUrl ?? null,
                        };
                      })}
                    />
                    <Typography variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                      {sharers.length === people.length
                        ? 'Everyone'
                        : sharers
                            .map((id) => personFor(id)?.name.split(' ')[0] ?? 'Member')
                            .join(', ')}
                    </Typography>
                  </View>
                )}
              </View>
              <Typography variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                {formatLineAmount(item.amountMinor, currency)}
              </Typography>
            </View>
          </View>
        );
      })}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTopWidth: 1,
          borderStyle: 'dashed',
          borderTopColor: tokens.borderSubtle,
        }}
      >
        <Typography variant="label">Total</Typography>
        <Typography variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
          {formatLineAmount(total, currency)}
        </Typography>
      </View>
      {!!totals?.length && (
        <View style={{ gap: 6, paddingTop: 4 }}>
          <Typography variant="overline">Each person</Typography>
          {totals.map((row) => {
            const person = personFor(row.userId);
            return (
              <View
                key={row.userId}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <GroupAvatar
                  name={person?.name ?? 'Member'}
                  avatarId={person?.avatarId}
                  avatarUrl={person?.avatarUrl}
                  size={26}
                />
                <Typography variant="small" style={{ flex: 1 }}>
                  {person?.name ?? 'Member'}
                </Typography>
                <Typography variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatLineAmount(row.amountMinor, currency)}
                </Typography>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
