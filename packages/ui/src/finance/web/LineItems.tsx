'use client';
import React from 'react';
import { AvatarStack, Button, IconTile, StatusPill } from '@finapp/ui/web';
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
import { PersonAvatar } from './GroupUI';
import s from './LineItems.module.css';

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
};

/** Add, edit, reorder and remove line items, with a live total. */
export function LineItemsEditor({
  rows,
  currency,
  onChange,
  rowErrors,
  people,
  disabled,
}: LineItemsEditorProps) {
  const parsed = computeLineItems(rows, currency);
  const errors = rowErrors ?? parsed.rowErrors;
  const participantIds = people?.map((person) => person.userId) ?? [];
  return (
    <div className={s.editor}>
      {rows.map((row, index) => {
        const sharers = people ? itemSharers(row, participantIds) : [];
        const nobody = Boolean(people && !sharers.length);
        const problem = nobody ? 'Choose the people who had this item.' : (errors[index] ?? '');
        return (
          <div key={row.id} className={s.item} data-invalid={problem ? '' : undefined}>
            <div className={s.itemTop}>
              <span className={s.index} aria-hidden>
                {index + 1}
              </span>
              <input
                className={s.input}
                aria-label={`Item ${index + 1} name`}
                placeholder="Item, e.g. Starters"
                value={row.title}
                maxLength={MAX_LINE_ITEM_TITLE}
                disabled={disabled}
                onChange={(event) =>
                  onChange(updateLineItem(rows, row.id, { title: event.currentTarget.value }))
                }
              />
            </div>
            <div className={s.itemFields}>
              <input
                className={`${s.input} ${s.amountInput}`}
                aria-label={`Item ${index + 1} amount in ${currency}`}
                inputMode="decimal"
                placeholder={`0.00 ${currency}`}
                value={row.amount}
                disabled={disabled}
                onChange={(event) =>
                  onChange(updateLineItem(rows, row.id, { amount: event.currentTarget.value }))
                }
              />
              <input
                className={`${s.input} ${s.qtyInput}`}
                aria-label={`Item ${index + 1} quantity (optional)`}
                inputMode="numeric"
                placeholder="Qty"
                value={row.quantity}
                disabled={disabled}
                onChange={(event) =>
                  onChange(updateLineItem(rows, row.id, { quantity: event.currentTarget.value }))
                }
              />
              <div className={s.tools}>
                <button
                  type="button"
                  className={s.iconButton}
                  aria-label={`Move item ${index + 1} up`}
                  disabled={disabled || index === 0}
                  onClick={() => onChange(moveLineItem(rows, row.id, -1))}
                >
                  <EntityIcon value="phosphor:CaretUp" size={16} color="currentColor" />
                </button>
                <button
                  type="button"
                  className={s.iconButton}
                  aria-label={`Move item ${index + 1} down`}
                  disabled={disabled || index === rows.length - 1}
                  onClick={() => onChange(moveLineItem(rows, row.id, 1))}
                >
                  <EntityIcon value="phosphor:CaretDown" size={16} color="currentColor" />
                </button>
                <button
                  type="button"
                  className={s.iconButton}
                  data-tone="destructive"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={disabled}
                  onClick={() => onChange(removeLineItem(rows, row.id))}
                >
                  <EntityIcon value="phosphor:Trash" size={16} color="currentColor" />
                </button>
              </div>
            </div>
            {people && (
              <div className={s.chips} role="group" aria-label={`Who had item ${index + 1}`}>
                <button
                  type="button"
                  role="checkbox"
                  className={s.chip}
                  data-everyone=""
                  aria-checked={row.participantIds === null}
                  disabled={disabled}
                  onClick={() =>
                    onChange(
                      updateLineItem(rows, row.id, {
                        participantIds: row.participantIds === null ? [] : null,
                      }),
                    )
                  }
                >
                  <EntityIcon value="phosphor:UsersThree" size={14} color="currentColor" />
                  Everyone
                </button>
                {people.map((person) => (
                  <button
                    key={person.userId}
                    type="button"
                    role="checkbox"
                    className={s.chip}
                    aria-label={`${person.name} had this`}
                    aria-checked={row.participantIds !== null && sharers.includes(person.userId)}
                    disabled={disabled}
                    onClick={() =>
                      onChange(
                        rows.map((item) =>
                          item.id === row.id
                            ? toggleItemParticipant(item, person.userId, participantIds)
                            : item,
                        ),
                      )
                    }
                  >
                    <PersonAvatar
                      name={person.name}
                      url={person.avatarUrl}
                      avatarId={person.avatarId}
                      size={22}
                    />
                    {person.name.split(' ')[0] || person.name}
                  </button>
                ))}
              </div>
            )}
            {problem && (
              <p className={s.problem} role="alert">
                {problem}
              </p>
            )}
          </div>
        );
      })}
      <div className={s.actions}>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || rows.length >= MAX_LINE_ITEMS}
          onPress={() => onChange(addLineItem(rows))}
        >
          Add item
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || rows.length >= MAX_LINE_ITEMS}
          onPress={() => onChange(addLineItem(rows, 'Tax / tip'))}
        >
          Add tax / tip
        </Button>
      </div>
      <div className={s.total}>
        <strong>
          Total · {rows.length} {rows.length === 1 ? 'item' : 'items'}
        </strong>
        <strong aria-label={`Items total ${formatLineAmount(parsed.totalMinor, currency)}`}>
          {formatLineAmount(parsed.totalMinor, currency)}
        </strong>
      </div>
    </div>
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
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.amountMinor, 0n);
  const personFor = (id: string) => people?.find((person) => person.userId === id);
  return (
    <section className={s.receipt} aria-label={title}>
      <div className={s.receiptHead}>
        <IconTile tone="neutral" size={32}>
          <EntityIcon value="phosphor:Receipt" size={18} color="currentColor" />
        </IconTile>
        <h3>{title}</h3>
        <StatusPill label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`} />
      </div>
      {items.map((item) => {
        const sharers = item.sharers ?? [];
        return (
          <div key={item.id} className={s.line}>
            <div className={s.lineCopy}>
              <span>
                {item.quantity && item.quantity > 1 ? `${item.quantity} × ` : ''}
                {item.title}
              </span>
              {people && sharers.length > 0 && (
                <span className={s.sharers}>
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
                  <span>
                    {sharers.length === people.length
                      ? 'Everyone'
                      : sharers
                          .map((id) => personFor(id)?.name.split(' ')[0] ?? 'Member')
                          .join(', ')}
                  </span>
                </span>
              )}
            </div>
            <span className={s.lineAmount}>{formatLineAmount(item.amountMinor, currency)}</span>
          </div>
        );
      })}
      <div className={s.receiptTotal}>
        <strong>Total</strong>
        <strong>{formatLineAmount(total, currency)}</strong>
      </div>
      {!!totals?.length && (
        <div className={s.people}>
          <p className={s.peopleTitle}>Each person</p>
          {totals.map((row) => {
            const person = personFor(row.userId);
            return (
              <div key={row.userId} className={s.person}>
                <PersonAvatar
                  name={person?.name ?? 'Member'}
                  url={person?.avatarUrl}
                  avatarId={person?.avatarId}
                  size={26}
                />
                <span>{person?.name ?? 'Member'}</span>
                <strong className={s.lineAmount}>
                  {formatLineAmount(row.amountMinor, currency)}
                </strong>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
