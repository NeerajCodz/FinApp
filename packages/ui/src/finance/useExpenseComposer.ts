/**
 * State for the stepped group expense composer, shared by the mobile and web screens and by
 * both "new" and "edit" flows. Pure React: data loading and saving stay in the app wrappers.
 */
import React from 'react';
import {
  computeExpenseDraft,
  computePayerDraft,
  type ExpenseDraft,
  type GroupExpenseMethod,
  type PayerDraft,
} from './groupExpenseDraft';
import {
  computeLineItems,
  emptyLineItem,
  lineItemsTotalInput,
  type LineItemDraft,
} from './lineItems';

export const composerSteps = ['amount', 'details', 'paid', 'split'] as const;
export type ComposerStep = (typeof composerSteps)[number];
export const composerStepLabels: Record<ComposerStep, string> = {
  amount: 'Amount',
  details: 'Details',
  paid: 'Paid by',
  split: 'Split',
};

export type ExpenseComposerValues = {
  title: string;
  amount: string;
  occurredAt: number;
  merchant: string;
  note: string;
  accountId: string;
  categoryId: string;
  method: GroupExpenseMethod;
  participantIds: string[];
  basis: Record<string, string>;
  payerIds: string[];
  payerAmounts: Record<string, string>;
  /** Line items on: the total becomes their sum. Required by the `itemized` method. */
  itemize: boolean;
  items: LineItemDraft[];
};

export type ExpenseComposer = ExpenseComposerValues & {
  draft: ExpenseDraft;
  payerDraft: PayerDraft;
  /** First blocking problem per step ('' when the step is complete). */
  stepErrors: Record<ComposerStep, string>;
  /** First blocking problem overall, or '' when ready to save. */
  validation: string;
  set: <K extends keyof ExpenseComposerValues>(key: K, value: ExpenseComposerValues[K]) => void;
  setMethod: (method: GroupExpenseMethod) => void;
  toggleParticipant: (userId: string, selected: boolean) => void;
  setAllParticipants: (userIds: readonly string[]) => void;
  setBasis: (userId: string, value: string) => void;
  togglePayer: (userId: string) => void;
  setPayerAmount: (userId: string, value: string) => void;
  /** Turns line items on (seeding a first row) or off (keeping the total). */
  setItemize: (on: boolean) => void;
  setItems: (items: LineItemDraft[]) => void;
  /** Per-row problems for the item editor, in row order. */
  itemErrors: string[];
  /** Replaces every value, e.g. once an expense being edited has loaded. */
  reset: (values: Partial<ExpenseComposerValues>) => void;
};

export function emptyComposerValues(currentUserId?: string | null): ExpenseComposerValues {
  return {
    title: '',
    amount: '',
    occurredAt: Date.now(),
    merchant: '',
    note: '',
    accountId: '',
    categoryId: '',
    method: 'equal',
    participantIds: currentUserId ? [currentUserId] : [],
    basis: {},
    payerIds: currentUserId ? [currentUserId] : [],
    payerAmounts: {},
    itemize: false,
    items: [],
  };
}

export function useExpenseComposer({
  currency,
  currentUserId,
  memberIds,
  detailsError = '',
}: {
  currency: string;
  currentUserId?: string | null;
  /** Members that can be chosen; selections outside this list are reported. */
  memberIds: readonly string[];
  /** Wrapper-level problems for the details step (account, group, date…). */
  detailsError?: string | ((values: ExpenseComposerValues) => string);
}): ExpenseComposer {
  const [values, setValues] = React.useState(() => emptyComposerValues(currentUserId));
  const seededUser = React.useRef(currentUserId ?? null);
  React.useEffect(() => {
    // The signed-in user often resolves after the first render; seed them once.
    if (!currentUserId || seededUser.current) return;
    seededUser.current = currentUserId;
    setValues((current) => ({
      ...current,
      participantIds: current.participantIds.length ? current.participantIds : [currentUserId],
      payerIds: current.payerIds.length ? current.payerIds : [currentUserId],
    }));
  }, [currentUserId]);

  const participantIds = values.participantIds.filter((id) => memberIds.includes(id));
  const itemsDraft = values.itemize ? computeLineItems(values.items, currency) : null;
  const amount = itemsDraft ? lineItemsTotalInput(itemsDraft.totalMinor, currency) : values.amount;
  const draft = computeExpenseDraft({
    amount,
    currency,
    method: values.method,
    participantIds,
    basis: values.basis,
    items: values.itemize ? values.items : null,
  });
  const payerDraft = computePayerDraft({
    totalMinor: draft.totalMinor,
    currency,
    payerIds: values.payerIds,
    amounts: values.payerAmounts,
  });
  const amountError = itemsDraft
    ? itemsDraft.error || (itemsDraft.totalMinor > 0n ? '' : 'Add items with amounts.')
    : amount.trim()
      ? draft.totalMinor === null
        ? draft.error || 'Enter a valid amount.'
        : ''
      : 'Enter the total amount.';
  const stepErrors: Record<ComposerStep, string> = {
    amount: amountError,
    details: !values.title.trim()
      ? 'Enter what this expense was for.'
      : typeof detailsError === 'function'
        ? detailsError(values)
        : detailsError,
    paid: amountError ? '' : payerDraft.error,
    split:
      participantIds.length !== values.participantIds.length
        ? 'Someone selected is no longer in this group.'
        : amountError
          ? ''
          : draft.error,
  };
  const validation = composerSteps.map((step) => stepErrors[step]).find(Boolean) ?? '';

  const set = React.useCallback(
    <K extends keyof ExpenseComposerValues>(key: K, value: ExpenseComposerValues[K]) =>
      setValues((current) => ({ ...current, [key]: value })),
    [],
  );
  return {
    ...values,
    amount,
    itemErrors: itemsDraft?.rowErrors ?? [],
    draft,
    payerDraft,
    stepErrors,
    validation,
    set,
    setMethod: (method) =>
      setValues((current) => ({
        ...current,
        method,
        basis: {},
        ...(method === 'itemized' && !current.itemize
          ? { itemize: true, items: current.items.length ? current.items : [emptyLineItem()] }
          : {}),
      })),
    setItemize: (on) =>
      setValues((current) => {
        if (on)
          return {
            ...current,
            itemize: true,
            items: current.items.length ? current.items : [emptyLineItem()],
          };
        const total = computeLineItems(current.items, currency).totalMinor;
        return {
          ...current,
          itemize: false,
          amount: total > 0n ? lineItemsTotalInput(total, currency) : current.amount,
          method: current.method === 'itemized' ? 'equal' : current.method,
          basis: current.method === 'itemized' ? {} : current.basis,
        };
      }),
    setItems: (items) => setValues((current) => ({ ...current, items })),
    toggleParticipant: (userId, selected) =>
      setValues((current) => ({
        ...current,
        participantIds: selected
          ? current.participantIds.includes(userId)
            ? current.participantIds
            : [...current.participantIds, userId]
          : current.participantIds.filter((id) => id !== userId),
      })),
    setAllParticipants: (userIds) =>
      setValues((current) => ({ ...current, participantIds: [...userIds] })),
    setBasis: (userId, value) =>
      setValues((current) => ({ ...current, basis: { ...current.basis, [userId]: value } })),
    togglePayer: (userId) =>
      setValues((current) => ({
        ...current,
        payerIds: current.payerIds.includes(userId)
          ? current.payerIds.filter((id) => id !== userId)
          : [...current.payerIds, userId],
      })),
    setPayerAmount: (userId, value) =>
      setValues((current) => ({
        ...current,
        payerAmounts: { ...current.payerAmounts, [userId]: value },
      })),
    reset: (next) => setValues((current) => ({ ...current, ...next })),
  };
}
